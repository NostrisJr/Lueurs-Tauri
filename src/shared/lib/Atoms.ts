import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  DEFAULT_DISTINGUISHED_TYPES,
  type DocumentMapState,
} from "./documentMapConfig";

import type { FolderNode, NoteFile, TreeNode } from "../hooks/useFileTree";
import { flattenTree } from "../hooks/useFileTree";
import { createLogger } from "./logger";
import { type KanbanColumn, SystemField } from "./noteTypes";

const log = createLogger("atoms");

export const writingPathsRegistry = new Set<string>();
export const searchAtom = atom("");
export const sidebarCollapsedAtom = atom(false);
export const settingsOpenAtom = atom(false);
// État du drag & drop dans le file tree
export const dragSourceAtom = atom<string | null>(null);
export const dragOverAtom = atom<string | null>(null);
export const savingAtom = atom(false);
export const loadingAtom = atom(false);
export const treeAtom = atom<TreeNode[]>([]);
export const errorAtom = atom<string | null>(null);

export type DisplayMode = "normal" | "livre";
// Source de vérité UI — initialisé/synchronisé depuis le frontmatter par NoteEditor
export const displayModeAtom = atom<DisplayMode>("normal");
// Mode de lecture par défaut : appliqué aux nouvelles notes et aux notes sans __DisplayMode__
export const defaultDisplayModeAtom = atomWithStorage<DisplayMode>(
  "lueurs_default_display_mode",
  "normal",
  undefined,
  { getOnInit: true }
);

export const STORAGE_KEY = "lueurs_folder_path";
// getOnInit: true → lit localStorage dès l'init de l'atom (pas après le montage)
export const folderPathAtom = atomWithStorage<string | null>(
  STORAGE_KEY,
  null,
  undefined,
  { getOnInit: true }
);

export const activeNoteIdAtom = atom<string | null>(null);

// Liste des notes ouvertes en onglets
export const openTabIdsAtom = atom<string[]>([]);

// Historique de navigation : IDs des onglets par ordre de dernière activation (le plus récent en dernier)
export const tabHistoryAtom = atom<string[]>([]);

// Pile de navigation intra-éditeur (ex. base → enfant via tableau/kanban)
export const noteBackStackAtom = atom<string[]>([]);

// ── Navigation mobile ─────────────────────────────────────────────────────

export type MobileView =
  | "filetree"
  | "editor"
  | "tabs"
  | "search"
  | "dictaphone"
  | "settings";

// Pile de navigation — source de vérité unique pour l'historique des vues
export const mobileNavStackAtom = atom<MobileView[]>(["filetree"]);

// Vue courante (dérivé — lecture seule)
export const mobileViewAtom = atom((get) => {
  const stack = get(mobileNavStackAtom);
  return stack[stack.length - 1] ?? ("filetree" as MobileView);
});

// Vue précédente pour l'effet peek (dérivé)
export const mobilePrevViewAtom = atom((get) => {
  const stack = get(mobileNavStackAtom);
  return stack.length >= 2 ? stack[stack.length - 2] : null;
});

// Naviguer vers une nouvelle vue (push)
export const mobileNavigateAtom = atom(null, (_get, set, view: MobileView) => {
  set(mobileNavStackAtom, (prev) => [...prev, view]);
});

// Retour arrière (pop)
export const mobileGoBackAtom = atom(null, (_get, set) => {
  set(mobileNavStackAtom, (prev) =>
    prev.length > 1 ? prev.slice(0, -1) : prev
  );
});

// Réinitialiser vers le file tree (retour à la racine absolue)
export const mobileResetNavAtom = atom(null, (_get, set) => {
  set(mobileNavStackAtom, ["filetree"]);
});

export type DictaphoneMode = "new-note" | "insert";
export const dictaphoneModeAtom = atom<DictaphoneMode | null>(null);

// Bloc audio en attente d'insertion après retour de la vue dictaphone (mobile insert-mode)
export const pendingAudioInsertAtom = atom<{
  path: string;
  title: string;
} | null>(null);

// null = racine du vault, FolderNode = sous-dossier actif
export const folderStackAtom = atom<(FolderNode | null)[]>([null]);

export interface RenameTarget {
  id: string;
  name: string;
  isFolder: boolean;
}
export const renameTargetAtom = atom<RenameTarget | null>(null);

// Cible du menu contextuel mobile (appui long sur note/dossier)
export const mobileContextMenuAtom = atom<RenameTarget | null>(null);

// Action : navigue vers noteId en empilant la note courante
export const navigateToNoteAtom = atom(null, (get, set, noteId: string) => {
  const currentId = get(activeNoteIdAtom);
  if (currentId && currentId !== noteId) {
    set(noteBackStackAtom, (prev) => [...prev, currentId]);
  }
  set(activeNoteIdAtom, noteId);
});

// Dérivé : toujours synchronisé avec l'arbre, jamais de snapshot
export const activeNoteAtom = atom((get) => {
  const id = get(activeNoteIdAtom);
  if (!id) return null;
  return flattenTree(get(treeAtom)).find((n) => n.id === id) ?? null;
});

// ── Navigateur de document ────────────────────────────────────────────────

// Map calculée en temps réel par le plugin ProseMirror (non persistée)
export const documentMapAtom = atom<DocumentMapState>({
  blocks: [],
  docSize: 0,
});

// Types de blocs à distinguer visuellement dans le navigateur (persistés)
export const documentMapDistinguishedTypesAtom = atomWithStorage<string[]>(
  "lueurs_document_map_types",
  DEFAULT_DISTINGUISHED_TYPES,
  undefined,
  { getOnInit: true }
);

// Préférences d'affichage du navigateur
export const documentMapShowNavigatorAtom = atomWithStorage<boolean>(
  "lueurs_document_map_show_navigator",
  true,
  undefined,
  { getOnInit: true }
);
export const documentMapShowListsAtom = atomWithStorage<boolean>(
  "lueurs_document_map_show_lists",
  false,
  undefined,
  { getOnInit: true }
);
export const documentMapShowTextAtom = atomWithStorage<boolean>(
  "lueurs_document_map_show_text",
  false,
  undefined,
  { getOnInit: true }
);

// Commande de scroll vers une position ProseMirror (non persistée)
export const scrollToPosAtom = atom<number | null>(null);

// ── Propagation template ──────────────────────────────────────────────────

// Clés supprimées d'un template sans propagation aux enfants.
// Renseigné par FrontmatterEditor, consommé et vidé par onTemplateChange.
export const skipPropagationAtom = atom<Set<string>>(new Set<string>());

// ── Table ─────────────────────────────────────────────────────────────────

// Largeurs de colonnes persistées : { [propKey: string]: number }
export function parseTableColumns(
  raw: string | undefined
): Record<string, number> {
  if (!raw || typeof raw !== "string") return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function serializeTableColumns(widths: Record<string, number>): string {
  return JSON.stringify(widths);
}

// ── Kanban ────────────────────────────────────────────────────────────────

export interface KanbanCards {
  [colId: string]: NoteFile[];
}

// Colonne virtuelle pour les notes sans valeur — non persistée dans __KanbanColumns__
export const NO_VALUE_COLUMN_ID = "col__no_value__";

export function parseColumns(
  raw: string | string[] | undefined
): KanbanColumn[] {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    log.warn("__KanbanColumns__ malformé, ignoré", { raw });
    return [];
  }
}

export function serializeColumns(columns: KanbanColumn[]): string {
  return JSON.stringify(columns);
}

export function generateColumnId(): string {
  return `col_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Atom dérivé : cards Kanban de la base active.
 * Se resynchronise automatiquement dès que treeAtom change
 * (après writeTextFile, reload watcher, ou propagation template).
 */
export const kanbanCardsAtom = atom((get): KanbanCards => {
  const base = get(activeNoteAtom);
  if (!base) return {};

  const kanbanKey = base.frontmatter[SystemField.KANBAN_KEY] as
    | string
    | undefined;
  if (!kanbanKey) return {};

  const columns = parseColumns(base.frontmatter[SystemField.KANBAN_COLUMNS]);
  // Pas de guard sur columns.length — la colonne "Sans valeur" doit apparaître même si aucune colonne n'est configurée

  const allNotes = flattenTree(get(treeAtom));
  const childrenPaths = base.frontmatter[SystemField.CHILDREN];
  const paths = Array.isArray(childrenPaths) ? (childrenPaths as string[]) : [];
  const childNotes = paths
    .map((p) => allNotes.find((n) => n.id === p))
    .filter((n): n is NoteFile => !!n);

  const labelledValues = new Set(columns.map((col) => col.label));
  const noValueNotes = childNotes.filter((n) => {
    const val = n.frontmatter[kanbanKey];
    // Absence de valeur : undefined, null, "" ou valeur inconnue des colonnes
    return !val || !labelledValues.has(val as string);
  });

  log.info("recalcul kanbanCardsAtom", {
    baseId: base.id,
    columns: columns.length,
    children: childNotes.length,
    noValue: noValueNotes.length,
  });

  const cards = Object.fromEntries(
    columns.map((col) => [
      col.id,
      childNotes.filter((n) => n.frontmatter[kanbanKey] === col.label),
    ])
  );

  // Colonne virtuelle — ajoutée uniquement si au moins une note est sans valeur
  if (noValueNotes.length > 0) {
    cards[NO_VALUE_COLUMN_ID] = noValueNotes;
  }

  return cards;
});
