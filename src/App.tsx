import { MilkdownEditor } from "./components/MilkdownEditor/MilkdownEditor";
import { useFileTree } from "./components/FileTree/hooks/useFileTree";
import { SideBar } from "./components/SideBar";
import { TabBar } from "./components/TabBar/TabBar";
import { useAtomValue, useSetAtom } from "jotai";
import {
  activeNoteAtom,
  folderPathAtom,
  loadingAtom,
  settingsOpenAtom,
} from "./lib/atoms.ts";
import { useNote } from "./hooks/useNote";
import { useVaultSync } from "./hooks/useVaultSync";
import { useEffect } from "react";
import { SettingsModal } from "./components/Settings/SettingsModal";
import { WelcomeScreen } from "./components/WelcomeScreen.tsx";
import { SavingIndicator } from "./components/SavingIndicator.tsx";

export default function App() {
  const { pickFolder, initFolder } = useFileTree();
  const { handleCreateNote } = useNote();
  useVaultSync();

  const activeNote = useAtomValue(activeNoteAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const loading = useAtomValue(loadingAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (folderPath) initFolder();
  }, [folderPath]);

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

  if (!folderPath) return <WelcomeScreen onPick={pickFolder} />;

  return (
    <div className="h-screen flex bg-white text-gray-900 overflow-hidden text-sm">
      <SettingsModal />
      <SideBar />

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
        <SavingIndicator />
        <TabBar />

        <div className="flex-1 overflow-auto">
          {activeNote ? (
            <MilkdownEditor key={activeNote.id} />
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
      </main>
    </div>
  );
}
