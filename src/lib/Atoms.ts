import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import type { NoteFile, TreeNode } from "../hooks/useFileTree";

export const activeNoteAtom = atom<NoteFile | null>(null);
export const searchAtom = atom("");
export const savingAtom = atom(false);
export const loadingAtom = atom(false);
export const treeAtom = atom<TreeNode[]>([]);
export const errorAtom = atom<string | null>(null);

export const STORAGE_KEY = "lueurs_folder_path";
export const folderPathAtom = atomWithStorage<string | null>(STORAGE_KEY, null);