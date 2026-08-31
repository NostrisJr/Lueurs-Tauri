import {
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
} from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import type { $Command } from "@milkdown/kit/utils";
import {
  toggleBlockquoteCommand,
  toggleBulletListCommand,
  toggleCodeBlockCommand,
  toggleDidascalieInlineCommand,
  toggleHeadingCommand,
  toggleHighlightInlineCommand,
  toggleLinkWithPromptCommand,
  toggleOrderedListCommand,
  togglePoetryCommand,
  toggleTaskListCommand,
} from "../../../plugins/customKeymap";

export interface FormattingItem {
  id: string;
  label: string;
  // La commande elle-même (pas juste sa `.key`) : `$command()` ne peuple
  // `.key` qu'à l'initialisation async du plugin dans l'éditeur, donc lire
  // `.key` ici au chargement du module le figerait à `undefined`. On le lit
  // au clic à la place (cf. useContextMenu.ts), une fois l'éditeur prêt.
  // biome-ignore lint/suspicious/noExplicitAny: $Command générique Milkdown
  command: $Command<any>;
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
      {
        id: "bold",
        label: "Gras",
        command: toggleStrongCommand,
        shortcut: "⌘B",
      },
      {
        id: "italic",
        label: "Italique",
        command: toggleEmphasisCommand,
        shortcut: "⌘I",
      },
      {
        id: "strike",
        label: "Barré",
        command: toggleStrikethroughCommand,
        shortcut: "⌘⇧S",
      },
      {
        id: "code_inline",
        label: "Code inline",
        command: toggleInlineCodeCommand,
        shortcut: "⌘E",
      },
      {
        id: "didascalie_inline",
        label: "Didascalie inline",
        command: toggleDidascalieInlineCommand,
        shortcut: "⌘D",
      },
      {
        id: "highlight",
        label: "Surligner",
        command: toggleHighlightInlineCommand,
        shortcut: "⌘⇧L",
      },
      {
        id: "link",
        label: "Lien",
        command: toggleLinkWithPromptCommand,
        shortcut: "⌘⇧K",
      },
    ],
  },
  {
    label: "Structure",
    items: [
      {
        id: "paragraph",
        label: "Paragraphe",
        command: turnIntoTextCommand,
        shortcut: "⌘⌥0",
      },
      {
        id: "h1",
        label: "Titre 1",
        command: toggleHeadingCommand,
        payload: { level: 1 },
        shortcut: "⌘⌥1",
      },
      {
        id: "h2",
        label: "Titre 2",
        command: toggleHeadingCommand,
        payload: { level: 2 },
        shortcut: "⌘⌥2",
      },
      {
        id: "h3",
        label: "Titre 3",
        command: toggleHeadingCommand,
        payload: { level: 3 },
        shortcut: "⌘⌥3",
      },
      {
        id: "h4",
        label: "Titre 4",
        command: toggleHeadingCommand,
        payload: { level: 4 },
        shortcut: "⌘⌥4",
      },
      {
        id: "h5",
        label: "Titre 5",
        command: toggleHeadingCommand,
        payload: { level: 5 },
        shortcut: "⌘⌥5",
      },
      {
        id: "h6",
        label: "Titre 6",
        command: toggleHeadingCommand,
        payload: { level: 6 },
        shortcut: "⌘⌥6",
      },
      {
        id: "ordered_list",
        label: "Liste numérotée",
        command: toggleOrderedListCommand,
        shortcut: "⌘⇧7",
      },
      {
        id: "bullet_list",
        label: "Liste à puces",
        command: toggleBulletListCommand,
        shortcut: "⌘⇧8",
      },
      {
        id: "task_list",
        label: "Liste de tâches",
        command: toggleTaskListCommand,
        shortcut: "⌘⇧9",
      },
    ],
  },
  {
    label: "Blocs",
    items: [
      {
        id: "blockquote",
        label: "Citation",
        command: toggleBlockquoteCommand,
        shortcut: "⌘⇧B",
      },
      {
        id: "code_block",
        label: "Bloc de code",
        command: toggleCodeBlockCommand,
        shortcut: "⌘⇧E",
      },
      {
        id: "poetry",
        label: "Poésie / Chanson",
        command: togglePoetryCommand,
        shortcut: "⌘⇧P",
      },
    ],
  },
];
