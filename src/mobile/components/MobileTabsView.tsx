import { useAtomValue, useSetAtom } from "jotai";
import {
  openTabIdsAtom,
  treeAtom,
  mobileViewAtom,
  activeNoteIdAtom,
  noteBackStackAtom,
} from "../../shared/lib/Atoms";
import { flattenTree } from "../../shared/hooks/useFileTree";
import { useNote } from "../../shared/hooks/useNote";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { sfXmark, sfChevronLeft } from "@bradleyhodges/sfsymbols";

export function MobileTabsView() {
  const openTabIds = useAtomValue(openTabIdsAtom);
  const tree = useAtomValue(treeAtom);
  const allNotes = flattenTree(tree);
  const setMobileView = useSetAtom(mobileViewAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
  const setNoteBackStack = useSetAtom(noteBackStackAtom);
  const { handleCloseTab } = useNote();

  function handleSelectTab(id: string) {
    setNoteBackStack([]);
    setActiveNoteId(id);
    setMobileView("editor");
  }

  function handleClose() {
    setMobileView("filetree");
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 pt-12">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center gap-1 text-blue-500 active:opacity-60 transition-opacity"
        >
          <SFIcon icon={sfChevronLeft} className="size-4" />
          <span className="text-sm">Retour</span>
        </button>
        <h1 className="font-semibold text-gray-900">
          {openTabIds.length} onglet{openTabIds.length > 1 ? "s" : ""}
        </h1>
        <button
          type="button"
          onClick={() => {
            for (const id of [...openTabIds]) handleCloseTab(id);
            handleClose();
          }}
          className="text-sm text-red-500 active:opacity-60 transition-opacity"
        >
          Tout fermer
        </button>
      </div>

      {/* Grille d'onglets */}
      <div
        className="flex-1 overflow-auto px-4 pb-4 pt-8"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        {openTabIds.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">
            Aucun onglet ouvert
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {openTabIds.map((id) => {
              const note = allNotes.find((n) => n.id === id);
              if (!note) return null;
              const preview = note.body
                .replace(/^---[\s\S]*?---\n/, "")
                .slice(0, 80)
                .trim();

              return (
                <div key={id} className="relative">
                  <button
                    type="button"
                    onClick={() => handleSelectTab(id)}
                    className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-semibold text-gray-900 truncate mb-1">
                      {note.name}
                    </p>
                    {preview ? (
                      <p className="text-xs text-gray-400 line-clamp-3">
                        {preview}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-300 italic">Vide</p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCloseTab(id)}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center shadow active:bg-gray-600 transition-colors"
                  >
                    <SFIcon icon={sfXmark} className="size-3 text-white" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
