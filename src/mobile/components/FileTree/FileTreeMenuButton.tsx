import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import {
  IconArrowUturnBackward,
  IconArrowUturnForward,
  IconDocumentBadgePlus,
  IconEllipsis,
  IconFolderBadgePlus,
  IconGearshape,
} from "../../../shared/components/PlatformIcon";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import {
  activeSpaceAtom,
  fileRedoStackAtom,
  fileUndoStackAtom,
  folderPathAtom,
  folderStackAtom,
  inboxAbsPathAtom,
  mobileNavigateAtom,
  mobileSettingsScrollTargetAtom,
} from "../../../shared/lib/atoms";
import { iconAccentClass } from "../../../shared/lib/platform";
import { useMobileSelectNote } from "../../hooks/useMobileSelectNote";
import { hapticImpact } from "../../lib/haptics";

// Monté puis rendu visible une frame plus tard (cf. MobileFormattingBar) pour
// que la transition CSS ait deux états distincts à interpoler, à l'ouverture
// comme à la fermeture, plutôt qu'un menu qui apparaît/disparaît d'un coup.
const MENU_ANIM_MS = 180;
// Le contenu (texte/icônes) doit disparaître plus vite que le fond flouté à la
// fermeture, sinon il semble "traîner" derrière l'animation du conteneur.
const MENU_TEXT_ANIM_MS = 100;

export function FileTreeMenuButton() {
  const folderStack = useAtomValue(folderStackAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const inboxPath = useAtomValue(inboxAbsPathAtom);
  const activeSpace = useAtomValue(activeSpaceAtom);
  const navigate = useSetAtom(mobileNavigateAtom);
  const setSettingsScrollTarget = useSetAtom(mobileSettingsScrollTargetAtom);
  const { createNote, createFolder, undo, redo } = useFileTree();
  const undoStack = useAtomValue(fileUndoStackAtom);
  const redoStack = useAtomValue(fileRedoStackAtom);
  const selectNote = useMobileSelectNote();

  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuRendered, setMenuRendered] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    if (showMenu) {
      setMenuRendered(true);
      const raf = requestAnimationFrame(() => setMenuVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setMenuVisible(false);
    const t = setTimeout(() => setMenuRendered(false), MENU_ANIM_MS);
    return () => clearTimeout(t);
  }, [showMenu]);

  const currentFolder = folderStack[folderStack.length - 1] ?? null;

  async function handleCreateNote() {
    setShowMenu(false);
    hapticImpact("light");
    const path = currentFolder?.id ?? inboxPath ?? folderPath ?? "";
    const note = await createNote(path, activeSpace);
    selectNote(note);
  }

  async function handleCreateFolder() {
    setShowMenu(false);
    hapticImpact("light");
    const path = currentFolder?.id ?? folderPath ?? "";
    await createFolder(path, activeSpace);
  }

  function handleOpenSettings() {
    setShowMenu(false);
    hapticImpact("light");
    setSettingsScrollTarget(null);
    navigate("settings");
  }

  function handleUndo() {
    setShowMenu(false);
    hapticImpact("light");
    undo();
  }

  function handleRedo() {
    setShowMenu(false);
    hapticImpact("light");
    redo();
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
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => {
          hapticImpact("light");
          setShowMenu((v) => !v);
        }}
        className={`w-8 h-8 flex items-center justify-center rounded-full ${iconAccentClass} active:bg-black/5 transition-colors`}
        aria-label="Menu"
      >
        <IconEllipsis className="size-5" />
      </button>

      {menuRendered && (
        <>
          {/* Dropplane quasi-transparent : un tap ailleurs ferme le menu sans
              jamais atteindre ce qu'il y a en dessous (note, titre…). */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay tactile de fermeture */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.01)" }}
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-10 z-50">
            {/* Fond flouté : seul calque scalé. Le texte (calque séparé
                ci-dessous) n'est jamais mis à l'échelle, sinon son rendu
                "tressaute" pendant la transition (sous-pixel + backdrop-filter
                recalculé à chaque frame de scale). */}
            <div
              className="absolute inset-0 rounded-2xl shadow-xl"
              style={{
                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(40px) saturate(180%)",
                WebkitBackdropFilter: "blur(40px) saturate(180%)",
                border: "1px solid rgba(0,0,0,0.06)",
                transformOrigin: "top right",
                transform: menuVisible ? "scale(1)" : "scale(0.85)",
                opacity: menuVisible ? 1 : 0,
                transition: `transform ${MENU_ANIM_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity ${MENU_ANIM_MS}ms ease-out`,
                willChange: "transform, opacity",
              }}
            />
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                minWidth: 200,
                maxWidth: 280,
                opacity: menuVisible ? 1 : 0,
                transform: menuVisible ? "translateY(0)" : "translateY(-6px)",
                transition: `opacity ${MENU_TEXT_ANIM_MS}ms ease-out, transform ${MENU_TEXT_ANIM_MS}ms ease-out`,
              }}
            >
              {(undoStack.length > 0 || redoStack.length > 0) && (
                <>
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-900 active:bg-black/5 disabled:opacity-30 disabled:active:bg-transparent transition-colors border-b border-black/5"
                  >
                    <IconArrowUturnBackward className="size-4 text-gray-500 shrink-0" />
                    <span className="truncate text-left">
                      {undoStack.length > 0
                        ? `Annuler : ${undoStack[undoStack.length - 1].label}`
                        : "Annuler"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-900 active:bg-black/5 disabled:opacity-30 disabled:active:bg-transparent transition-colors border-b border-black/5"
                  >
                    <IconArrowUturnForward className="size-4 text-gray-500 shrink-0" />
                    <span className="truncate text-left">
                      {redoStack.length > 0
                        ? `Rétablir : ${redoStack[redoStack.length - 1].label}`
                        : "Rétablir"}
                    </span>
                  </button>
                </>
              )}
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
          </div>
        </>
      )}
    </div>
  );
}
