import { $command, $prose } from "@milkdown/kit/utils";
import { keymap } from "@milkdown/kit/prose/keymap";
import { commandsCtx, schemaCtx } from "@milkdown/kit/core";
import type { EditorState, Transaction } from "@milkdown/kit/prose/state";
import type { Command } from "@milkdown/kit/prose/state";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { Schema } from "@milkdown/kit/prose/model";
import { lift, wrapIn, setBlockType } from "@milkdown/kit/prose/commands";
import { wrapInList, liftListItem } from "@milkdown/kit/prose/schema-list";
import {
  toggleLinkCommand,
  insertHrCommand,
  turnIntoTextCommand,
} from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";

// ── Helpers ────────────────────────────────────────────────────────────────

function isInNodeType(state: EditorState, schema: Schema, typeName: string): boolean {
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
    if (node.type === schema.nodes.list_item && node.attrs.checked !== null) return true;
  }
  return false;
}

function allBlocksAreHeading(state: EditorState, schema: Schema, level: number): boolean {
  const headingType = schema.nodes.heading;
  const { from, to } = state.selection;
  let allMatch = true;
  state.doc.nodesBetween(from, to, (node) => {
    if (!node.isTextblock) return true;
    if (node.type !== headingType || node.attrs.level !== level) allMatch = false;
    return false;
  });
  return allMatch;
}

// Retourne une commande pour sortir de la structure courante, ou null si déjà en paragraphe.
function buildEscapeCommand(state: EditorState, schema: Schema): Command | null {
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
  if (parent.type === schema.nodes.heading || parent.type === schema.nodes.code_block) {
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
  second: Command,
): boolean {
  // biome-ignore lint/suspicious/noExplicitAny: Transaction assigné synchronement dans le callback
  let firstTr: any = null;
  first(state, (tr) => { firstTr = tr; });
  if (!firstTr) return false;

  const intermediate = state.apply(firstTr as Transaction);
  // biome-ignore lint/suspicious/noExplicitAny: idem
  let secondTr: any = null;
  second(intermediate, (tr) => { secondTr = tr; });
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
  apply: Command,
): boolean {
  if (apply(state, undefined)) return apply(state, dispatch);

  const escape = buildEscapeCommand(state, schema);
  if (!escape) return false;
  return applyThenApply(state, dispatch, escape, apply);
}

// ── Commandes toggle exportées ─────────────────────────────────────────────

export const toggleBlockquoteCommand = $command(
  "ToggleBlockquote",
  (ctx) => () => (state, dispatch) => {
    const schema = ctx.get(schemaCtx);
    if (isInNodeType(state, schema, "blockquote")) return lift(state, dispatch);
    return applyWithEscape(state, dispatch, schema, wrapIn(schema.nodes.blockquote));
  }
);

export const toggleBulletListCommand = $command(
  "ToggleBulletList",
  (ctx) => () => (state, dispatch) => {
    const schema = ctx.get(schemaCtx);
    if (isInNodeType(state, schema, "bullet_list") && !isInTaskList(state, schema)) {
      return liftListItem(schema.nodes.list_item)(state, dispatch);
    }
    return applyWithEscape(state, dispatch, schema, wrapInList(schema.nodes.bullet_list));
  }
);

export const toggleOrderedListCommand = $command(
  "ToggleOrderedList",
  (ctx) => () => (state, dispatch) => {
    const schema = ctx.get(schemaCtx);
    if (isInNodeType(state, schema, "ordered_list")) {
      return liftListItem(schema.nodes.list_item)(state, dispatch);
    }
    return applyWithEscape(state, dispatch, schema, wrapInList(schema.nodes.ordered_list));
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
          if (node.type === schema.nodes.list_item && node.attrs.checked === null) {
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
    const inList = isInNodeType(state, schema, "bullet_list") || isInNodeType(state, schema, "ordered_list");
    if (inList) {
      const escape = liftListItem(schema.nodes.list_item);
      return applyThenApply(state, dispatch, escape, apply);
    }

    // Pour blockquote : setBlockType fonctionne à l'intérieur d'un blockquote —
    // le heading reste dans le blockquote, ce qui est valide en Markdown.
    return apply(state, dispatch);
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

    return applyWithEscape(state, dispatch, schema, setBlockType(codeBlockType, { language: "" }));
  }
);

// ── Keymap (event.key) ─────────────────────────────────────────────────────

export const customKeymapPlugin = $prose((ctx) =>
  keymap({
    // Marks (Mod-b, Mod-i, Mod-` déjà natifs dans le preset — non dupliqués)
    "Mod-Shift-s": () => ctx.get(commandsCtx).call(toggleStrikethroughCommand.key),
    "Mod-Shift-k": () => ctx.get(commandsCtx).call(toggleLinkCommand.key),
    // Structures
    "Mod-Shift-b": () => ctx.get(commandsCtx).call(toggleBlockquoteCommand.key),
    "Mod-Shift-7": () => ctx.get(commandsCtx).call(toggleOrderedListCommand.key),
    "Mod-Shift-8": () => ctx.get(commandsCtx).call(toggleBulletListCommand.key),
    "Mod-Shift-9": () => ctx.get(commandsCtx).call(toggleTaskListCommand.key),
    "Mod-Shift-h": () => ctx.get(commandsCtx).call(insertHrCommand.key),
  })
);

// ── Keymap (event.code) ────────────────────────────────────────────────────
// Titres et paragraphe (Mod+Alt+0..6) + bloc de code (Mod+Alt+C).
// On utilise event.code plutôt qu'event.key car sur AZERTY macOS, certaines
// combinaisons Cmd+Option+chiffre produisent un caractère spécial (#, {, [)
// au lieu du chiffre — ce qui empêche keymap() de matcher "Mod-Alt-3" etc.
// event.code est la position physique de la touche, indépendante du layout.

const codeShortcutsKey = new PluginKey("codeBasedShortcuts");

export const codeBasedShortcutsPlugin = $prose((ctx) =>
  new Plugin({
    key: codeShortcutsKey,
    props: {
      handleKeyDown(_view, event) {
        const isMod = event.metaKey || event.ctrlKey;
        if (!isMod || !event.altKey || event.shiftKey) return false;

        const commands = ctx.get(commandsCtx);

        // Paragraphe (Digit0) et titres (Digit1..6)
        const digitLevel: Record<string, number> = {
          Digit0: 0, Digit1: 1, Digit2: 2, Digit3: 3,
          Digit4: 4, Digit5: 5, Digit6: 6,
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

        // Bloc de code (KeyC)
        if (event.code === "KeyC") {
          event.preventDefault();
          commands.call(toggleCodeBlockCommand.key);
          return true;
        }

        return false;
      },
    },
  })
);
