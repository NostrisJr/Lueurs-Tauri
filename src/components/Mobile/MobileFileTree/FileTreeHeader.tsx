import { useRef, useState, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { folderStackAtom, folderPathAtom } from "../../../lib/atoms.ts";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import {
  sfChevronLeft,
  sfPlus,
  sfDocumentBadgePlus,
  sfFolderBadgePlus,
} from "@bradleyhodges/sfsymbols";

interface Props {
  onRenameCurrentFolder: () => void;
  onCreateNote: () => Promise<void>; // chemin géré par le parent
  onCreateFolder: () => Promise<void>;
}

export function FileTreeHeader({
  onRenameCurrentFolder,
  onCreateNote,
  onCreateFolder,
}: Props) {
  const folderStack = useAtomValue(folderStackAtom);
  const setFolderStack = useSetAtom(folderStackAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  const currentFolder = folderStack[folderStack.length - 1] ?? null;
  const canGoBack = folderStack.length > 1;
  const folderName =
    currentFolder?.name ?? folderPath?.split("/").pop() ?? "Notes";

  function handleDrillOut() {
    setFolderStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
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
    <div className="px-5 pt-4 pb-2 flex items-end justify-between">
      <button
        type="button"
        onClick={canGoBack ? handleDrillOut : undefined}
        className="w-8 h-8 flex items-center justify-center rounded-full text-blue-500 active:bg-black/5 transition-colors"
        style={{ visibility: canGoBack ? "visible" : "hidden" }}
      >
        <SFIcon icon={sfChevronLeft} className="size-4" />
      </button>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: tap = rename sur mobile */}
      <h1
        className={`text-2xl font-bold text-gray-900 tracking-tight ${currentFolder ? "cursor-pointer active:opacity-60 transition-opacity" : ""}`}
        onClick={currentFolder ? onRenameCurrentFolder : undefined}
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
                await onCreateNote();
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
                await onCreateFolder();
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
  );
}
