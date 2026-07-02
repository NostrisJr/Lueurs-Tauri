import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import {
  IconChevronLeft,
  IconDocumentBadgePlus,
  IconEllipsis,
  IconFolderBadgePlus,
  IconGearshape,
} from "../../../shared/components/PlatformIcon";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import {
  activeSpaceAtom,
  folderPathAtom,
  folderStackAtom,
  inboxAbsPathAtom,
  mobileContextMenuAtom,
  mobileNavigateAtom,
  vaultConfigAtom,
} from "../../../shared/lib/atoms";
import { isIOS } from "../../../shared/lib/platform";
import { useMobileSelectNote } from "../../hooks/useMobileSelectNote";
import { hapticImpact } from "../../lib/haptics";
import { vaultDisplayName } from "../../lib/vault";

export function FileTreeHeader() {
  const folderStack = useAtomValue(folderStackAtom);
  const setFolderStack = useSetAtom(folderStackAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const inboxPath = useAtomValue(inboxAbsPathAtom);
  const setContextMenu = useSetAtom(mobileContextMenuAtom);
  const navigate = useSetAtom(mobileNavigateAtom);
  const activeSpace = useAtomValue(activeSpaceAtom);
  const vaultConfig = useAtomValue(vaultConfigAtom);
  const { createNote, createFolder } = useFileTree();
  const selectNote = useMobileSelectNote();

  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentFolder = folderStack[folderStack.length - 1] ?? null;
  const canGoBack = folderStack.length > 1;
  const vaultName = folderPath ? vaultDisplayName(folderPath) : undefined;
  // À la racine d'un espace : nom (et emoji) de l'espace au lieu du nom du vault
  const space = activeSpace
    ? vaultConfig?.spaces.find((s) => s.name === activeSpace)
    : undefined;
  const rootName = space
    ? `${space.icon ? `${space.icon} ` : ""}${space.name}`
    : (vaultName ?? "Notes");
  const folderName = currentFolder?.name ?? rootName;

  function handleDrillOut() {
    hapticImpact("light");
    setFolderStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  async function handleCreateNote() {
    setShowMenu(false);
    hapticImpact("light");
    const path = currentFolder?.id ?? inboxPath ?? folderPath ?? "";
    const note = await createNote(path);
    selectNote(note);
  }

  async function handleCreateFolder() {
    setShowMenu(false);
    hapticImpact("light");
    const path = currentFolder?.id ?? folderPath ?? "";
    await createFolder(path);
  }

  function handleOpenSettings() {
    setShowMenu(false);
    hapticImpact("light");
    navigate("settings");
  }

  // Listener attaché systématiquement, gating à l'intérieur, pour garantir la
  // symétrie attach/detach même si le composant se démonte avec showMenu=true.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!showMenu) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  return (
    <div
      className={clsx(
        "px-5 pb-2 flex items-end justify-between",
        isIOS ? "pt-4" : "pt-0"
      )}
    >
      {canGoBack ? (
        <button
          type="button"
          onClick={handleDrillOut}
          className="w-8 h-8 flex items-center justify-center rounded-full text-amber-500 active:bg-black/5 transition-colors"
        >
          <IconChevronLeft className="size-4" />
        </button>
      ) : (
        <div className="w-8 h-8" />
      )}

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: tap = rename sur mobile */}
      <h1
        className="text-2xl text-gray-900 font-semibold tracking-tight cursor-pointer active:opacity-60 transition-opacity"
        onClick={() => {
          if (currentFolder) {
            hapticImpact("light");
            setContextMenu({
              id: currentFolder.id,
              name: currentFolder.name,
              isFolder: true,
            });
          }
        }}
      >
        {folderName}
      </h1>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => {
            hapticImpact("light");
            setShowMenu((v) => !v);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full text-amber-500 active:bg-black/5 transition-colors"
          aria-label="Menu"
        >
          <IconEllipsis className="size-5" />
        </button>

        {showMenu && (
          <div
            className="absolute right-0 top-10 z-50 rounded-2xl overflow-hidden shadow-xl"
            style={{
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              border: "1px solid rgba(0,0,0,0.06)",
              minWidth: 200,
            }}
          >
            <button
              type="button"
              onClick={handleCreateNote}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-900 active:bg-black/5 transition-colors border-b border-black/5"
            >
              <IconDocumentBadgePlus className="size-4 text-blue-500" />
              Nouvelle note
            </button>
            <button
              type="button"
              onClick={handleCreateFolder}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-900 active:bg-black/5 transition-colors border-b border-black/5"
            >
              <IconFolderBadgePlus className="size-4 text-yellow-500" />
              Nouveau dossier
            </button>
            <button
              type="button"
              onClick={handleOpenSettings}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-900 active:bg-black/5 transition-colors"
            >
              <IconGearshape className="size-4 text-gray-500" />
              Réglages
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
