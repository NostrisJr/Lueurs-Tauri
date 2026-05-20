import { useSetAtom, useStore } from "jotai";
import { useCallback } from "react";
import { folderPathAtom, treeAtom } from "../lib/atoms";
import { persistNotePatch } from "../lib/vaultIO";
import type { Frontmatter } from "./useFileTree";

/**
 * Wrapper de persistNotePatch qui injecte automatiquement vaultPath
 * pour que les champs path soient stockés en relatif sur disque.
 */
export function usePersistNote() {
  const store = useStore();
  const setTree = useSetAtom(treeAtom);

  return useCallback(
    (noteId: string, frontmatter: Frontmatter, body: string) => {
      const vaultPath = store.get(folderPathAtom) ?? undefined;
      return persistNotePatch(noteId, frontmatter, body, setTree, vaultPath);
    },
    [store, setTree]
  );
}
