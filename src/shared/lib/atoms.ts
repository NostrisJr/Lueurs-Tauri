import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  DEFAULT_HIGHLIGHT_COLOR,
  type HighlightColorId,
} from "../plugins/highlight/colors";
import {
  DEFAULT_DISTINGUISHED_TYPES,
  type DocumentMapState,
} from "./documentMapConfig";

import type {
  FolderNode,
  MediaFile,
  NoteFile,
  TreeNode,
} from "../hooks/useFileTree";
import { flattenTree } from "../hooks/useFileTree";
import {
  buttonColumns,
  filterTreeBySpace,
  resolveButtonKey,
} from "./fileTreeHelpers";
import { createLogger } from "./logger";
import { type KanbanColumn, NoteType, SystemField } from "./noteTypes";
import type { PageFormat } from "./pageMetrics";
import { type VaultConfig, writeVaultConfig } from "./vaultConfig";

const log = createLogger("atoms");

export const writingPathsRegistry = new Set<string>();
export const searchAtom = atom("");
export const sidebarCollapsedAtom = atom(false);
export const settingsOpenAtom = atom(false);
// Affichage du dictaphone desktop (rendu en overlay au-dessus de l'éditeur)
export const dictaphoneOpenAtom = atom(false);
// État du drag & drop dans le file tree
export const dragSourceAtom = atom<string | null>(null);
export const dragOverAtom = atom<string | null>(null);
// IDs sélectionnés via Shift+Click dans le file tree (pour le déplacement multi-notes)
export const selectedIdsAtom = atom<Set<string>>(new Set<string>());
// Ancre de la plage de sélection — dernier item cliqué sans Shift
export const selectionAnchorAtom = atom<string | null>(null);
export const savingAtom = atom(false);
export const loadingAtom = atom(false);
export const treeAtom = atom<TreeNode[]>([]);
export const errorAtom = atom<string | null>(null);

// Notification transitoire bas-centre (auto-disparition). Réinitialiser à null la masque.
export const toastAtom = atom<string | null>(null);

// Couleur de surlignage par défaut (appliquée via raccourci ou sans couleur explicite)
export const defaultHighlightColorAtom = atomWithStorage<HighlightColorId>(
  "lueurs_default_highlight_color",
  DEFAULT_HIGHLIGHT_COLOR,
  undefined,
  { getOnInit: true }
);

export type DisplayMode = "normal" | "livre";
// Mode de lecture par défaut : appliqué aux nouvelles notes et aux notes sans __DisplayMode__
export const defaultDisplayModeAtom = atomWithStorage<DisplayMode>(
  "lueurs_default_display_mode",
  "normal",
  undefined,
  { getOnInit: true }
);

// Justification du texte en mode livre (activée par défaut)
export const textJustificationAtom = atomWithStorage<boolean>(
  "lueurs_text_justify",
  true,
  undefined,
  { getOnInit: true }
);

// Affichage du dossier resources/ dans le file tree
export const showResourcesAtom = atomWithStorage<boolean>(
  "lueurs_show_resources",
  false,
  undefined,
  { getOnInit: true }
);

// Correcteur orthographique et grammatical (Hugo) activé (par défaut activé)
export const spellcheckEnabledAtom = atomWithStorage<boolean>(
  "lueurs_spellcheck_enabled",
  true,
  undefined,
  { getOnInit: true }
);

// Format de référence de l'indicateur pages/mots (équivalent A4/A5)
export const pageFormatAtom = atomWithStorage<PageFormat>(
  "lueurs_page_format",
  "A4",
  undefined,
  { getOnInit: true }
);

// displayModeAtom — dérivé du frontmatter de la note active, repli sur le défaut utilisateur.
// L'écriture se fait via handleChange (frontmatter __DisplayMode__), qui propage ici automatiquement.
// Défini plus bas après activeNoteAtom (dépendance).

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

// ── Espaces ───────────────────────────────────────────────────────────────

// Config vault chargée au démarrage (null = non chargée ou Android)
export const vaultConfigAtom = atom<VaultConfig | null>(null);

// Mots ignorés par le correcteur (dérivé de la config) — lecture seule
export const ignoredWordsAtom = atom(
  (get) => get(vaultConfigAtom)?.ignoredWords ?? []
);

// Écriture des mots ignorés : persiste la config et met à jour l'atom.
export const updateIgnoredWordsAtom = atom(
  null,
  async (get, set, updater: (prev: string[]) => string[]) => {
    const folderPath = get(folderPathAtom);
    const config = get(vaultConfigAtom);
    if (!folderPath || !config) return;
    const ignoredWords = updater(config.ignoredWords ?? []);
    const updated = { ...config, ignoredWords };
    await writeVaultConfig(folderPath, updated);
    set(vaultConfigAtom, updated);
  }
);

// Nom de l'espace actif (null = "Tout" — aucun filtre)
export const activeSpaceAtom = atomWithStorage<string | null>(
  "lueurs_active_space",
  null,
  undefined,
  { getOnInit: true }
);

// Clé d'espace pour les états indexés par espace (null = "Tout")
export const KEY_ALL = "__all__";

export interface SpaceNavState {
  openTabIds: string[];
  activeNoteId: string | null;
  tabHistory: string[];
  noteBackStack: string[];
}

// État de navigation sauvegardé par espace (clé "__all__" = état de "Tout")
export const spaceNavStateAtom = atom<Record<string, SpaceNavState>>({});

// État d'ouverture des dossiers, indexé par espace puis par chemin de dossier.
// Source de vérité persistée (survit au redémarrage et aux reload d'import).
export const openFoldersBySpaceAtom = atomWithStorage<
  Record<string, Record<string, boolean>>
>("lueurs_open_folders", {});

// Tranche de l'espace actif — même API qu'un Record<chemin, bool> classique.
// Tout le routage par espace vit ici : le composant consommateur l'ignore.
// Absent = défaut basé sur la profondeur (cf. FolderNodeComponent).
export const openFoldersAtom = atom(
  (get) => get(openFoldersBySpaceAtom)[get(activeSpaceAtom) ?? KEY_ALL] ?? {},
  (
    get,
    set,
    update:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => {
    const key = get(activeSpaceAtom) ?? KEY_ALL;
    set(openFoldersBySpaceAtom, (prev) => {
      const cur = prev[key] ?? {};
      return {
        ...prev,
        [key]: typeof update === "function" ? update(cur) : update,
      };
    });
  }
);

// Arbre filtré par espace actif (dérivé)
export const filteredTreeAtom = atom((get) => {
  const tree = get(treeAtom);
  const space = get(activeSpaceAtom);
  if (!space) return tree;
  const spaces = get(vaultConfigAtom)?.spaces ?? [];
  // Espace inexistant dans la config (valeur obsolète en localStorage) → arbre complet
  if (!spaces.some((s) => s.name === space)) return tree;
  return filterTreeBySpace(tree, space);
});

// ── Navigation mobile ─────────────────────────────────────────────────────

export type MobileView = "filetree" | "editor" | "tabs" | "search" | "settings";

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

// Index id → NoteFile, recalculé une fois par changement de treeAtom et partagé
// par tous les consommateurs : O(1) au lookup au lieu de O(n) par .find().
export const notesByIdAtom = atom((get) => {
  const map = new Map<string, NoteFile>();
  for (const note of flattenTree(get(treeAtom))) {
    map.set(note.id, note);
  }
  return map;
});

// Index name → id pour la résolution des références par nom (formules, dehumanize).
// Évite la recréation de Map à chaque cellule du tableau.
export const notesByNameAtom = atom((get) => {
  const map = new Map<string, string>();
  for (const note of get(notesByIdAtom).values()) {
    map.set(note.name, note.id);
  }
  return map;
});

// Index id → MediaFile, recalculé à chaque changement de treeAtom
export const mediaByIdAtom = atom((get) => {
  const map = new Map<string, MediaFile>();
  function traverse(nodes: TreeNode[]) {
    for (const node of nodes) {
      if (node.kind === "media") map.set(node.id, node);
      else if (node.kind === "folder") traverse(node.children);
    }
  }
  traverse(get(treeAtom));
  return map;
});

// Dérivé : toujours synchronisé avec l'arbre, jamais de snapshot
export const activeNoteAtom = atom((get) => {
  const id = get(activeNoteIdAtom);
  if (!id) return null;
  return get(notesByIdAtom).get(id) ?? null;
});

// Fichier média actif — null si la note active est une note .md ou si rien n'est ouvert
export const activeMediaAtom = atom((get) => {
  const id = get(activeNoteIdAtom);
  if (!id) return null;
  return get(mediaByIdAtom).get(id) ?? null;
});

// Lookup unifié pour les onglets : une note ou un média par id.
export const tabNodeByIdAtom = atom((get) => {
  return (id: string): NoteFile | MediaFile | undefined =>
    get(notesByIdAtom).get(id) ?? get(mediaByIdAtom).get(id);
});

// Dérivé : lit __DisplayMode__ de la note active, repli sur le défaut utilisateur.
// Read-only — pour changer le mode, écrire dans le frontmatter via handleChange.
export const displayModeAtom = atom<DisplayMode>((get) => {
  const note = get(activeNoteAtom);
  const saved = note?.frontmatter[SystemField.DISPLAY_MODE] as
    | DisplayMode
    | undefined;
  if (saved === "livre" || saved === "normal") return saved;
  return get(defaultDisplayModeAtom);
});

// Changement de mode d'affichage demandé par MobileEditor.
// NoteEditor lit cet atom et l'applique au frontmatter via handleChange.
// null = aucune demande en attente.
export const pendingDisplayModeAtom = atom<DisplayMode | null>(null);

// ── Navigateur de document ────────────────────────────────────────────────

const EMPTY_DOCUMENT_MAP: DocumentMapState = { blocks: [], docSize: 0 };

// Map calculée en temps réel par le plugin ProseMirror (non persistée)
export const documentMapAtom = atom<DocumentMapState>(EMPTY_DOCUMENT_MAP);

// Dérivé : vide pour les bases (pas d'éditeur monté → carte jamais mise à jour),
// sinon valeur courante de documentMapAtom. Évite l'effet de sync dans NoteEditor.
export const documentMapForActiveAtom = atom((get) => {
  const note = get(activeNoteAtom);
  if (note?.type === NoteType.BASE) return EMPTY_DOCUMENT_MAP;
  return get(documentMapAtom);
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

  const notesById = get(notesByIdAtom);

  // Clé BUTTON : colonnes dérivées des options du template (source de vérité unique).
  // Clé libre : colonnes persistées dans __KanbanColumns__.
  const buttonKey = resolveButtonKey(base, notesById, kanbanKey);
  const columns = buttonKey
    ? buttonColumns(buttonKey.def)
    : parseColumns(base.frontmatter[SystemField.KANBAN_COLUMNS]);
  // Pas de guard sur columns.length — la colonne "Sans valeur" doit apparaître même si aucune colonne n'est configurée

  const childrenPaths = base.frontmatter[SystemField.CHILDREN];
  const paths = Array.isArray(childrenPaths) ? (childrenPaths as string[]) : [];
  const childNotes = paths
    .map((p) => notesById.get(p))
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
