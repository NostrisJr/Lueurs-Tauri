import { useRef, useState, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  folderStackAtom,
  folderPathAtom,
  renameTargetAtom,
} from "../../../shared/lib/Atoms";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import {
  sfChevronLeft,
  sfPlus,
  sfDocumentBadgePlus,
  sfFolderBadgePlus,
  sfGearshape,
} from "@bradleyhodges/sfsymbols";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import { useMobileSelectNote } from "../../hooks/useMobileSelectNote";
import { MobileSettings } from "../MobileSettings";

export function FileTreeHeader() {
  const folderStack = useAtomValue(folderStackAtom);
  const setFolderStack = useSetAtom(folderStackAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const setRenameTarget = useSetAtom(renameTargetAtom);
  const { createNote, createFolder } = useFileTree();
  const selectNote = useMobileSelectNote();

  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  const currentFolder = folderStack[folderStack.length - 1] ?? null;
  const canGoBack = folderStack.length > 1;
  const vaultName = folderPath?.split("/").filter(Boolean).pop();
  const folderName = currentFolder?.name ?? vaultName ?? "Notes";

  function handleDrillOut() {
    setFolderStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  async function handleCreateNote() {
    const path = currentFolder?.id ?? folderPath ?? "";
    const note = await createNote(path);
    selectNote(note);
  }

  async function handleRenameFolder() {
    if (currentFolder) {
      setRenameTarget({
        id: currentFolder.id,
        name: currentFolder.name,
        isFolder: true,
      });
    }
  }

  async function handleCreateFolder() {
    const path = currentFolder?.id ?? folderPath ?? "";
    await createFolder(path);
  }

  useEffect(() => {
    if (!showCreateMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        createMenuRef.current &&
        !createMenuRef.current.contains(e.target as Node)
      ) {
        setShowCreateMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCreateMenu]);

  return (
    <>
    {showSettings && <MobileSettings onClose={() => setShowSettings(false)} />}
    <div className="px-5 pt-4 pb-2 flex items-end justify-between">
      {canGoBack ? (
        <button
          type="button"
          onClick={handleDrillOut}
          className="w-8 h-8 flex items-center justify-center rounded-full text-amber-500 active:bg-black/5 transition-colors"
        >
          <SFIcon icon={sfChevronLeft} className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="w-8 h-8 flex items-center justify-center rounded-full text-amber-500 active:bg-black/5 transition-colors"
          title="Réglages"
        >
          <SFIcon icon={sfGearshape} className="size-4" />
        </button>
      )}

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: tap = rename sur mobile */}
      <h1
        className="text-2xl text-gray-900 font-semibold tracking-tight cursor-pointer active:opacity-60 transition-opacity"
        onClick={() => handleRenameFolder()}
      >
        {folderName}
      </h1>

      <div className="relative" ref={createMenuRef}>
        <button
          type="button"
          onClick={() => setShowCreateMenu((v) => !v)}
          className="w-8 h-8 flex items-center justify-center rounded-full text-amber-500 active:bg-black/5 transition-colors"
        >
          <SFIcon icon={sfPlus} className="size-5" />
        </button>

        {showCreateMenu && (
          <div
            className="absolute right-0 top-10 z-50 rounded-2xl overflow-hidden shadow-xl"
            style={{
              background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.6)",
              minWidth: 180,
            }}
          >
            <button
              type="button"
              onClick={async () => {
                setShowCreateMenu(false);
                await handleCreateNote();
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-900 active:bg-black/5 transition-colors border-b border-black/5"
            >
              <SFIcon
                icon={sfDocumentBadgePlus}
                className="size-4 text-blue-500"
              />
              Nouvelle note
            </button>
            <button
              type="button"
              onClick={async () => {
                setShowCreateMenu(false);
                await handleCreateFolder();
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-900 active:bg-black/5 transition-colors"
            >
              <SFIcon
                icon={sfFolderBadgePlus}
                className="size-4 text-yellow-500"
              />
              Nouveau dossier
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
