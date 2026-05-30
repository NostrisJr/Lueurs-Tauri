/**
 * editorCommands.ts — Commandes impératives de l'éditeur Milkdown.
 *
 * Chaque fonction accepte un EditorRef et effectue la commande correspondante.
 * Permet d'appeler les commandes depuis n'importe quel composant (toolbar, raccourcis,
 * injection audio…) sans passer par useImperativeHandle.
 */
import type { Editor } from "@milkdown/kit/core";
import {
  commandsCtx,
  editorViewCtx,
  schemaCtx,
} from "@milkdown/kit/core";
import {
  toggleInlineCodeCommand,
  turnIntoTextCommand,
} from "@milkdown/kit/preset/commonmark";
import { toggleMark } from "@milkdown/kit/prose/commands";
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
} from "../../plugins/customKeymap";
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
    const mark = schema.marks.em;
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

export function editorHeading(editorRef: EditorRef, level: 1 | 2 | 3 | 4 | 5 | 6) {
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
