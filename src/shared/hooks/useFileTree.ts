import { useStore } from "jotai";
import { useCallback } from "react";

import { folderPathAtom } from "../lib/atoms";
import { type Frontmatter, flattenTree } from "../lib/fileTreeHelpers";
import * as mut from "../lib/fileTreeMutations";

// ── Types ──────────────────────────────────────────────────────────────────

export interface NoteFile {
  kind: "file";
  id: string;
  name: string;
  type: string | null;
  title: string;
  body: string;
  frontmatter: Frontmatter;
  tags: string[];
  updatedAt: Date;
}

export interface FolderNode {
  kind: "folder";
  id: string;
  name: string;
  children: TreeNode[];
}

export type TreeNode = NoteFile | FolderNode;

export { flattenTree };
export type { Frontmatter };

// ── Hook ───────────────────────────────────────────────────────────────────
// Coquille fine au-dessus des fonctions module-level de fileTreeMutations.
// Les singletons (debounceTimers, reloadTimer, unwatcher) y vivent ;
// les multiples instances de useFileTree partagent donc leur état d'écriture
// — c'est ce qui élimine la race C1.

export function useFileTree() {
  const store = useStore();

  return {
    pickFolder: useCallback(() => mut.pickFolder(store), [store]),
    switchVault: useCallback(
      (path: string) => mut.switchVault(store, path),
      [store]
    ),
    initFolder: useCallback(() => mut.initFolder(store), [store]),
    autoInitFolder: useCallback(() => mut.autoInitFolder(store), [store]),
    reload: useCallback(() => {
      const path = store.get(folderPathAtom);
      if (path) return mut.reload(store, path);
    }, [store]),
    createNote: useCallback(
      (dirPath: string) => mut.createNote(store, dirPath),
      [store]
    ),
    createFolder: useCallback(
      (dirPath: string) => mut.createFolder(store, dirPath),
      [store]
    ),
    updateNote: useCallback(
      (
        fileId: string,
        body: string,
        frontmatter: Frontmatter,
        onPersisted?: () => void
      ) => mut.updateNote(store, fileId, body, frontmatter, onPersisted),
      [store]
    ),
    deleteNote: useCallback(
      (fileId: string) => mut.deleteNote(store, fileId),
      [store]
    ),
    deleteFolder: useCallback(
      (folderId: string, recursive = false) =>
        mut.deleteFolder(store, folderId, recursive),
      [store]
    ),
    renameNode: useCallback(
      (oldPath: string, newName: string, isFolder: boolean) =>
        mut.renameNode(store, oldPath, newName, isFolder),
      [store]
    ),
    openFolderNote: useCallback(
      (folderNode: FolderNode) => mut.openFolderNote(store, folderNode),
      [store]
    ),
    moveNode: useCallback(
      (sourceId: string, targetFolderPath: string) =>
        mut.moveNode(store, sourceId, targetFolderPath),
      [store]
    ),
    flushPendingWrite: useCallback(
      (fileId: string) => mut.flushPendingWrite(fileId),
      []
    ),
  };
}
