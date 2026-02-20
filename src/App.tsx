import { MilkdownEditor } from "./components/MilkdownEditor";
import { useFileTree } from "./hooks/useFileTree";
import { sfCheckmark, sfFolder } from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { SideBar } from "./components/SideBar";
import { useAtomValue } from "jotai";
import { activeNoteAtom, folderPathAtom, loadingAtom, savingAtom } from "./lib/atoms";
import { useNote } from "./hooks/useNote";
import { useEffect } from "react";

function WelcomeScreen({ onPick }: { onPick: () => void }) {
  return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4 text-center max-w-xs">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
          <SFIcon icon={sfFolder} className="size-4" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-gray-800">Aucun dossier sélectionné</p>
          <p className="text-sm text-gray-400 mt-1">
            Choisis un dossier contenant tes fichiers&nbsp;.md
          </p>
        </div>
        <button
          type="button"
          onClick={onPick}
          className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors cursor-pointer"
        >
          Choisir un dossier
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { pickFolder, initFolder } = useFileTree();
  const { handleCreateNote, handleChange } = useNote();

  const activeNote = useAtomValue(activeNoteAtom);
  const saving = useAtomValue(savingAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const loading = useAtomValue(loadingAtom);

  useEffect(() => {
    if (folderPath) initFolder();
  }, [folderPath]);

  if (!folderPath) return <WelcomeScreen onPick={pickFolder} />;

  return (
    <div className="h-screen flex bg-white text-gray-900 overflow-hidden text-sm">
      <SideBar />

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
        {activeNote && (
          <div className="flex items-center justify-end px-4 h-8 border-b border-gray-100 shrink-0">
            <span
              className={`flex items-center gap-1.5 text-xs transition-opacity ${saving ? "text-gray-400 opacity-100" : "text-gray-300 opacity-60"
                }`}
            >
              <SFIcon icon={sfCheckmark} className="size-3" aria-hidden="true" />
              {saving ? "Sauvegarde..." : "Sauvegardé"}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {activeNote ? (
            <MilkdownEditor
              key={activeNote.id}
              onChange={handleChange}
              className="h-full"
            />
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