/**
 * editorCommands.ts — Commandes impératives de l'éditeur Milkdown.
 *
 * Chaque fonction accepte un EditorRef et effectue la commande correspondante.
 * Permet d'appeler les commandes depuis n'importe quel composant (toolbar, raccourcis,
 * injection audio…) sans passer par useImperativeHandle.
 */
import type { Editor } from "@milkdown/kit/core";
import { commandsCtx, editorViewCtx, schemaCtx } from "@milkdown/kit/core";
import {
  toggleInlineCodeCommand,
  turnIntoTextCommand,
} from "@milkdown/kit/preset/commonmark";
import { toggleMark } from "@milkdown/kit/prose/commands";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { liftListItem, sinkListItem } from "prosemirror-schema-list";
import { redo, undo } from "prosemirror-history";
import {
  toggleBlockquoteCommand,
  toggleBulletListCommand,
  toggleCodeBlockCommand,
  toggleDidascalieInlineCommand,
  toggleHighlightInlineCommand,
  toggleOrderedListCommand,
  togglePoetryCommand,
  toggleTaskListCommand,
} from "../../../plugins/customKeymap";
import { setInlineFormulaEdit } from "../../../plugins/inline-formula/inlineFormulaState";
import type { CmdKey } from "@milkdown/kit/core";

export type EditorRef = { current: Editor | null };

// Raccourci pour appeler une commande milkdown et refocaliser la vue.
// biome-ignore lint/suspicious/noExplicitAny: CmdKey est paramétré sur T inconnu à ce site d'appel
function callCmd(editorRef: EditorRef, key: CmdKey<any>) {
  editorRef.current?.action((ctx) => {
    ctx.get(commandsCtx).call(key);
    ctx.get(editorViewCtx).focus();
  });
}

export function editorUndo(editorRef: EditorRef) {
  editorRef.current?.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    undo(view.state, view.dispatch);
    view.focus();
  });
}

export function editorRedo(editorRef: EditorRef) {
  editorRef.current?.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    redo(view.state, view.dispatch);
    view.focus();
  });
}

export function editorBold(editorRef: EditorRef) {
  editorRef.current?.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const schema = ctx.get(schemaCtx);
    const mark = schema.marks.strong;
    if (!mark) return;
    toggleMark(mark)(view.state, view.dispatch);
    view.focus();
  });
}

export function editorItalic(editorRef: EditorRef) {
  editorRef.current?.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const schema = ctx.get(schemaCtx);
    const mark = schema.marks.emphasis;
    if (!mark) return;
    toggleMark(mark)(view.state, view.dispatch);
    view.focus();
  });
}

export function editorStrike(editorRef: EditorRef) {
  editorRef.current?.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const schema = ctx.get(schemaCtx);
    const mark = schema.marks.strike_through ?? schema.marks.strikethrough;
    if (!mark) return;
    toggleMark(mark)(view.state, view.dispatch);
    view.focus();
  });
}

export function editorHeading(
  editorRef: EditorRef,
  level: 1 | 2 | 3 | 4 | 5 | 6
) {
  editorRef.current?.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const schema = ctx.get(schemaCtx);
    const headingType = schema.nodes.heading;
    if (!headingType) return;
    const { state, dispatch } = view;
    const { $from, $to } = state.selection;
    const range = $from.blockRange($to);
    if (!range) return;
    dispatch(
      state.tr.setBlockType(range.start, range.end, headingType, { level })
    );
    view.focus();
  });
}

export function editorParagraph(editorRef: EditorRef) {
  callCmd(editorRef, turnIntoTextCommand.key);
}

export function editorInlineCode(editorRef: EditorRef) {
  callCmd(editorRef, toggleInlineCodeCommand.key);
}

export function editorBlockquote(editorRef: EditorRef) {
  callCmd(editorRef, toggleBlockquoteCommand.key);
}

export function editorBulletList(editorRef: EditorRef) {
  callCmd(editorRef, toggleBulletListCommand.key);
}

export function editorOrderedList(editorRef: EditorRef) {
  callCmd(editorRef, toggleOrderedListCommand.key);
}

export function editorTaskList(editorRef: EditorRef) {
  callCmd(editorRef, toggleTaskListCommand.key);
}

export function editorIndent(editorRef: EditorRef) {
  editorRef.current?.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const listItem = ctx.get(schemaCtx).nodes.list_item;
    if (listItem) sinkListItem(listItem)(view.state, view.dispatch);
    view.focus();
  });
}

export function editorDedent(editorRef: EditorRef) {
  editorRef.current?.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const listItem = ctx.get(schemaCtx).nodes.list_item;
    if (listItem) liftListItem(listItem)(view.state, view.dispatch);
    view.focus();
  });
}

export function editorCodeBlock(editorRef: EditorRef) {
  callCmd(editorRef, toggleCodeBlockCommand.key);
}

export function editorDidascalieInline(editorRef: EditorRef) {
  callCmd(editorRef, toggleDidascalieInlineCommand.key);
}

export function editorPoetry(editorRef: EditorRef) {
  callCmd(editorRef, togglePoetryCommand.key);
}

export function editorHighlight(editorRef: EditorRef, color?: string) {
  if (color) {
    editorRef.current?.action((ctx) => {
      ctx.get(commandsCtx).call(toggleHighlightInlineCommand.key, { color });
      ctx.get(editorViewCtx).focus();
    });
  } else {
    callCmd(editorRef, toggleHighlightInlineCommand.key);
  }
}

export function editorInsertFormula(editorRef: EditorRef) {
  editorRef.current?.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const schema = ctx.get(schemaCtx);
    const type = schema.nodes.inline_formula;
    if (!type) return;
    const { state } = view;
    if (state.selection.$from.parent.type.spec.code) return;
    const pos = state.selection.$from.pos;
    view.dispatch(state.tr.insert(pos, type.create()));
    const coords = view.coordsAtPos(pos);
    setInlineFormulaEdit({
      pos,
      raw: "$$$$",
      coords: { left: coords.left, top: coords.top, bottom: coords.bottom },
    });
  });
}

// focus() AVANT dispatch : le plugin custom-caret (customCaretPlugin, desktop)
// ne positionne/affiche le caret que si view.hasFocus() est déjà vrai au
// moment du dispatch (son update() tourne de façon synchrone dans le
// dispatch) — dans l'autre ordre, le caret reste invisible jusqu'à la frappe
// (1er dispatch suivant, focus alors déjà acquis).
function focusViewAtStart(view: EditorView) {
  view.focus();
  const { state } = view;
  const selection = TextSelection.near(state.doc.resolve(0));
  view.dispatch(state.tr.setSelection(selection));
}

// Focalise l'éditeur avec le caret au tout début du document (note vide :
// clic n'importe où dans la zone d'édition, pas seulement sur la ligne rendue).
export function editorFocusAtStart(editorRef: EditorRef) {
  editorRef.current?.action((ctx) => {
    focusViewAtStart(ctx.get(editorViewCtx));
  });
}

// Signal one-shot consommé par le hook `mounted` du listener plugin (cf.
// MarkdownEditor) : valider le titre (Entrée) doit amener le caret en tout
// début de note, mais si le renommage change le chemin de la note, le
// <MilkdownProvider key={activeNote.id}> remonte tout l'éditeur — la vue sur
// laquelle on vient d'appeler focusViewAtStart est alors détruite. Ce flag
// redemande le focus une fois la nouvelle vue montée.
// Ciblé par id de note (pas un simple booléen) : si le renommage n'a en fait
// pas changé le chemin (nom inchangé, échec…), aucun remount n'a lieu et le
// flag ne doit pas traîner pour se déclencher plus tard sur une note sans
// rapport — il ne peut matcher que le montage de CE id précis.
const pendingFocusAtStart = { noteId: null as string | null };

export function requestFocusAtStartOnMount(noteId: string) {
  pendingFocusAtStart.noteId = noteId;
}

// Utilisé par le hook `mounted` (reçoit directement la vue via ctx, pas de ref).
export function consumePendingFocusAtStart(view: EditorView, noteId: string) {
  if (pendingFocusAtStart.noteId !== noteId) return;
  pendingFocusAtStart.noteId = null;
  focusViewAtStart(view);
}

export function editorScrollToPos(editorRef: EditorRef, pos: number) {
  editorRef.current?.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    try {
      const domPos = view.domAtPos(pos + 1);
      const el =
        domPos.node instanceof Element
          ? (domPos.node as Element)
          : (domPos.node as Node).parentElement;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      // pos hors limites, ignoré
    }
  });
}

export function editorInsertAudioBlock(
  editorRef: EditorRef,
  vaultPath: string,
  path: string,
  title: string
) {
  // Normalise en chemin relatif au vault pour la portabilité cross-platform
  const vaultPrefix = vaultPath.endsWith("/") ? vaultPath : `${vaultPath}/`;
  const relativePath = path.startsWith(vaultPrefix)
    ? path.slice(vaultPrefix.length)
    : path;

  editorRef.current?.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const schema = ctx.get(schemaCtx);
    const audioType = schema.nodes.audio_block;
    if (!audioType) return;
    const { state, dispatch } = view;
    const insertPos = state.selection.$to.after();
    const tr = state.tr.insert(
      insertPos,
      audioType.create({ src: relativePath, title })
    );
    dispatch(tr.scrollIntoView());
    view.focus();
  });
}
