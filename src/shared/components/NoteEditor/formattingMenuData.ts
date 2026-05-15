import type { CmdKey } from "@milkdown/kit/core";
import {
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
} from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import {
  toggleBlockquoteCommand,
  toggleBulletListCommand,
  toggleCodeBlockCommand,
  toggleDidascalieBlockCommand,
  toggleDidascalieInlineCommand,
  toggleHeadingCommand,
  toggleLinkWithPromptCommand,
  toggleOrderedListCommand,
  togglePoetryCommand,
  toggleTaskListCommand,
} from "../../plugins/customKeymap";

export interface FormattingItem {
  id: string;
  label: string;
  // biome-ignore lint/suspicious/noExplicitAny: CmdKey générique Milkdown
  cmdKey: CmdKey<any>;
  payload?: unknown;
  shortcut?: string;
}

export interface FormattingGroup {
  label: string;
  items: FormattingItem[];
}

export const EDITOR_FORMATTING_GROUPS: FormattingGroup[] = [
  {
    label: "Format",
    items: [
      { id: "bold", label: "Gras", cmdKey: toggleStrongCommand.key, shortcut: "⌘B" },
      { id: "italic", label: "Italique", cmdKey: toggleEmphasisCommand.key, shortcut: "⌘I" },
      { id: "strike", label: "Barré", cmdKey: toggleStrikethroughCommand.key, shortcut: "⌘⇧S" },
      { id: "code_inline", label: "Code inline", cmdKey: toggleInlineCodeCommand.key, shortcut: "⌘E" },
      { id: "didascalie_inline", label: "Didascalie inline", cmdKey: toggleDidascalieInlineCommand.key, shortcut: "⌘D" },
      { id: "link", label: "Lien", cmdKey: toggleLinkWithPromptCommand.key, shortcut: "⌘⇧K" },
    ],
  },
  {
    label: "Structure",
    items: [
      { id: "paragraph", label: "Paragraphe", cmdKey: turnIntoTextCommand.key, shortcut: "⌘⌥0" },
      { id: "h1", label: "Titre 1", cmdKey: toggleHeadingCommand.key, payload: { level: 1 }, shortcut: "⌘⌥1" },
      { id: "h2", label: "Titre 2", cmdKey: toggleHeadingCommand.key, payload: { level: 2 }, shortcut: "⌘⌥2" },
      { id: "h3", label: "Titre 3", cmdKey: toggleHeadingCommand.key, payload: { level: 3 }, shortcut: "⌘⌥3" },
      { id: "h4", label: "Titre 4", cmdKey: toggleHeadingCommand.key, payload: { level: 4 }, shortcut: "⌘⌥4" },
      { id: "h5", label: "Titre 5", cmdKey: toggleHeadingCommand.key, payload: { level: 5 }, shortcut: "⌘⌥5" },
      { id: "h6", label: "Titre 6", cmdKey: toggleHeadingCommand.key, payload: { level: 6 }, shortcut: "⌘⌥6" },
      { id: "ordered_list", label: "Liste numérotée", cmdKey: toggleOrderedListCommand.key, shortcut: "⌘⇧7" },
      { id: "bullet_list", label: "Liste à puces", cmdKey: toggleBulletListCommand.key, shortcut: "⌘⇧8" },
      { id: "task_list", label: "Liste de tâches", cmdKey: toggleTaskListCommand.key, shortcut: "⌘⇧9" },
    ],
  },
  {
    label: "Blocs",
    items: [
      { id: "blockquote", label: "Citation", cmdKey: toggleBlockquoteCommand.key, shortcut: "⌘⇧B" },
      { id: "code_block", label: "Bloc de code", cmdKey: toggleCodeBlockCommand.key, shortcut: "⌘⇧E" },
      { id: "poetry", label: "Poésie / Chanson", cmdKey: togglePoetryCommand.key, shortcut: "⌘⇧P" },
      { id: "didascalie_block", label: "Bloc didascalie", cmdKey: toggleDidascalieBlockCommand.key, shortcut: "⌘⇧D" },
    ],
  },
];
