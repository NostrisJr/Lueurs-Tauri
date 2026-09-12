import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { Transaction } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { createLogger } from "../../lib/logger";
import { type HugoSuggestion, categoryOf, checkText } from "./hugoApi";
import { ignoredWordsRef, spellcheckEnabledRef } from "./spellcheckState";

const log = createLogger("Spellcheck");

export const spellcheckKey = new PluginKey<SpellcheckState>("spellcheck");

/** Délai d'inactivité avant de lancer une vérification (ms). */
const DEBOUNCE_MS = 250;
/** Nombre de blocs vérifiés par lot avant de rendre la main à l'UI. */
const BATCH_SIZE = 8;

interface SpellcheckState {
  /** Décorations de soulignage affichées. */
  decos: DecorationSet;
  /** Blocs à (re)vérifier — décorations inline invisibles, alignées par bloc. */
  dirty: DecorationSet;
}

interface CheckedRange {
  from: number;
  to: number;
}

interface SpellcheckMeta {
  /** Nouvelles décorations de soulignage (résultat d'un lot). */
  decorations?: DecorationSet;
  /** Plages de blocs vérifiées dans ce lot — à retirer de `dirty`. */
  checkedRanges?: CheckedRange[];
  /** Vide tout (désactivation). */
  clear?: boolean;
  /** Marque tout le document à vérifier (activation / chargement). */
  dirtyAll?: boolean;
}

interface BlockRef {
  node: ProsemirrorNode;
  pos: number;
}

/** Longueur en octets UTF-8 d'un point de code. */
function utf8Len(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/**
 * Espace réservé pour un nœud atome (formule inline) dans le texte envoyé à
 * Hugo. U+FFFC (object replacement character) : un jeton de ponctuation pour
 * le tokenizer Hugo, donc jamais vérifié en orthographe (mots seulement) ni
 * fusionné avec les espaces qui l'entourent (contrairement à un simple « rien »,
 * qui collerait les espaces avant/après en une seule suite → flag « espaces
 * surnuméraires »).
 */
const ATOM_PLACEHOLDER = "￼";
const ATOM_PLACEHOLDER_BYTE_LEN = utf8Len(ATOM_PLACEHOLDER.codePointAt(0) ?? 0);

interface ByteRange {
  start: number;
  end: number;
}

interface BlockText {
  /** Texte du bloc à envoyer à Hugo (formules remplacées par un espace réservé). */
  text: string;
  /** Table octet→position PM, indexée par offset d'octet UTF-8 dans `text`. */
  byteToPos: number[];
  /** Table octet→index de caractère (UTF-16) dans `text`. */
  byteToChar: number[];
  /** Plages (octets) des espaces réservés de formule, à exclure des suggestions. */
  atomByteRanges: ByteRange[];
}

/**
 * Aplatit un textblock en texte à plat pour Hugo, en construisant dans le même
 * parcours les tables de correspondance octet UTF-8 → position ProseMirror.
 * Fonction pure (aucun appel réseau/IPC) pour rester testable isolément.
 */
export function buildBlockText(
  block: ProsemirrorNode,
  blockPos: number
): BlockText {
  const byteToPos: number[] = [];
  const byteToChar: number[] = [];
  const atomByteRanges: ByteRange[] = [];
  let byteLen = 0;
  let charLen = 0;
  let text = "";
  let lastPmPos = blockPos + 1;

  block.descendants((node, relPos) => {
    if (node.isText && node.text) {
      let pmPos = blockPos + 1 + relPos;
      for (const ch of node.text) {
        byteToPos[byteLen] = pmPos;
        byteToChar[byteLen] = charLen;
        byteLen += utf8Len(ch.codePointAt(0) ?? 0);
        pmPos += ch.length; // longueur UTF-16 = taille PM du texte
        charLen += ch.length;
      }
      lastPmPos = pmPos;
      text += node.text;
    } else if (node.type.name === "hardbreak") {
      // Sépare les vers par un saut de ligne : Hugo traite chaque vers
      // comme une phrase distincte plutôt que de les concaténer.
      const pmPos = blockPos + 1 + relPos;
      byteToPos[byteLen] = pmPos;
      byteToChar[byteLen] = charLen;
      byteLen += 1; // '\n' = 1 octet UTF-8
      charLen += 1;
      text += "\n";
      lastPmPos = pmPos + 1;
    } else if (node.type.name === "inline_formula") {
      const pmPos = blockPos + 1 + relPos;
      byteToPos[byteLen] = pmPos;
      byteToChar[byteLen] = charLen;
      atomByteRanges.push({
        start: byteLen,
        end: byteLen + ATOM_PLACEHOLDER_BYTE_LEN,
      });
      byteLen += ATOM_PLACEHOLDER_BYTE_LEN;
      charLen += ATOM_PLACEHOLDER.length;
      text += ATOM_PLACEHOLDER;
      lastPmPos = pmPos + node.nodeSize;
    }
    return true;
  });
  byteToPos[byteLen] = lastPmPos; // sentinelle = fin du dernier caractère
  byteToChar[byteLen] = charLen;

  return { text, byteToPos, byteToChar, atomByteRanges };
}

/**
 * Construit les décorations de soulignage pour un textblock : envoie son texte
 * à Hugo et mappe les offsets d'octets UTF-8 vers des positions ProseMirror.
 */
async function decorateBlock(
  block: ProsemirrorNode,
  blockPos: number
): Promise<Decoration[]> {
  const { text, byteToPos, byteToChar, atomByteRanges } = buildBlockText(
    block,
    blockPos
  );

  if (text.trim().length === 0) return [];

  const rawSuggestions = await checkText(text);
  // Jamais de soulignage sur/autour d'une formule (déjà exclue de la vérif
  // grammaticale/orthographique par son espace réservé, cf. ATOM_PLACEHOLDER) :
  // une suggestion qui la recouvrirait rendrait le nœud atome non cliquable.
  const suggestions = rawSuggestions.filter(
    (s) => !atomByteRanges.some((r) => s.start < r.end && s.end > r.start)
  );
  const decos: Decoration[] = [];
  for (const s of suggestions) {
    const from = byteToPos[s.start];
    const to = byteToPos[s.end];
    if (from === undefined || to === undefined || from >= to) {
      log.warn("offsets hors limites, suggestion ignorée", { s, text });
      continue;
    }
    const category = categoryOf(s.ruleId);
    // Mot ignoré pour ce vault : on n'affiche pas la faute d'orthographe.
    if (category === "spelling" && ignoredWordsRef.current.size > 0) {
      const word = text.slice(byteToChar[s.start], byteToChar[s.end]);
      if (ignoredWordsRef.current.has(word.toLowerCase())) continue;
    }
    const cls = category === "spelling" ? "hugo-spell" : "hugo-grammar";
    decos.push(Decoration.inline(from, to, { class: cls }, { suggestion: s }));
  }
  return decos;
}

/** Plage de positions du document modifiée par une transaction (coords finales). */
function changedRange(tr: Transaction): CheckedRange | null {
  if (!tr.docChanged) return null;
  let from = Number.POSITIVE_INFINITY;
  let to = Number.NEGATIVE_INFINITY;
  const maps = tr.mapping.maps;
  maps.forEach((map, i) => {
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      let f = newStart;
      let t = newEnd;
      // Reporte dans les coordonnées du doc final en traversant les maps suivantes.
      for (let j = i + 1; j < maps.length; j++) {
        f = maps[j].map(f, -1);
        t = maps[j].map(t, 1);
      }
      from = Math.min(from, f);
      to = Math.max(to, t);
    });
  });
  if (!Number.isFinite(from)) return null;
  return { from, to };
}

/**
 * Décorations « dirty » (invisibles) couvrant chaque textblock intersectant
 * `[from, to]`. Alignées par bloc → consommables un bloc à la fois.
 */
function dirtyDecosForRange(
  doc: ProsemirrorNode,
  from: number,
  to: number
): Decoration[] {
  const out: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const end = pos + node.nodeSize;
    if (pos < to && end > from)
      out.push(Decoration.inline(pos, end, {}, { dirty: true }));
    return false;
  });
  return out;
}

/** Plage de positions actuellement visible dans le viewport. */
function viewportRange(
  view: EditorView,
  doc: ProsemirrorNode
): [number, number] {
  try {
    const rect = view.dom.getBoundingClientRect();
    const left = rect.left + 5;
    const top = Math.max(rect.top, 0) + 1;
    const bottom = Math.min(rect.bottom, window.innerHeight) - 1;
    const a = view.posAtCoords({ left, top });
    const b = view.posAtCoords({ left, top: bottom });
    const from = a ? a.pos : 0;
    const to = b ? b.pos : doc.content.size;
    return [Math.min(from, to), Math.max(from, to)];
  } catch {
    return [0, doc.content.size];
  }
}

/** Blocs intersectant les zones dirty, blocs visibles d'abord. */
function dirtyBlocks(
  view: EditorView,
  doc: ProsemirrorNode,
  dirty: DecorationSet
): BlockRef[] {
  const ranges = dirty.find();
  if (ranges.length === 0) return [];
  const blocks: BlockRef[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const end = pos + node.nodeSize;
    if (ranges.some((r) => r.from < end && r.to > pos))
      blocks.push({ node, pos });
    return false;
  });
  const [vpFrom, vpTo] = viewportRange(view, doc);
  const visible = (b: BlockRef) =>
    b.pos < vpTo && b.pos + b.node.nodeSize > vpFrom;
  blocks.sort((a, b) => {
    const av = visible(a) ? 0 : 1;
    const bv = visible(b) ? 0 : 1;
    return av !== bv ? av - bv : a.pos - b.pos;
  });
  return blocks;
}

export const spellcheckPlugin = $prose(() => {
  // État de debounce/anti-concurrence propre à l'instance du plugin.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;

  function scheduleWorker(view: EditorView) {
    if (running) return;
    clearTimeout(timer);
    timer = setTimeout(() => void runWorker(view), DEBOUNCE_MS);
  }

  /**
   * Vérifie les blocs dirty par lots (viewport d'abord), en rendant la main à
   * l'UI entre chaque lot. S'arrête si le document change (un nouveau passage
   * sera replanifié) ou si le correcteur est désactivé.
   */
  async function runWorker(view: EditorView) {
    if (running) return;
    running = true;
    try {
      while (spellcheckEnabledRef.current) {
        const st = spellcheckKey.getState(view.state);
        if (!st || st.dirty.find().length === 0) break;

        const doc = view.state.doc;
        const batch = dirtyBlocks(view, doc, st.dirty).slice(0, BATCH_SIZE);
        if (batch.length === 0) break;

        const results = await Promise.all(
          batch.map((b) => decorateBlock(b.node, b.pos))
        );
        // Doc modifié pendant l'appel : abandonne ce lot, le finally replanifiera.
        if (!view.state.doc.eq(doc)) break;

        let decos = st.decos;
        const checkedRanges: CheckedRange[] = [];
        batch.forEach((b, idx) => {
          const end = b.pos + b.node.nodeSize;
          decos = decos.remove(decos.find(b.pos, end)).add(doc, results[idx]);
          checkedRanges.push({ from: b.pos, to: end });
        });

        const meta: SpellcheckMeta = { decorations: decos, checkedRanges };
        view.dispatch(view.state.tr.setMeta(spellcheckKey, meta));
        log.info("lot vérifié", { blocs: batch.length });

        // Rend la main à l'UI avant le lot suivant.
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      running = false;
      const st = spellcheckKey.getState(view.state);
      if (spellcheckEnabledRef.current && st && st.dirty.find().length > 0) {
        scheduleWorker(view);
      }
    }
  }

  return new Plugin<SpellcheckState>({
    key: spellcheckKey,
    state: {
      // Marque tout le doc à vérifier dès la création : view().update lancera le
      // scan si le correcteur est activé, ou nettoiera sinon. Indépendant du
      // timing de montage de l'éditeur côté React.
      init: (_config, state) => ({
        decos: DecorationSet.empty,
        dirty: DecorationSet.create(
          state.doc,
          dirtyDecosForRange(state.doc, 0, state.doc.content.size)
        ),
      }),
      apply(tr, prev): SpellcheckState {
        const meta = tr.getMeta(spellcheckKey) as SpellcheckMeta | undefined;
        let decos = prev.decos.map(tr.mapping, tr.doc);
        let dirty = prev.dirty.map(tr.mapping, tr.doc);

        if (meta?.clear)
          return { decos: DecorationSet.empty, dirty: DecorationSet.empty };
        if (meta?.dirtyAll) {
          const all = dirtyDecosForRange(tr.doc, 0, tr.doc.content.size);
          return { decos, dirty: DecorationSet.create(tr.doc, all) };
        }
        if (meta?.decorations) {
          decos = meta.decorations;
          for (const r of meta.checkedRanges ?? []) {
            dirty = dirty.remove(dirty.find(r.from, r.to));
          }
          return { decos, dirty };
        }

        const cr = changedRange(tr);
        if (cr) {
          // Toute déco chevauchant l'édition est périmée (ex. correction appliquée,
          // ou frappe dans un mot souligné) : on la retire tout de suite. Le
          // re-check du bloc, marqué dirty ci-dessous, la recréera si l'erreur subsiste.
          decos = decos.remove(decos.find(cr.from, cr.to));
          dirty = dirty.add(tr.doc, dirtyDecosForRange(tr.doc, cr.from, cr.to));
        }
        return { decos, dirty };
      },
    },
    props: {
      decorations(state) {
        return spellcheckKey.getState(state)?.decos;
      },
    },
    view(editorView) {
      // ProseMirror n'appelle pas `update()` pour l'état initial : on amorce ici
      // le scan du document à l'ouverture (sinon il ne démarre qu'à la 1re frappe).
      const initSt = spellcheckKey.getState(editorView.state);
      if (
        spellcheckEnabledRef.current &&
        initSt &&
        initSt.dirty.find().length > 0
      )
        scheduleWorker(editorView);
      return {
        update(view) {
          const st = spellcheckKey.getState(view.state);
          if (!st) return;
          if (!spellcheckEnabledRef.current) {
            if (st.decos.find().length > 0 || st.dirty.find().length > 0) {
              view.dispatch(
                view.state.tr.setMeta(spellcheckKey, {
                  clear: true,
                } satisfies SpellcheckMeta)
              );
            }
            return;
          }
          if (st.dirty.find().length > 0) scheduleWorker(view);
        },
        destroy() {
          clearTimeout(timer);
        },
      };
    },
  });
});

/** Retourne la suggestion de correction à la position PM donnée, ou null. */
export function getSpellSuggestionAtPos(
  view: EditorView,
  pos: number
): {
  from: number;
  to: number;
  word: string;
  message: string;
  replacements: string[];
  category: "spelling" | "grammar";
} | null {
  const st = spellcheckKey.getState(view.state);
  if (!st) return null;
  const found = st.decos.find(pos, pos);
  if (found.length === 0) return null;
  const deco = found[0];
  const suggestion = deco.spec?.suggestion as HugoSuggestion | undefined;
  if (!suggestion) return null;
  return {
    from: deco.from,
    to: deco.to,
    word: view.state.doc.textBetween(deco.from, deco.to),
    message: suggestion.message,
    replacements: suggestion.replacements,
    category: categoryOf(suggestion.ruleId),
  };
}
