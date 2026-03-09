import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import type { TreeNode } from "../components/FileTree/useFileTree";
import { flattenTree } from "../components/FileTree/useFileTree";

// Verrou partagé : chemins en cours d'écriture par l'app (frontend ou Rust via invoke).
// Empêche le watcher FS de recharger l'arbre pendant une opération.
export const writingPathsRegistry = new Set<string>();
export const searchAtom = atom("");
export const savingAtom = atom(false);
export const loadingAtom = atom(false);
export const treeAtom = atom<TreeNode[]>([]);
export const errorAtom = atom<string | null>(null);

export const STORAGE_KEY = "lueurs_folder_path";
export const folderPathAtom = atomWithStorage<string | null>(STORAGE_KEY, null);

// L'id de la note active — seule source de vérité
export const activeNoteIdAtom = atom<string | null>(null);

// Clés dont la valeur a été forcée par un template au dernier save
export const constraintViolationsAtom = atom<string[]>([]);


// Dérivé : toujours synchronisé avec l'arbre, jamais de snapshot
// Pourquoi ? Sinon il fallait recharger les notes ouvertes quand on modifiait ses 
// propriétés/texte depuis l'extérieur (typiquement les bases, les propriétés contraintes, les enfants...)
export const activeNoteAtom = atom((get) => {
    const id = get(activeNoteIdAtom);
    if (!id) return null;
    return flattenTree(get(treeAtom)).find((n) => n.id === id) ?? null;
});