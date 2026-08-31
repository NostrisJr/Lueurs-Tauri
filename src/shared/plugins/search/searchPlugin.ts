/**
 * searchPlugin.ts
 *
 * Recherche/remplacement dans le corps de note (Cmd+F "de base"). Sur le modèle
 * de wordHighlightPlugin (décorations par scan plein-texte des nœuds texte) et
 * de spellcheckPlugin (état de plugin piloté par meta, recalculé sur docChanged).
 *
 * Limite connue (comme wordHighlightPlugin) : une occurrence ne peut pas
 * traverser une frontière de marque (gras/italique/lien…) car chaque nœud texte
 * est scanné indépendamment.
 */

import type {
  Node as ProsemirrorNode,
  Schema,
} from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { Transaction } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { createLogger } from "../../lib/logger";
import { setSearchMatches } from "./searchState";

const log = createLogger("Search");

interface Match {
  from: number;
  to: number;
}

interface SearchPluginState {
  query: string;
  caseSensitive: boolean;
  matches: Match[];
  activeIndex: number;
  decorations: DecorationSet;
}

interface SearchMeta {
  /** (Re)lance la recherche : réinitialise l'occurrence active sur la première. */
  query?: { text: string; caseSensitive: boolean };
  /** Change uniquement l'occurrence active (navigation), sans changer la requête. */
  setActive?: number;
}

export const searchKey = new PluginKey<SearchPluginState>("search");

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatches(
  doc: ProsemirrorNode,
  query: string,
  caseSensitive: boolean
): Match[] {
  if (!query) return [];
  const results: Match[] = [];
  const re = new RegExp(escapeRegex(query), caseSensitive ? "g" : "gi");
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(node.text)) !== null) {
      results.push({ from: pos + m.index, to: pos + m.index + query.length });
    }
  });
  return results;
}

function buildState(
  doc: ProsemirrorNode,
  query: string,
  caseSensitive: boolean,
  activeIndex: number
): SearchPluginState {
  const matches = findMatches(doc, query, caseSensitive);
  const clampedActive =
    matches.length === 0
      ? -1
      : Math.min(Math.max(activeIndex, 0), matches.length - 1);
  const decos = matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class:
        i === clampedActive
          ? "search-match search-match-active"
          : "search-match",
    })
  );
  return {
    query,
    caseSensitive,
    matches,
    activeIndex: clampedActive,
    decorations: DecorationSet.create(doc, decos),
  };
}

export const searchPlugin = $prose(
  () =>
    new Plugin<SearchPluginState>({
      key: searchKey,
      state: {
        init: (_config, state) => buildState(state.doc, "", false, -1),
        apply(tr, prevState, _oldState, newState) {
          const meta = tr.getMeta(searchKey) as SearchMeta | undefined;
          if (meta?.query !== undefined) {
            return buildState(
              newState.doc,
              meta.query.text,
              meta.query.caseSensitive,
              0
            );
          }
          if (meta?.setActive !== undefined) {
            return buildState(
              newState.doc,
              prevState.query,
              prevState.caseSensitive,
              meta.setActive
            );
          }
          if (tr.docChanged && prevState.query) {
            return buildState(
              newState.doc,
              prevState.query,
              prevState.caseSensitive,
              prevState.activeIndex
            );
          }
          return prevState;
        },
      },
      props: {
        decorations(state) {
          return searchKey.getState(state)?.decorations ?? null;
        },
      },
    })
);

function syncModuleState(view: EditorView) {
  const s = searchKey.getState(view.state);
  if (!s) return;
  setSearchMatches(s.activeIndex, s.matches.length);
  return s;
}

/** Position (`from`) de l'occurrence active, pour que l'appelant la scrolle
 * dans la vue (cf. scrollPosIntoViewLikeEditing, appelé côté SearchBar —
 * le scroll natif ProseMirror n'a pas les marges du header fixe de l'app). */
export function getActiveMatchFrom(view: EditorView): number | null {
  const s = searchKey.getState(view.state);
  if (!s || s.activeIndex < 0) return null;
  return s.matches[s.activeIndex].from;
}

/** (Re)lance la recherche — appelé à chaque frappe dans le champ requête. */
export function runSearch(
  view: EditorView,
  query: string,
  caseSensitive: boolean
) {
  view.dispatch(
    view.state.tr.setMeta(searchKey, { query: { text: query, caseSensitive } })
  );
  const s = syncModuleState(view);
  log.info("recherche relancée", { query, count: s?.matches.length ?? 0 });
}

/** Vide la recherche (fermeture de la barre) — retire les décorations. */
export function clearSearch(view: EditorView) {
  runSearch(view, "", false);
}

/** Occurrence suivante (+1) ou précédente (-1). */
export function searchStep(view: EditorView, direction: 1 | -1) {
  const cur = searchKey.getState(view.state);
  if (!cur || cur.matches.length === 0) return;
  const nextIndex =
    (cur.activeIndex + direction + cur.matches.length) % cur.matches.length;
  view.dispatch(view.state.tr.setMeta(searchKey, { setActive: nextIndex }));
  syncModuleState(view);
}

// tr.insertText infère les marques depuis la position `from`, ambiguë à la
// frontière d'une marque : en plein milieu d'un passage surligné ça prend le
// surlignage, mais au tout début (remplacement de l'occurrence en entier) ça
// prend ce qui précède (non surligné) → le surlignage disparaît. Le match est
// toujours contenu dans un seul nœud texte (limite du scan, cf. plus haut) :
// on peut donc lire ses marques directement et les réappliquer explicitement.
function replaceMatchText(
  tr: Transaction,
  schema: Schema,
  m: Match,
  replacement: string
) {
  if (!replacement) return tr.delete(m.from, m.to);
  const marks = tr.doc.resolve(m.from).nodeAfter?.marks ?? [];
  return tr.replaceWith(m.from, m.to, schema.text(replacement, marks));
}

/** Remplace l'occurrence active, puis recalcule (le doc a changé). */
export function replaceCurrentMatch(view: EditorView, replacement: string) {
  const cur = searchKey.getState(view.state);
  if (!cur || cur.activeIndex < 0) return;
  const m = cur.matches[cur.activeIndex];
  view.dispatch(
    replaceMatchText(view.state.tr, view.state.schema, m, replacement)
  );
  syncModuleState(view);
  log.info("occurrence remplacée", { from: m.from, to: m.to });
}

/** Remplace toutes les occurrences en une seule transaction. */
export function replaceAllMatches(
  view: EditorView,
  query: string,
  caseSensitive: boolean,
  replacement: string
) {
  const matches = findMatches(view.state.doc, query, caseSensitive);
  if (matches.length === 0) return;
  let tr = view.state.tr;
  // De la dernière à la première occurrence : les positions des occurrences
  // encore à traiter (plus tôt dans le doc) restent valides tout du long.
  for (let i = matches.length - 1; i >= 0; i--) {
    tr = replaceMatchText(tr, view.state.schema, matches[i], replacement);
  }
  view.dispatch(tr);
  syncModuleState(view);
  log.info("toutes les occurrences remplacées", { count: matches.length });
}
