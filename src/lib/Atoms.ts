import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import type { NoteFile, TreeNode } from "../components/FileTree/hooks/useFileTree";
import { flattenTree } from "../components/FileTree/hooks/useFileTree";
import { SystemField, type KanbanColumn } from "./noteTypes";
import { createLogger } from "./logger";

const log = createLogger("atoms");

export const writingPathsRegistry = new Set<string>();
export const searchAtom = atom("");
export const savingAtom = atom(false);
export const loadingAtom = atom(false);
export const treeAtom = atom<TreeNode[]>([]);
export const errorAtom = atom<string | null>(null);

export const STORAGE_KEY = "lueurs_folder_path";
export const folderPathAtom = atomWithStorage<string | null>(STORAGE_KEY, null);

export const activeNoteIdAtom = atom<string | null>(null);

// Dérivé : toujours synchronisé avec l'arbre, jamais de snapshot
export const activeNoteAtom = atom((get) => {
    const id = get(activeNoteIdAtom);
    if (!id) return null;
    return flattenTree(get(treeAtom)).find((n) => n.id === id) ?? null;
});

// ── Propagation template ──────────────────────────────────────────────────

// Clés supprimées d'un template sans propagation aux enfants.
// Renseigné par FrontmatterEditor, consommé et vidé par onTemplateChange.
export const skipPropagationAtom = atom<Set<string>>(new Set<string>());

// ── Table ─────────────────────────────────────────────────────────────────

// Largeurs de colonnes persistées : { [propKey: string]: number }
export function parseTableColumns(raw: string | undefined): Record<string, number> {
    if (!raw || typeof raw !== "string") return {};
    try { return JSON.parse(raw); } catch { return {}; }
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

export function parseColumns(raw: string | string[] | undefined): KanbanColumn[] {
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

    const kanbanKey = base.frontmatter[SystemField.KANBAN_KEY] as string | undefined;
    if (!kanbanKey) return {};

    const columns = parseColumns(base.frontmatter[SystemField.KANBAN_COLUMNS]);
    // Pas de guard sur columns.length — la colonne "Sans valeur" doit apparaître même si aucune colonne n'est configurée

    const allNotes = flattenTree(get(treeAtom));
    const childrenPaths = base.frontmatter[SystemField.CHILDREN];
    const paths = Array.isArray(childrenPaths) ? childrenPaths as string[] : [];
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