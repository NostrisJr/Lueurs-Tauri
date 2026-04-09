import { useMemo, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  treeAtom,
  folderStackAtom,
  mobileViewAtom,
  activeNoteIdAtom,
  openTabIdsAtom,
  noteBackStackAtom,
} from "../../../lib/atoms.ts";
import type {
  FolderNode,
  NoteFile,
  TreeNode,
} from "../../FileTree/hooks/useFileTree";
import { useMobileSwipeBack } from "../../../hooks/mobile/useMobileSwipeBack";
import { FileTreeHeader } from "./FileTreeHeader";
import { FileTreeBottomBar } from "./FileTreeBottomBar";
import { NoteRow } from "./NoteRow";
import { FolderRow } from "./FolderRow";
import { SearchSheet } from "./SearchSheet";
import { RenameSheet } from "./RenameSheet";

interface RenameTarget {
  id: string;
  name: string;
  isFolder: boolean;
}

interface Props {
  onCreateNote: (folderPath: string) => Promise<NoteFile>;
  onCreateFolder: (folderPath: string) => Promise<void>;
  onRenameNode: (
    id: string,
    newName: string,
    isFolder: boolean
  ) => Promise<unknown>;
}

export function MobileFileTree({
  onCreateNote,
  onCreateFolder,
  onRenameNode,
}: Props) {
  const tree = useAtomValue(treeAtom);
  const folderStack = useAtomValue(folderStackAtom);
  const setFolderStack = useSetAtom(folderStackAtom);
  const setMobileView = useSetAtom(mobileViewAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
  const setOpenTabIds = useSetAtom(openTabIdsAtom);
  const setNoteBackStack = useSetAtom(noteBackStackAtom);

  const [searchOpen, setSearchOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);

  const currentFolder = folderStack[folderStack.length - 1] ?? null;
  const canGoBack = folderStack.length > 1;

  function handleDrillIn(folder: FolderNode) {
    setFolderStack((prev) => [...prev, folder]);
  }

  function handleDrillOut() {
    setFolderStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  function handleSelectNote(note: NoteFile) {
    setNoteBackStack([]);
    setOpenTabIds((prev) =>
      prev.includes(note.id) ? prev : [...prev, note.id]
    );
    setActiveNoteId(note.id);
    setMobileView("editor");
  }

  function openRename(id: string, name: string, isFolder: boolean) {
    setRenameTarget({ id, name, isFolder });
  }

  async function handleCommitRename(
    id: string,
    newName: string,
    isFolder: boolean
  ) {
    await onRenameNode(id, newName, isFolder);
    setRenameTarget(null);
  }

  async function handleCreateNote() {
    const folderPath = currentFolder?.id ?? "";
    const note = await onCreateNote(folderPath);
    handleSelectNote(note);
  }

  async function handleCreateFolder() {
    const folderPath = currentFolder?.id ?? "";
    await onCreateFolder(folderPath);
  }

  const { swipeTranslate, isTransitioning, touchHandlers } = useMobileSwipeBack(
    handleDrillOut,
    { condition: canGoBack }
  );

  const currentNodes: TreeNode[] = currentFolder
    ? currentFolder.children
    : tree;
  const sortedNodes = useMemo(
    () =>
      [...currentNodes].sort((a, b) => {
        if (a.kind === b.kind) return a.name.localeCompare(b.name);
        return a.kind === "folder" ? -1 : 1;
      }),
    [currentNodes]
  );

  return (
    <div className="flex flex-col pt-10 w-full h-screen overflow-hidden">
      <FileTreeHeader
        onRenameCurrentFolder={() =>
          currentFolder &&
          openRename(currentFolder.id, currentFolder.name, true)
        }
        onCreateNote={handleCreateNote}
        onCreateFolder={handleCreateFolder}
      />

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
              onLongPress={() => openRename(node.id, node.name, true)}
            />
          ) : (
            <NoteRow
              key={node.id}
              note={node}
              onSelect={handleSelectNote}
              onLongPress={() => openRename(node.id, node.name, false)}
            />
          )
        )}
      </div>

      <FileTreeBottomBar
        onCreateNote={handleCreateNote}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {searchOpen && (
        <SearchSheet
          onClose={() => setSearchOpen(false)}
          onSelectNote={handleSelectNote}
          onRenameNote={(id, name) => openRename(id, name, false)}
        />
      )}

      <RenameSheet
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onCommit={handleCommitRename}
      />
    </div>
  );
}
