import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { NoteEditor } from "../shared/components/NoteEditor/NoteEditor.tsx";
import { registerDropListener } from "../shared/components/NoteEditor/dropListener.ts";
import {
  DESKTOP_HEADER_HEIGHT,
  useCaretScroll,
} from "../shared/hooks/useCaretScroll";
import { useFileTree } from "../shared/hooks/useFileTree";
import { useNote } from "../shared/hooks/useNote";
import { useVaultSync } from "../shared/hooks/useVaultSync";
import {
  activeNoteAtom,
  folderPathAtom,
  loadingAtom,
  settingsOpenAtom,
} from "../shared/lib/atoms";
import { SavingIndicator } from "./components/SavingIndicator.tsx";
import { SettingsModal } from "./components/Settings/SettingsModal";
import { SideBar } from "./components/SideBar/SideBar.tsx";
import { TabBar } from "./components/TabBar/TabBar";
import { WelcomeScreen } from "./components/WelcomeScreen.tsx";

export function DesktopApp() {
  const { pickFolder, initFolder, autoInitFolder } = useFileTree();
  const { handleCreateNote } = useNote();
  useVaultSync();

  const activeNote = useAtomValue(activeNoteAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const loading = useAtomValue(loadingAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (folderPath) initFolder();
  }, [folderPath]);

  // Sur macOS : si aucun vault persisté, auto-init sur le dossier iCloud dédié
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (!folderPath) autoInitFolder();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "," && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSettingsOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSettingsOpen]);

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
      <SettingsModal />
      <SideBar />

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
        <TabBar />

        <div className="flex-1 overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="w-full h-full overflow-auto overscroll-none"
            onScroll={handleScroll}
          >
            {activeNote ? (
              <NoteEditor key={activeNote.id} />
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
