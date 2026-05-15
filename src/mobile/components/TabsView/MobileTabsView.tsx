import { sfChevronLeft, sfXmark } from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { useAtomValue, useSetAtom } from "jotai";
import { flattenTree } from "../../../shared/hooks/useFileTree";
import { useNote } from "../../../shared/hooks/useNote";
import {
  activeNoteIdAtom,
  mobileGoBackAtom,
  mobileResetNavAtom,
  noteBackStackAtom,
  openTabIdsAtom,
  treeAtom,
} from "../../../shared/lib/Atoms";
import { hapticImpact } from "../../lib/haptics";

export function MobileTabsView() {
  const openTabIds = useAtomValue(openTabIdsAtom);
  const tree = useAtomValue(treeAtom);
  const allNotes = flattenTree(tree);
  const goBack = useSetAtom(mobileGoBackAtom);
  const resetNav = useSetAtom(mobileResetNavAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
  const setNoteBackStack = useSetAtom(noteBackStackAtom);
  const { handleCloseTab } = useNote();

  function handleSelectTab(id: string) {
    hapticImpact("light");
    setNoteBackStack([]);
    setActiveNoteId(id);
    resetNav();
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 pt-12">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => {
            hapticImpact("light");
            goBack();
          }}
          className="flex items-center justify-center w-8 h-8 rounded-full text-amber-500 active:bg-black/5 transition-colors"
        >
          <SFIcon icon={sfChevronLeft} className="size-4" />
        </button>
        <h1 className="font-semibold text-gray-900">
          {openTabIds.length} onglet{openTabIds.length > 1 ? "s" : ""}
        </h1>
        <button
          type="button"
          onClick={() => {
            hapticImpact("medium");
            for (const id of [...openTabIds]) handleCloseTab(id);
            goBack();
          }}
          className="text-sm text-red-500 active:opacity-60 transition-opacity"
        >
          Tout fermer
        </button>
      </div>

      {/* Liste d'onglets */}
      <div
        className="flex-1 overflow-auto px-4 pt-4"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        {openTabIds.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">
            Aucun onglet ouvert
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {openTabIds.map((id) => {
              const note = allNotes.find((n) => n.id === id);
              if (!note) return null;
              const preview = note.body
                .replace(/^---[\s\S]*?---\n/, "")
                .slice(0, 120)
                .trim();

              return (
                <div key={id} className="relative">
                  <button
                    type="button"
                    onClick={() => handleSelectTab(id)}
                    className="w-full text-left bg-white rounded-2xl px-4 py-3.5 shadow-xs border border-gray-100 active:bg-gray-50 transition-colors"
                  >
                    <p className="text-base font-semibold text-gray-900 truncate mb-0.5">
                      {note.name}
                    </p>
                    {preview ? (
                      <p className="text-sm text-gray-400 line-clamp-2">
                        {preview}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-300 italic">Vide</p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticImpact("light");
                      handleCloseTab(id);
                    }}
                    className="absolute top-2 right-3 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center active:bg-gray-300 transition-colors"
                  >
                    <SFIcon icon={sfXmark} className="size-3 text-gray-500" />
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
