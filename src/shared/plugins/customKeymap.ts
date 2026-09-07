import { commandsCtx, schemaCtx } from "@milkdown/kit/core";
import {
  insertHardbreakCommand,
  insertHrCommand,
  toggleInlineCodeCommand,
  turnIntoTextCommand,
} from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import {
  joinBackward,
  lift,
  setBlockType,
  splitBlock,
  toggleMark,
  wrapIn,
} from "@milkdown/kit/prose/commands";
import { keymap } from "@milkdown/kit/prose/keymap";
import { Fragment } from "@milkdown/kit/prose/model";
import type {
  Mark,
  MarkType,
  Node as ProseNode,
  ResolvedPos,
} from "@milkdown/kit/prose/model";
import type { Schema } from "@milkdown/kit/prose/model";
import { liftListItem, wrapInList } from "@milkdown/kit/prose/schema-list";
import type { EditorState, Transaction } from "@milkdown/kit/prose/state";
import type { Command } from "@milkdown/kit/prose/state";
import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import { $command, $prose } from "@milkdown/kit/utils";
import { createLogger } from "../lib/logger";
import { defaultHighlightColorRef } from "./highlight/defaultColorRef";
import { setInlineFormulaEdit } from "./inline-formula/inlineFormulaState";
import { setWikilinkEdit } from "./wikilink/wikilinkEditState";

const log = createLogger("customKeymap");

// ── Helpers ────────────────────────────────────────────────────────────────

function isInNodeType(
  state: EditorState,
  schema: Schema,
  typeName: string
): boolean {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === schema.nodes[typeName]) return true;
  }
  return false;
}

function isInTaskList(state: EditorState, schema: Schema): boolean {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type === schema.nodes.list_item && node.attrs.checked !== null)
      return true;
  }
  return false;
}

// Curseur (vide) dans le paragraphe vide d'un list_item.
// Exportée : réutilisée par mobileListDeletePlugin pour rejouer la même
// logique quand le clavier virtuel contourne le keymap (cf. ce fichier).
export function isInEmptyListItem(state: EditorState, schema: Schema): boolean {
  const { $from, empty } = state.selection;
  if (!empty) return false;
  const parent = $from.parent;
  if (parent.type !== schema.nodes.paragraph || parent.content.size !== 0)
    return false;
  return $from.node(-1)?.type === schema.nodes.list_item;
}

// Cascade sur un item de liste vide : une seule étape par appel, partagée par
// Enter et Backspace.
//   1) todo → item de liste simple (retire `checked`, même profondeur)
//   2) liste simple imbriquée → dédentée d'un niveau (liftListItem)
//   3) liste simple de premier niveau → sort de la liste (paragraphe simple)
// On ne retombe JAMAIS sur le comportement natif (joinBackward via
// LiftFirstListItem) une fois qu'on a matché ce cas : ce fallback fusionne
// avec l'item précédent et peut corrompre son état `checked` (coche du
// dessus effacée par erreur).
export function stepOutOfEmptyListItem(schema: Schema): Command {
  return (state, dispatch) => {
    if (!isInEmptyListItem(state, schema)) return false;

    const { $from } = state.selection;
    const item = $from.node(-1);

    if (item.attrs.checked !== null) {
      if (dispatch) {
        const pos = $from.before(-1);
        dispatch(
          state.tr
            .setNodeMarkup(pos, undefined, { ...item.attrs, checked: null })
            .scrollIntoView()
        );
      }
      return true;
    }

    liftListItem(schema.nodes.list_item)(state, dispatch);
    return true;
  };
}

// Backspace en début d'item de liste NON vide (donc hors cascade
// stepOutOfEmptyListItem ci-dessus) : le joinBackward natif de ProseMirror
// fusionne l'item courant avec l'item précédent, mais peut réinitialiser
// l'attribut `checked` de ce dernier au passage (coche du dessus effacée par
// erreur — même symptôme que le cas vide, cf. commentaire plus haut). On
// laisse joinBackward faire son travail puis on restaure les `checked` de
// tous les list_item toujours présents après coup si le join les a altérés.
// Exportée : réutilisée par mobileListDeletePlugin (list-mobile-delete.ts).
export function safeJoinBackward(schema: Schema): Command {
  return (state, dispatch, view) => {
    const listItem = schema.nodes.list_item;
    if (!listItem) return joinBackward(state, dispatch, view);

    const before: { pos: number; checked: boolean | null }[] = [];
    state.doc.descendants((node, pos) => {
      if (node.type === listItem) {
        before.push({ pos, checked: node.attrs.checked });
      }
    });

    if (!dispatch) return joinBackward(state, undefined, view);

    let result: Transaction | null = null;
    const ok = joinBackward(
      state,
      (tr) => {
        result = tr;
      },
      view
    );
    if (!ok || !result) return ok;

    const tr = result as Transaction;
    for (const { pos, checked } of before) {
      const mapped = tr.mapping.mapResult(pos);
      if (mapped.deleted) continue;
      const node = tr.doc.nodeAt(mapped.pos);
      if (node?.type === listItem && node.attrs.checked !== checked) {
        tr.setNodeMarkup(mapped.pos, undefined, { ...node.attrs, checked });
      }
    }
    dispatch(tr);
    return true;
  };
}

function allBlocksAreHeading(
  state: EditorState,
  schema: Schema,
  level: number
): boolean {
  const headingType = schema.nodes.heading;
  const { from, to } = state.selection;
  let allMatch = true;
  state.doc.nodesBetween(from, to, (node) => {
    if (!node.isTextblock) return true;
    if (node.type !== headingType || node.attrs.level !== level)
      allMatch = false;
    return false;
  });
  return allMatch;
}

// Retourne une commande pour sortir de la structure courante, ou null si déjà en paragraphe.
function buildEscapeCommand(
  state: EditorState,
  schema: Schema
): Command | null {
  const { $from } = state.selection;

  // Priorité aux listes (la structure la plus imbriquée possible)
  for (let d = $from.depth; d > 0; d--) {
    const t = $from.node(d).type;
    if (t === schema.nodes.bullet_list || t === schema.nodes.ordered_list) {
      return liftListItem(schema.nodes.list_item);
    }
  }

  // Blockquote
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === schema.nodes.blockquote) return lift;
  }

  // Heading ou code_block → paragraphe
  const parent = $from.parent;
  if (
    parent.type === schema.nodes.heading ||
    parent.type === schema.nodes.code_block
  ) {
    return setBlockType(schema.nodes.paragraph);
  }

  return null;
}

// Compose deux commandes en une seule transaction.
// Les positions restent correctes car les steps du second cmd sont calculés
// sur le document intermédiaire (résultat du premier), et on les accumule
// séquentiellement sur la transaction combinée dont le doc suit le même chemin.
function applyThenApply(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  first: Command,
  second: Command
): boolean {
  // biome-ignore lint/suspicious/noExplicitAny: Transaction assigné synchronement dans le callback
  let firstTr: any = null;
  first(state, (tr) => {
    firstTr = tr;
  });
  if (!firstTr) return false;

  const intermediate = state.apply(firstTr as Transaction);
  // biome-ignore lint/suspicious/noExplicitAny: idem
  let secondTr: any = null;
  second(intermediate, (tr) => {
    secondTr = tr;
  });
  if (!secondTr) return false;

  if (dispatch) {
    const combined = state.tr;
    for (const step of (firstTr as Transaction).steps) combined.step(step);
    for (const step of (secondTr as Transaction).steps) combined.step(step);
    dispatch(combined);
  }
  return true;
}

// Wrapper générique pour tous les toggles : échappe d'abord si nécessaire, puis applique.
function applyWithEscape(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  schema: Schema,
  apply: Command
): boolean {
  if (apply(state, undefined)) return apply(state, dispatch);

  const escape = buildEscapeCommand(state, schema);
  if (!escape) return false;
  return applyThenApply(state, dispatch, escape, apply);
}

// Plage contiguë portant `markType` autour de `pos` (toutes couleurs/marques
// imbriquées confondues), ou null si `pos` n'est pas dans la marque.
function markRangeAround(
  doc: ProseNode,
  pos: number,
  markType: MarkType
): { from: number; to: number } | null {
  const has = (n: ProseNode | null | undefined) =>
    !!n && markType.isInSet(n.marks);
  const $pos = doc.resolve(pos);
  if (!has($pos.nodeBefore) && !has($pos.nodeAfter)) return null;

  let from = pos;
  let to = pos;
  for (;;) {
    const before = doc.resolve(from).nodeBefore;
    if (has(before) && before) from -= before.nodeSize;
    else break;
  }
  for (;;) {
    const after = doc.resolve(to).nodeAfter;
    if (has(after) && after) to += after.nodeSize;
    else break;
  }
  return { from, to };
}

// ── Commandes toggle exportées ─────────────────────────────────────────────

export const toggleBlockquoteCommand = $command(
  "ToggleBlockquote",
  (ctx) => () => (state, dispatch) => {
    const schema = ctx.get(schemaCtx);
    if (isInNodeType(state, schema, "blockquote")) return lift(state, dispatch);
    return applyWithEscape(
      state,
      dispatch,
      schema,
      wrapIn(schema.nodes.blockquote)
    );
  }
);

export const toggleBulletListCommand = $command(
  "ToggleBulletList",
  (ctx) => () => (state, dispatch) => {
    const schema = ctx.get(schemaCtx);
    if (
      isInNodeType(state, schema, "bullet_list") &&
      !isInTaskList(state, schema)
    ) {
      return liftListItem(schema.nodes.list_item)(state, dispatch);
    }
    return applyWithEscape(
      state,
      dispatch,
      schema,
      wrapInList(schema.nodes.bullet_list)
    );
  }
);

export const toggleOrderedListCommand = $command(
  "ToggleOrderedList",
  (ctx) => () => (state, dispatch) => {
    const schema = ctx.get(schemaCtx);
    if (isInNodeType(state, schema, "ordered_list")) {
      return liftListItem(schema.nodes.list_item)(state, dispatch);
    }
    return applyWithEscape(
      state,
      dispatch,
      schema,
      wrapInList(schema.nodes.ordered_list)
    );
  }
);

export const toggleTaskListCommand = $command(
  "ToggleTaskList",
  (ctx) => () => (state, dispatch) => {
    const schema = ctx.get(schemaCtx);
    if (isInTaskList(state, schema)) {
      return liftListItem(schema.nodes.list_item)(state, dispatch);
    }
    const wrapAsTask: Command = (s, d) =>
      wrapInList(schema.nodes.bullet_list)(s, (tr) => {
        tr.doc.nodesBetween(0, tr.doc.content.size, (node, pos) => {
          if (
            node.type === schema.nodes.list_item &&
            node.attrs.checked === null
          ) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: false });
          }
        });
        if (d) d(tr);
      });
    return applyWithEscape(state, dispatch, schema, wrapAsTask);
  }
);

export const toggleHeadingCommand = $command(
  "ToggleHeading",
  (ctx) => (payload: { level: number } | undefined) => (state, dispatch) => {
    const schema = ctx.get(schemaCtx);
    const level = payload?.level ?? 1;
    const headingType = schema.nodes.heading;
    const paragraphType = schema.nodes.paragraph;
    if (!headingType || !paragraphType) return false;

    if (allBlocksAreHeading(state, schema, level)) {
      return setBlockType(paragraphType)(state, dispatch);
    }

    const apply = setBlockType(headingType, { level });

    // setBlockType fonctionne directement sur les blocs texte, sauf depuis l'intérieur
    // d'une liste (où le nœud parent est list_item, pas document/blockquote).
    const inList =
      isInNodeType(state, schema, "bullet_list") ||
      isInNodeType(state, schema, "ordered_list");
    if (inList) {
      const escape = liftListItem(schema.nodes.list_item);
      return applyThenApply(state, dispatch, escape, apply);
    }

    // Pour blockquote : setBlockType fonctionne à l'intérieur d'un blockquote —
    // le heading reste dans le blockquote, ce qui est valide en Markdown.
    return apply(state, dispatch);
  }
);

export const toggleDidascalieInlineCommand = $command(
  "ToggleDidascalieInline",
  (ctx) => () => (state, dispatch) => {
    const schema = ctx.get(schemaCtx);
    const markType = schema.marks.didascalie_inline;
    if (!markType) return false;

    const { from, empty } = state.selection;

    // Curseur (vide) dans une didascalie : retirer la marque sur toute la plage.
    if (empty) {
      const range = markRangeAround(state.doc, from, markType);
      if (!range) return false;
      if (dispatch)
        dispatch(state.tr.removeMark(range.from, range.to, markType));
      return true;
    }

    // Sélection : toggle. addMark retire les marques exclues (excludes:"_").
    return toggleMark(markType)(state, dispatch);
  }
);

export const toggleHighlightInlineCommand = $command(
  "ToggleHighlightInline",
  (ctx) => (payload?: { color?: string }) => (state, dispatch) => {
    const schema = ctx.get(schemaCtx);
    const hlType = schema.marks.highlight_inline;
    if (!hlType) return false;

    const { from, to, empty } = state.selection;

    // Curseur (vide) dans un surlignage : retirer la marque sur toute la plage.
    if (empty) {
      const range = markRangeAround(state.doc, from, hlType);
      if (!range) return false;
      if (dispatch) dispatch(state.tr.removeMark(range.from, range.to, hlType));
      return true;
    }

    const hasMark = state.doc.rangeHasMark(from, to, hlType);
    // Déjà surligné + pas de couleur explicite → on retire (toggle off).
    if (hasMark && !payload?.color) {
      if (dispatch) dispatch(state.tr.removeMark(from, to, hlType));
      return true;
    }

    // Applique (ou re-colore) : on nettoie d'abord pour éviter le chevauchement.
    const color = payload?.color ?? defaultHighlightColorRef.current;
    if (dispatch) {
      const tr = state.tr
        .removeMark(from, to, hlType)
        .addMark(from, to, hlType.create({ color }));
      dispatch(tr);
    }
    log.info("highlight inline appliqué via commande", { color, from, to });
    return true;
  }
);

// ── Toggle poésie : alignement de la sélection sur des frontières de ligne ──
// Enter en mode poésie fusionne des vers dans un même paragraphe via des
// hardbreak (cf. keymap Enter plus bas) pour distinguer strophe (paragraphe,
// marge) et vers (hardbreak, serré). Mais wrapIn/lift natifs opèrent au grain
// du nœud paragraphe : une sélection partielle à l'intérieur d'une strophe
// fusionnée leur fait toggler TOUTE la strophe (voire tout le bloc si elle
// n'a qu'un seul paragraphe), pas seulement les vers sélectionnés. On scinde
// donc d'abord le(s) paragraphe(s) concerné(s) aux frontières de vers pour que
// wrapIn/lift n'agissent plus que sur la portion réellement sélectionnée.
// Sélection vide (curseur) : comportement inchangé, on cible toute la strophe.

function paragraphLines(schema: Schema, para: ProseNode): ProseNode[][] {
  const lines: ProseNode[][] = [[]];
  for (let i = 0; i < para.childCount; i++) {
    const child = para.child(i);
    if (child.type === schema.nodes.hardbreak) lines.push([]);
    else lines[lines.length - 1].push(child);
  }
  return lines;
}

function fragmentFromLines(schema: Schema, lines: ProseNode[][]): Fragment {
  const nodes: ProseNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) nodes.push(schema.nodes.hardbreak.create());
    nodes.push(...line);
  });
  return Fragment.fromArray(nodes);
}

// Positions absolues de début de chaque vers (starts[0] = début du contenu).
function computeLineStarts(
  schema: Schema,
  para: ProseNode,
  contentStart: number
): number[] {
  const starts = [contentStart];
  para.forEach((child, offset) => {
    if (child.type === schema.nodes.hardbreak) {
      starts.push(contentStart + offset + child.nodeSize);
    }
  });
  return starts;
}

function lineIndexForPos(starts: number[], pos: number): number {
  let idx = 0;
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] <= pos) idx = i;
    else break;
  }
  return idx;
}

function hasHardbreak(schema: Schema, node: ProseNode): boolean {
  for (let i = 0; i < node.childCount; i++) {
    if (node.child(i).type === schema.nodes.hardbreak) return true;
  }
  return false;
}

// Sélection entièrement dans une même strophe fusionnée : scinde en jusqu'à
// 3 paragraphes (vers avant / vers touchés / vers après) et retourne la
// sélection alignée sur les vers touchés.
function splitSingleParagraph(
  state: EditorState,
  schema: Schema,
  $from: ResolvedPos,
  $to: ResolvedPos
): Transaction {
  const para = $from.parent;
  const contentStart = $from.start();
  const starts = computeLineStarts(schema, para, contentStart);
  const startLineIdx = lineIndexForPos(starts, $from.pos);
  const endLineIdx = lineIndexForPos(starts, Math.max($from.pos, $to.pos - 1));

  const lines = paragraphLines(schema, para);
  const before = lines.slice(0, startLineIdx);
  const touched = lines.slice(startLineIdx, endLineIdx + 1);
  const after = lines.slice(endLineIdx + 1);

  const paragraphType = schema.nodes.paragraph;
  const paraStart = $from.before();
  const paraEnd = paraStart + para.nodeSize;

  const newNodes: ProseNode[] = [];
  if (before.length)
    newNodes.push(
      paragraphType.create(null, fragmentFromLines(schema, before))
    );
  const touchedNode = paragraphType.create(
    null,
    fragmentFromLines(schema, touched)
  );
  newNodes.push(touchedNode);
  if (after.length)
    newNodes.push(paragraphType.create(null, fragmentFromLines(schema, after)));

  const tr = state.tr.replaceWith(paraStart, paraEnd, newNodes);
  const touchedFrom =
    paraStart + (before.length ? newNodes[0].nodeSize : 0) + 1;
  const touchedTo = touchedFrom + touchedNode.content.size;
  tr.setSelection(TextSelection.create(tr.doc, touchedFrom, touchedTo));
  return tr;
}

// Sélection à cheval sur deux paragraphes distincts : scinde indépendamment
// chaque extrémité concernée (fin du 1er paragraphe touché, début du dernier),
// sans toucher aux paragraphes pleinement couverts entre les deux. Traite la
// fin d'abord (position la plus haute) pour que les positions du début restent
// valides, puis remappe la position de fin à travers les steps du début.
function splitParagraphEnds(
  state: EditorState,
  schema: Schema,
  $from: ResolvedPos,
  $to: ResolvedPos,
  needsStartSplit: boolean,
  needsEndSplit: boolean
): Transaction {
  const paragraphType = schema.nodes.paragraph;
  const tr = state.tr;

  let touchedToEnd = $to.pos;
  if (needsEndSplit) {
    const toPara = $to.parent;
    const contentStart = $to.start();
    const starts = computeLineStarts(schema, toPara, contentStart);
    const endLineIdx = lineIndexForPos(
      starts,
      Math.max(contentStart, $to.pos - 1)
    );
    const lines = paragraphLines(schema, toPara);
    const touched = lines.slice(0, endLineIdx + 1);
    const after = lines.slice(endLineIdx + 1);

    const nodeStart = $to.before();
    const nodeEnd = nodeStart + toPara.nodeSize;
    const touchedNode = paragraphType.create(
      null,
      fragmentFromLines(schema, touched)
    );
    const newNodes: ProseNode[] = [touchedNode];
    if (after.length)
      newNodes.push(
        paragraphType.create(null, fragmentFromLines(schema, after))
      );

    tr.replaceWith(nodeStart, nodeEnd, newNodes);
    touchedToEnd = nodeStart + 1 + touchedNode.content.size;
  }

  const stepsBeforeStartSplit = tr.mapping.maps.length;

  let touchedFromStart = $from.pos;
  if (needsStartSplit) {
    const fromPara = $from.parent;
    const contentStart = $from.start();
    const starts = computeLineStarts(schema, fromPara, contentStart);
    const startLineIdx = lineIndexForPos(starts, $from.pos);
    const lines = paragraphLines(schema, fromPara);
    const before = lines.slice(0, startLineIdx);
    const touched = lines.slice(startLineIdx);

    const nodeStart = $from.before();
    const nodeEnd = nodeStart + fromPara.nodeSize;
    const newNodes: ProseNode[] = [];
    if (before.length)
      newNodes.push(
        paragraphType.create(null, fragmentFromLines(schema, before))
      );
    newNodes.push(
      paragraphType.create(null, fragmentFromLines(schema, touched))
    );

    tr.replaceWith(nodeStart, nodeEnd, newNodes);
    touchedFromStart =
      nodeStart + (before.length ? newNodes[0].nodeSize : 0) + 1;
    touchedToEnd = tr.mapping.slice(stepsBeforeStartSplit).map(touchedToEnd);
  }

  tr.setSelection(TextSelection.create(tr.doc, touchedFromStart, touchedToEnd));
  return tr;
}

// Retourne la transaction de scission à appliquer avant wrapIn/lift, ou null
// si la sélection est déjà alignée sur des frontières de nœud (paragraphes
// séparés, sélection vide, ou couvrant déjà tout le paragraphe concerné) :
// le comportement natif wrapIn/lift s'applique alors sans modification.
function alignPoetrySelectionToLines(
  state: EditorState,
  schema: Schema
): Transaction | null {
  if (!schema.nodes.hardbreak || !schema.nodes.paragraph) return null;

  const { $from, $to, empty } = state.selection;
  if (empty) return null;

  const paragraphType = schema.nodes.paragraph;
  const fromPara = $from.parent;
  const toPara = $to.parent;

  const needsStartSplit =
    fromPara.type === paragraphType &&
    hasHardbreak(schema, fromPara) &&
    $from.parentOffset > 0;

  const needsEndSplit =
    toPara.type === paragraphType &&
    hasHardbreak(schema, toPara) &&
    $to.parentOffset < toPara.content.size;

  if (!needsStartSplit && !needsEndSplit) return null;

  if ($from.sameParent($to)) {
    return splitSingleParagraph(state, schema, $from, $to);
  }

  return splitParagraphEnds(
    state,
    schema,
    $from,
    $to,
    needsStartSplit,
    needsEndSplit
  );
}

export const togglePoetryCommand = $command(
  "TogglePoetry",
  (ctx) => () => (state, dispatch) => {
    const schema = ctx.get(schemaCtx);
    const poetryType = schema.nodes.poetry_block;
    if (!poetryType) return false;

    const alignTr = alignPoetrySelectionToLines(state, schema);
    const workingState = alignTr ? state.apply(alignTr) : state;

    const finalCmd: Command = isInNodeType(workingState, schema, "poetry_block")
      ? lift
      : (s, d) => applyWithEscape(s, d, schema, wrapIn(poetryType));

    if (!dispatch) return finalCmd(workingState, undefined);
    if (!alignTr) return finalCmd(state, dispatch);

    let resultTr: Transaction | null = null;
    if (
      !finalCmd(workingState, (tr) => {
        resultTr = tr;
      })
    )
      return false;
    if (!resultTr) return false;

    const combined = state.tr;
    for (const step of alignTr.steps) combined.step(step);
    for (const step of (resultTr as Transaction).steps) combined.step(step);
    dispatch(combined.scrollIntoView());
    log.info("toggle poésie aligné sur les vers sélectionnés");
    return true;
  }
);

export const toggleCodeBlockCommand = $command(
  "ToggleCodeBlock",
  (ctx) => () => (state, dispatch) => {
    const schema = ctx.get(schemaCtx);
    const codeBlockType = schema.nodes.code_block;
    if (!codeBlockType) return false;

    if (state.selection.$from.parent.type === codeBlockType) {
      return setBlockType(schema.nodes.paragraph)(state, dispatch);
    }

    return applyWithEscape(
      state,
      dispatch,
      schema,
      setBlockType(codeBlockType, { language: "" })
    );
  }
);

export const toggleLinkWithPromptCommand = $command(
  "ToggleLinkWithPrompt",
  (ctx) => () => (state, dispatch) => {
    const schema = ctx.get(schemaCtx);
    const linkMark = schema.marks.link;
    if (!linkMark) return false;

    const { $from, from, to, empty } = state.selection;

    // Curseur dans un lien → supprimer le mark sur toute son étendue dans le bloc
    if (empty && linkMark.isInSet($from.marks())) {
      const parentStart = $from.start();
      let linkStart = from;
      let linkEnd = from;
      $from.parent.forEach((node, offset) => {
        if (node.isText && linkMark.isInSet(node.marks)) {
          const absStart = parentStart + offset;
          const absEnd = absStart + node.nodeSize;
          if (absStart <= from && absEnd >= from) {
            linkStart = absStart;
            linkEnd = absEnd;
          }
        }
      });
      if (dispatch) dispatch(state.tr.removeMark(linkStart, linkEnd, linkMark));
      log.info("lien supprimé", { linkStart, linkEnd });
      return true;
    }

    // Sélection contenant un lien → supprimer le mark
    if (!empty && state.doc.rangeHasMark(from, to, linkMark)) {
      if (dispatch) dispatch(state.tr.removeMark(from, to, linkMark));
      log.info("lien supprimé sur sélection", { from, to });
      return true;
    }

    // Sinon → ouvre le popup d'édition de lien (note ou URL).
    // Sélection : son texte devient l'alias proposé. Curseur vide : insertion.
    // Pas de coords : le popup recalcule l'ancre (et scrolle la cible si hors vue).
    if (dispatch) {
      const selectedText = empty ? "" : state.doc.textBetween(from, to, " ");
      setWikilinkEdit({
        range: { from, to },
        initialQuery: "",
        initialAlias: selectedText,
      });
      log.info("popup d'édition de lien ouvert", { from, to });
    }
    return true;
  }
);

// ── Sortie du bloc de poésie ───────────────────────────────────────────────
// Supprime les paragraphes vides en queue du bloc et insère un paragraphe après.
function exitPoetryBlock(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  schema: Schema,
  poetryDepth: number,
  firstEmptyIdx: number
): boolean {
  if (!dispatch) return true;

  const { $from } = state.selection;
  const poetryNode = $from.node(poetryDepth);
  const poetryStart = $from.before(poetryDepth);
  const poetryEnd = poetryStart + poetryNode.nodeSize;
  const tr = state.tr;

  if (firstEmptyIdx === 0) {
    // Tout le bloc est vide → le remplacer par un paragraphe vide
    tr.replaceWith(poetryStart, poetryEnd, schema.nodes.paragraph.create());
    tr.setSelection(TextSelection.near(tr.doc.resolve(poetryStart + 1)));
  } else {
    // Calculer la position du premier paragraphe vide en queue
    let deleteFrom = poetryStart + 1;
    for (let i = 0; i < firstEmptyIdx; i++)
      deleteFrom += poetryNode.child(i).nodeSize;

    const blockContentEnd = poetryEnd - 1; // avant le token fermant du bloc
    tr.delete(deleteFrom, blockContentEnd);
    const newEnd = poetryEnd - (blockContentEnd - deleteFrom);
    tr.insert(newEnd, schema.nodes.paragraph.create());
    tr.setSelection(TextSelection.near(tr.doc.resolve(newEnd + 1)));
  }

  dispatch(tr.scrollIntoView());
  log.info("sortie bloc poésie par triple Entrée");
  return true;
}

// ── Keymap (event.key) ─────────────────────────────────────────────────────

export const customKeymapPlugin = $prose((ctx) =>
  keymap({
    // Bloc de poésie :
    // - Enter en fin de paragraphe sans hardbreak final + sibling suivant non-vide
    //   → fusion des deux paragraphes avec un hardbreak (conversion format séparé → strophe).
    // - Enter en fin de paragraphe avec hardbreak final (double Enter)
    //   → insertHardbreakCommand détecte la queue et crée un nouveau paragraphe (séparateur de strophe).
    // - Enter en milieu de paragraphe → hardbreak à la position du curseur.
    // - Triple Enter sur paragraphe vide en fin de bloc → sortie + nettoyage.
    // Hors bloc de poésie : item vide → sortie de liste.
    Enter: (state, dispatch) => {
      const { schema } = state;

      if (
        schema.nodes.poetry_block &&
        isInNodeType(state, schema, "poetry_block")
      ) {
        const { $from, empty } = state.selection;
        const parent = $from.parent;

        if (
          parent.type === schema.nodes.paragraph &&
          parent.content.size === 0
        ) {
          // Paragraphe vide : cherche si c'est le dernier (ou suivi uniquement de vides)
          let poetryDepth = -1;
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type === schema.nodes.poetry_block) {
              poetryDepth = d;
              break;
            }
          }
          if (poetryDepth >= 0) {
            const poetryNode = $from.node(poetryDepth);
            const idx = $from.index(poetryDepth);
            let trailingOnly = true;
            for (let k = idx + 1; k < poetryNode.childCount; k++) {
              const c = poetryNode.child(k);
              if (
                !(c.type === schema.nodes.paragraph && c.content.size === 0)
              ) {
                trailingOnly = false;
                break;
              }
            }
            if (trailingOnly)
              return exitPoetryBlock(state, dispatch, schema, poetryDepth, idx);
          }
        }

        // Curseur en fin de paragraphe non-vide, dernier enfant = texte (pas hardbreak) :
        // fusionner avec le paragraphe suivant non-vide en intercalant un hardbreak.
        // Ceci convertit le format "un paragraphe par vers" en "strophe avec hardbreaks".
        if (
          empty &&
          parent.type === schema.nodes.paragraph &&
          parent.content.size > 0 &&
          $from.parentOffset === parent.content.size &&
          parent.lastChild?.type.name !== "hardbreak"
        ) {
          let poetryDepth = -1;
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type === schema.nodes.poetry_block) {
              poetryDepth = d;
              break;
            }
          }
          if (poetryDepth >= 0) {
            const poetryNode = $from.node(poetryDepth);
            const idx = $from.index(poetryDepth);
            if (idx + 1 < poetryNode.childCount) {
              const nextPara = poetryNode.child(idx + 1);
              if (
                nextPara.type === schema.nodes.paragraph &&
                nextPara.content.size > 0
              ) {
                if (dispatch) {
                  const hardbreak = schema.nodes.hardbreak.create();
                  const insertPos = $from.end();
                  const insertContent = Fragment.from(hardbreak).append(
                    nextPara.content
                  );
                  const tr = state.tr;
                  tr.insert(insertPos, insertContent);
                  // $from.end() = avant le token fermant ; +1 = après le token fermant = début du sibling
                  const nextParaStart = $from.end() + 1 + insertContent.size;
                  tr.delete(nextParaStart, nextParaStart + nextPara.nodeSize);
                  // Curseur en fin du paragraphe fusionné
                  tr.setSelection(
                    TextSelection.near(
                      tr.doc.resolve(insertPos + insertContent.size)
                    )
                  );
                  dispatch(tr.scrollIntoView());
                  log.info("fusion vers poésie avec hardbreak", { idx });
                }
                return true;
              }
            }
          }
        }

        ctx.get(commandsCtx).call(insertHardbreakCommand.key);
        return true;
      }

      if (!isInEmptyListItem(state, schema)) return false;
      return stepOutOfEmptyListItem(schema)(state, dispatch);
    },
    // Shift+Enter dans un bloc de poésie : nouvelle strophe directe (splitBlock).
    // Hors bloc : comportement Milkdown par défaut (hardbreak).
    "Shift-Enter": (state, dispatch) => {
      const { schema } = state;
      if (
        !schema.nodes.poetry_block ||
        !isInNodeType(state, schema, "poetry_block")
      )
        return false;
      return splitBlock(state, dispatch);
    },
    // Backspace sur item vide → cascade (cf. stepOutOfEmptyListItem), au lieu
    // du joinBackward natif qui empile un 2e paragraphe dans l'item précédent
    // ou peut corrompre l'item voisin. Item non vide en tout début → fusion
    // protégée (cf. safeJoinBackward) pour ne pas perdre la coche de l'item
    // précédent.
    Backspace: (state, dispatch, view) => {
      const { schema } = state;
      if (stepOutOfEmptyListItem(schema)(state, dispatch)) return true;

      const { $from, empty } = state.selection;
      if (
        empty &&
        $from.parentOffset === 0 &&
        $from.node(-1)?.type === schema.nodes.list_item
      ) {
        return safeJoinBackward(schema)(state, dispatch, view);
      }
      return false;
    },
    // Marks (Mod-b, Mod-i déjà natifs dans le preset)
    "Mod-e": () => ctx.get(commandsCtx).call(toggleInlineCodeCommand.key),
    "Mod-Shift-s": () =>
      ctx.get(commandsCtx).call(toggleStrikethroughCommand.key),
    // Structures

    "Mod-Shift-7": () =>
      ctx.get(commandsCtx).call(toggleOrderedListCommand.key),
    "Mod-Shift-8": () => ctx.get(commandsCtx).call(toggleBulletListCommand.key),
    "Mod-Shift-9": () => ctx.get(commandsCtx).call(toggleTaskListCommand.key),
    "Mod-Shift-h": () => ctx.get(commandsCtx).call(insertHrCommand.key),
    "Mod-Shift-b": () => ctx.get(commandsCtx).call(toggleBlockquoteCommand.key),
    "Mod-Shift-e": () => ctx.get(commandsCtx).call(toggleCodeBlockCommand.key),
    "Mod-Shift-p": () => ctx.get(commandsCtx).call(togglePoetryCommand.key),
    "Mod-d": () => ctx.get(commandsCtx).call(toggleDidascalieInlineCommand.key),
    "Mod-Shift-l": () =>
      ctx.get(commandsCtx).call(toggleHighlightInlineCommand.key),
  })
);

// ── Atteignabilité des slots de saisie aux bords des marques « à boîte » ────
// inlineCode/didascalie/highlight ont un décalage horizontal visuel (padding,
// pipes CSS). Selon l'inclusivité, certains slots de saisie aux bords sont
// cachés : inlineCode (inclusive) piège « dedans » à droite et « dehors » à
// gauche ; didascalie/highlight (non-inclusives) cachent les deux slots
// « dedans » (avant le 1er car., après le dernier). On les rend atteignables en
// basculant les stored marks au franchissement d'un bord — caret immobile, 2e
// flèche = navigation. ArrowRight regarde le contenu suivant, ArrowLeft le
// précédent. Cf. caretSide (customCaretPlugin) pour le rendu correspondant.
const BOX_MARK_NAMES = ["inlineCode", "didascalie_inline", "highlight_inline"];

// Retourne les stored marks ajustées si le curseur est au bord d'une boîte
// (appartenance différente entre l'effectif et le voisin), sinon null.
function crossBoxEdge(
  state: EditorState,
  neighbor: ProseNode | null | undefined
): readonly Mark[] | null {
  let next = state.storedMarks ?? state.selection.$from.marks();
  let crossed = false;
  for (const name of BOX_MARK_NAMES) {
    const type = state.schema.marks[name];
    if (!type) continue;
    const effMark = type.isInSet(next);
    const neighborMark = neighbor ? type.isInSet(neighbor.marks) : undefined;
    if (!!effMark === !!neighborMark) continue; // pas un bord de cette boîte
    crossed = true;
    // On adopte l'appartenance du voisin : entrer (avec ses attrs) ou sortir.
    next = neighborMark
      ? neighborMark.addToSet(next)
      : (effMark as Mark).removeFromSet(next);
  }
  return crossed ? next : null;
}

export const escapeInlineMarksPlugin = $prose(() =>
  keymap({
    ArrowRight: (state, dispatch, view) => {
      const sel = state.selection;
      if (!sel.empty) return false;
      const $cursor = (sel as TextSelection).$cursor;
      if (!$cursor) return false;

      const crossed = crossBoxEdge(state, $cursor.nodeAfter);
      if (crossed) {
        if (dispatch) dispatch(state.tr.setStoredMarks([...crossed]));
        return true;
      }

      // Fin de bloc : échappement des autres marques inclusives (gras/italique…).
      const marks = state.storedMarks ?? $cursor.marks();
      if (view?.endOfTextblock("forward") && marks.length > 0) {
        if (dispatch) dispatch(state.tr.setStoredMarks([]));
        return true;
      }
      return false;
    },
    ArrowLeft: (state, dispatch) => {
      const sel = state.selection;
      if (!sel.empty) return false;
      const $cursor = (sel as TextSelection).$cursor;
      if (!$cursor) return false;

      const crossed = crossBoxEdge(state, $cursor.nodeBefore);
      if (crossed) {
        if (dispatch) dispatch(state.tr.setStoredMarks([...crossed]));
        return true;
      }
      return false;
    },
  })
);

// ── Marque « à boîte » collante pendant la saisie au bord droit ────────────
// Les marques non-inclusives (didascalie/highlight) sont abandonnées après
// chaque caractère tapé en bout de boîte → le caret est éjecté dehors et il faut
// re-rentrer à chaque frappe. Après une frappe qui porte la marque au bord droit
// (caractère précédent = boîte, suivant = hors boîte), on remet la marque dans
// les stored marks pour rester dedans jusqu'à l'échappement explicite par `→`
// (crossBoxEdge). inlineCode est inclusive → collante nativement, on l'ignore.
export const stickyInlineBoxPlugin = $prose(
  () =>
    new Plugin({
      appendTransaction(trs, oldState, newState) {
        if (!trs.some((tr) => tr.docChanged)) return null;
        const sel = newState.selection;
        if (!sel.empty) return null;
        const before = sel.$from.nodeBefore;
        if (!before) return null;
        const after = sel.$from.nodeAfter;
        // La marque doit avoir été active AVANT la frappe : on n'étend (collant)
        // qu'une boîte où l'on tapait déjà. Sinon on piège l'utilisateur juste
        // après l'avoir créée (ex. input-rule `||x||` en fin de ligne).
        const wasActive =
          oldState.storedMarks ?? oldState.selection.$from.marks();
        for (const name of BOX_MARK_NAMES) {
          const type = newState.schema.marks[name];
          if (!type || type.spec.inclusive !== false) continue;
          if (!type.isInSet(wasActive)) continue; // pas déjà dedans → on ne colle pas
          const beforeMark = type.isInSet(before.marks);
          if (!beforeMark) continue; // le caractère tapé ne porte pas la boîte
          if (after && type.isInSet(after.marks)) continue; // milieu de boîte
          if (newState.storedMarks && type.isInSet(newState.storedMarks))
            return null; // déjà collante
          return newState.tr.setStoredMarks(
            beforeMark.addToSet(newState.storedMarks ?? sel.$from.marks())
          );
        }
        return null;
      },
    })
);

// ── Keymap (event.code) ────────────────────────────────────────────────────
// Tous les raccourcis sensibles au layout clavier.
// Sur AZERTY macOS : Cmd+Option+chiffre → event.key spécial (#, {, [) ;
// Cmd+² (touche Backquote) → event.key "²" au lieu de "`".
// event.code est la position physique, indépendante du layout.

const codeShortcutsKey = new PluginKey("codeBasedShortcuts");

export const codeBasedShortcutsPlugin = $prose(
  (ctx) =>
    new Plugin({
      key: codeShortcutsKey,
      props: {
        handleKeyDown(_view, event) {
          const isMod = event.metaKey || event.ctrlKey;
          if (!isMod) return false;

          const commands = ctx.get(commandsCtx);

          // Mod+Alt (sans Shift) : paragraphe, titres
          if (event.altKey && !event.shiftKey) {
            const digitLevel: Record<string, number> = {
              Digit0: 0,
              Digit1: 1,
              Digit2: 2,
              Digit3: 3,
              Digit4: 4,
              Digit5: 5,
              Digit6: 6,
            };
            if (event.code in digitLevel) {
              event.preventDefault();
              const level = digitLevel[event.code];
              if (level === 0) {
                commands.call(turnIntoTextCommand.key);
              } else {
                commands.call(toggleHeadingCommand.key, { level });
              }
              return true;
            }
          }

          // Mod+Shift : poésie (KeyP)
          if (!event.altKey && event.shiftKey && event.code === "KeyP") {
            event.preventDefault();
            commands.call(togglePoetryCommand.key);
            return true;
          }

          // Mod (sans Shift) : didascalie inline (KeyD)
          if (!event.altKey && !event.shiftKey && event.code === "KeyD") {
            event.preventDefault();
            commands.call(toggleDidascalieInlineCommand.key);
            return true;
          }

          // Mod+Shift : surlignage (KeyL)
          if (!event.altKey && event.shiftKey && event.code === "KeyL") {
            event.preventDefault();
            commands.call(toggleHighlightInlineCommand.key);
            return true;
          }

          // Mod+Shift : formule inline (KeyF)
          if (!event.altKey && event.shiftKey && event.code === "KeyF") {
            event.preventDefault();
            const state = _view.state;
            const type = ctx.get(schemaCtx).nodes.inline_formula;
            if (type && !state.selection.$from.parent.type.spec.code) {
              const pos = state.selection.$from.pos;
              _view.dispatch(state.tr.insert(pos, type.create()));
              const coords = _view.coordsAtPos(pos);
              setInlineFormulaEdit({
                pos,
                raw: "$$$$",
                coords: {
                  left: coords.left,
                  top: coords.top,
                  bottom: coords.bottom,
                },
              });
            }
            return true;
          }

          // Mod+Shift : lien (KeyK)
          if (!event.altKey && event.shiftKey && event.code === "KeyK") {
            log.info("lien déclenché via raccourci");
            event.preventDefault();
            commands.call(toggleLinkWithPromptCommand.key);
            return true;
          }
          // Mod+Shift : bloc de code (KeyE)
          if (event.code === "KeyE") {
            event.preventDefault();
            commands.call(toggleCodeBlockCommand.key);
            return true;
          }

          return false;
        },
      },
    })
);
