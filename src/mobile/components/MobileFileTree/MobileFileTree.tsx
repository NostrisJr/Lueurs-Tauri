import { useMemo, useEffect, useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  treeAtom,
  folderStackAtom,
  renameTargetAtom,
  mobileViewAtom,
  dictaphoneModeAtom,
} from "../../../shared/lib/Atoms";
import type { FolderNode, TreeNode } from "../../../shared/hooks/useFileTree";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import { useNote } from "../../../shared/hooks/useNote";
import { useMobileSelectNote } from "../../hooks/useMobileSelectNote";
import { FileTreeHeader } from "./FileTreeHeader";
import { FileTreeBottomBar } from "./FileTreeBottomBar";
import { NoteRow } from "./NoteRow";
import { FolderRow } from "./FolderRow";
import { RenameInput } from "../RenameInput";

function findFolderById(nodes: TreeNode[], id: string): FolderNode | null {
  for (const node of nodes) {
    if (node.kind !== "folder") continue;
    if (node.id === id) return node;
    const found = findFolderById(node.children, id);
    if (found) return found;
  }
  return null;
}

export function MobileFileTree() {
  const tree = useAtomValue(treeAtom);
  const folderStack = useAtomValue(folderStackAtom);
  const setFolderStack = useSetAtom(folderStackAtom);
  const [renameTarget, setRenameTarget] = useAtom(renameTargetAtom);
  const { createNote } = useFileTree();
  const { handleRename } = useNote();
  const selectNote = useMobileSelectNote();
  const setMobileView = useSetAtom(mobileViewAtom);
  const setDictaphoneMode = useSetAtom(dictaphoneModeAtom);

  const currentFolder = folderStack[folderStack.length - 1] ?? null;

  // Sync les FolderNodes de la pile avec le treeAtom (captures les renames, FS updates)
  useEffect(() => {
    if (!tree.length) return;
    setFolderStack((prev) =>
      prev.map((f) => {
        if (!f) return f;
        return findFolderById(tree, f.id) ?? f;
      })
    );
  }, [tree, setFolderStack]);

  function handleDrillIn(folder: FolderNode) {
    setFolderStack((prev) => [...prev, folder]);
  }

  async function handleCreateNote() {
    const path = currentFolder?.id ?? "";
    const note = await createNote(path);
    selectNote(note);
  }

  const handleCreateRecording = useCallback(() => {
    setDictaphoneMode("new-note");
    setMobileView("dictaphone");
  }, [setDictaphoneMode, setMobileView]);

  async function handleCommitRename(
    id: string,
    newName: string,
    isFolder: boolean
  ) {
    // Mise à jour optimiste du nom dans la pile (le watcher FS prend le relais ensuite)
    if (isFolder) {
      setFolderStack((prev) =>
        prev.map((f) => (f?.id === id ? { ...f, name: newName } : f))
      );
    }
    await handleRename(id, newName, isFolder);
    setRenameTarget(null);
  }

  const currentNodes: TreeNode[] = currentFolder
    ? currentFolder.children
    : tree;
  const sortedNodes = useMemo(
    () =>
      [...currentNodes].sort((a, b) => {
        if (a.kind === b.kind)
          return a.name.localeCompare(b.name, "fr", { numeric: true });
        return a.kind === "folder" ? -1 : 1;
      }),
    [currentNodes]
  );

  return (
    <div className="relative flex flex-col pt-24 w-full h-screen overflow-hidden select-none">
      <div className="absolute top-0 w-full h-fit pt-10 bg-white shadow-lg shadow-gray-500/5">
        <FileTreeHeader />
      </div>

      <div className="flex flex-col gap-2 p-4 bg-gray-100 h-full overflow-y-scroll pb-20">
        {sortedNodes.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-12">
            Dossier vide
          </p>
        )}
        {sortedNodes.map((node) =>
          node.kind === "folder" ? (
            <FolderRow
              key={node.id}
              folder={node}
              onDrillIn={handleDrillIn}
              onLongPress={() =>
                setRenameTarget({
                  id: node.id,
                  name: node.name,
                  isFolder: true,
                })
              }
            />
          ) : (
            <NoteRow
              key={node.id}
              note={node}
              onSelect={selectNote}
              onLongPress={() =>
                setRenameTarget({
                  id: node.id,
                  name: node.name,
                  isFolder: false,
                })
              }
            />
          )
        )}
      </div>

      {renameTarget && (
        <RenameInput
          target={renameTarget}
          onClose={() => setRenameTarget(null)}
          onCommit={handleCommitRename}
        />
      )}

      <FileTreeBottomBar
        onCreateNote={handleCreateNote}
        onCreateRecording={handleCreateRecording}
      />
    </div>
  );
}
