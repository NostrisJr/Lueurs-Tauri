import { useAtomValue, useSetAtom } from "jotai";
import { Suspense, lazy, useCallback, useEffect, useRef } from "react";
import { MediaViewer } from "../shared/components/MediaViewer/MediaViewer";
import { NoteEditor } from "../shared/components/NoteEditor/NoteEditor.tsx";
import { registerDropListener } from "../shared/components/NoteEditor/lib/dropListener.ts";
import {
  DESKTOP_HEADER_HEIGHT,
  useCaretScroll,
} from "../shared/hooks/useCaretScroll";
import { useFileTree } from "../shared/hooks/useFileTree";
import { useNote } from "../shared/hooks/useNote";
import { useVaultSync } from "../shared/hooks/useVaultSync";
import {
  activeMediaAtom,
  activeNoteAtom,
  dictaphoneOpenAtom,
  exportDialogOpenAtom,
  folderPathAtom,
  loadingAtom,
  pendingAudioInsertAtom,
  settingsOpenAtom,
} from "../shared/lib/atoms";
import { NoteType } from "../shared/lib/noteTypes";
import { SavingIndicator } from "./components/SavingIndicator.tsx";
import { SideBar } from "./components/SideBar/SideBar.tsx";
import { TabBar } from "./components/TabBar/TabBar";
import { Toast } from "./components/Toast.tsx";
import { WelcomeScreen } from "./components/WelcomeScreen.tsx";
import { useMenuEvents } from "./hooks/useMenuEvents";

const DesktopDictaphone = lazy(() =>
  import("./components/Dictaphone/DesktopDictaphone.tsx").then((m) => ({
    default: m.DesktopDictaphone,
  }))
);
const ExportDialog = lazy(() =>
  import("./components/Export/ExportDialog.tsx").then((m) => ({
    default: m.ExportDialog,
  }))
);
const SettingsModal = lazy(() =>
  import("./components/Settings/SettingsModal").then((m) => ({
    default: m.SettingsModal,
  }))
);

export function DesktopApp() {
  const { pickFolder, initFolder, autoInitFolder } = useFileTree();
  const { handleCreateNote } = useNote();
  useVaultSync();
  useMenuEvents();

  const activeNote = useAtomValue(activeNoteAtom);
  const activeMedia = useAtomValue(activeMediaAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const loading = useAtomValue(loadingAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setExportOpen = useSetAtom(exportDialogOpenAtom);
  const dictaphoneOpen = useAtomValue(dictaphoneOpenAtom);
  const setDictaphoneOpen = useSetAtom(dictaphoneOpenAtom);
  const setPendingAudioInsert = useSetAtom(pendingAudioInsertAtom);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef(new Map<string, number>());
  useCaretScroll(scrollContainerRef, { topInset: DESKTOP_HEADER_HEIGHT });

  const handleScroll = useCallback(() => {
    if (activeNote && scrollContainerRef.current) {
      scrollPositions.current.set(
        activeNote.id,
        scrollContainerRef.current.scrollTop
      );
    }
  }, [activeNote]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !activeNote) return;
    const saved = scrollPositions.current.get(activeNote.id) ?? 0;
    const raf = requestAnimationFrame(() => {
      container.scrollTop = saved;
    });
    return () => cancelAnimationFrame(raf);
  }, [activeNote]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: initFolder est un callback stable (useCallback sans deps) — l'omettre évite une double exécution au montage
  useEffect(() => {
    if (folderPath) initFolder();
  }, [folderPath]);

  // Sur macOS : si aucun vault persisté, auto-init sur le dossier iCloud dédié
  // biome-ignore lint/correctness/useExhaustiveDependencies: autoInitFolder est stable — n'exécuter qu'au montage, pas à chaque changement de la référence de fonction
  useEffect(() => {
    if (!folderPath) autoInitFolder();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "," && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        setSettingsOpen(true);
      }
      // Capture avant ProseMirror (Mod-Shift-s est pris par barré dans l'éditeur)
      if (e.key === "w" && (e.metaKey || e.ctrlKey) && e.shiftKey && activeNote) {
        e.preventDefault();
        e.stopPropagation();
        setExportOpen(true);
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [setSettingsOpen, setExportOpen, activeNote]);

  // Listener drop natif (audio/images), enregistré pour toute la session desktop.
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    registerDropListener()
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch((err) => {
        // Log déjà fait dans registerDropListener côté succès ; ici on remonte l'échec.
        console.error("registerDropListener failed", err);
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  if (!folderPath) return <WelcomeScreen onPick={pickFolder} />;

  return (
    <div className="h-screen flex text-gray-900 overflow-hidden text-sm">
      <Suspense fallback={null}>
        <SettingsModal />
        <ExportDialog />
      </Suspense>
      <Toast />
      <SideBar />

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
        <TabBar />

        <div className="relative flex-1 overflow-hidden">
          {activeNote &&
            activeNote.type !== NoteType.BASE &&
            dictaphoneOpen && (
              <Suspense fallback={null}>
                <DesktopDictaphone
                  onInsert={(path, title) => {
                    setPendingAudioInsert({ path, title });
                    setDictaphoneOpen(false);
                  }}
                  onClose={() => setDictaphoneOpen(false)}
                />
              </Suspense>
            )}

          <div
            ref={scrollContainerRef}
            className="w-full h-full overflow-auto overscroll-none"
            onScroll={handleScroll}
          >
            {activeNote ? (
              <NoteEditor key={activeNote.id} />
            ) : activeMedia ? (
              <MediaViewer key={activeMedia.id} media={activeMedia} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <p className="text-sm text-gray-400">
                  {loading ? "Chargement..." : "Sélectionne ou crée une note"}
                </p>
                {!loading && (
                  <button
                    type="button"
                    onClick={handleCreateNote}
                    className="px-3 py-1.5 rounded-md bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    Créer une note
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <SavingIndicator />
      </main>
    </div>
  );
}
