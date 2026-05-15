import { commandsCtx, schemaCtx } from "@milkdown/kit/core";
import {
  insertHrCommand,
  toggleInlineCodeCommand,
  turnIntoTextCommand,
} from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import { lift, setBlockType, wrapIn } from "@milkdown/kit/prose/commands";
import { keymap } from "@milkdown/kit/prose/keymap";
import type { Schema } from "@milkdown/kit/prose/model";
import { liftListItem, wrapInList } from "@milkdown/kit/prose/schema-list";
import type { EditorState, Transaction } from "@milkdown/kit/prose/state";
import type { Command } from "@milkdown/kit/prose/state";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { $command, $prose } from "@milkdown/kit/utils";
import { createLogger } from "../lib/logger";

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
    const didascalieType = schema.nodes.didascalie_inline;
    if (!didascalieType) return false;

    const { from, to, empty } = state.selection;
    const { $from } = state.selection;

    // Curseur dans une didascalie : on déballe le nœud (texte seul restitué)
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type === didascalieType) {
        const before = $from.before(d);
        const after = $from.after(d);
        const text = $from.node(d).textContent;
        if (dispatch) {
          const tr = state.tr.replaceWith(
            before,
            after,
            text ? schema.text(text) : []
          );
          dispatch(tr);
        }
        return true;
      }
    }

    // Sélection vide hors didascalie : rien à faire
    if (empty) return false;

    // Wrap la sélection (texte uniquement — les marks sont perdus, le nœud
    // n'autorise pas les marks pour éviter l'ambiguïté de parsing).
    const text = state.doc.textBetween(from, to);
    if (!text) return false;
    const node = didascalieType.create(null, schema.text(text));
    if (dispatch) dispatch(state.tr.replaceWith(from, to, node));
    return true;
  }
);

export const toggleDidascalieBlockCommand = $command(
  "ToggleDidascalieBlock",
  (ctx) => () => (state, dispatch) => {
    const schema = ctx.get(schemaCtx);
    const blockType = schema.nodes.didascalie_block;
    if (!blockType) return false;

    if (isInNodeType(state, schema, "didascalie_block")) {
      return lift(state, dispatch);
    }

    return applyWithEscape(state, dispatch, schema, wrapIn(blockType));
  }
);

export const togglePoetryCommand = $command(
  "TogglePoetry",
  (ctx) => () => (state, dispatch) => {
    const schema = ctx.get(schemaCtx);
    const poetryType = schema.nodes.poetry_block;
    if (!poetryType) return false;

    if (isInNodeType(state, schema, "poetry_block")) {
      return lift(state, dispatch);
    }

    return applyWithEscape(state, dispatch, schema, wrapIn(poetryType));
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

    // Pas de sélection et pas de lien → rien
    if (empty) return false;

    // Sélection sans lien → demander l'URL et appliquer
    const href = window.prompt("URL du lien :");
    if (!href) {
      log.info("lien : saisie annulée");
      return false;
    }
    if (dispatch)
      dispatch(
        state.tr.addMark(from, to, linkMark.create({ href, title: "" }))
      );
    log.info("lien ajouté", { from, to, href });
    return true;
  }
);

// ── Keymap (event.key) ─────────────────────────────────────────────────────

export const customKeymapPlugin = $prose((ctx) =>
  keymap({
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
    "Mod-Shift-d": () =>
      ctx.get(commandsCtx).call(toggleDidascalieBlockCommand.key),
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
          // Mod+Shift : bloc didascalie (KeyD)
          if (!event.altKey && event.shiftKey && event.code === "KeyD") {
            event.preventDefault();
            commands.call(toggleDidascalieBlockCommand.key);
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
