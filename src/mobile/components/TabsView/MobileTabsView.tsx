import { useAtomValue, useSetAtom } from "jotai";
import {
  IconChevronLeft,
  IconXmark,
} from "../../../shared/components/PlatformIcon";
import { useNote } from "../../../shared/hooks/useNote";
import {
  activeNoteIdAtom,
  mobileGoBackAtom,
  mobileNavigateAtom,
  mobileResetNavAtom,
  noteBackStackAtom,
  notesByIdAtom,
  openTabIdsAtom,
} from "../../../shared/lib/atoms";
import { hapticImpact } from "../../lib/haptics";
import { FileRow } from "../FileTree/FileRow";
import { clsx } from "clsx";
import { isIOS } from "../../../shared/lib/platform";

export function MobileTabsView() {
  const openTabIds = useAtomValue(openTabIdsAtom);
  const notesById = useAtomValue(notesByIdAtom);
  const goBack = useSetAtom(mobileGoBackAtom);
  const resetNav = useSetAtom(mobileResetNavAtom);
  const navigate = useSetAtom(mobileNavigateAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
  const setNoteBackStack = useSetAtom(noteBackStackAtom);
  const { handleCloseTab } = useNote();

  function handleSelectTab(id: string) {
    hapticImpact("light");
    setNoteBackStack([]);
    setActiveNoteId(id);
    resetNav();
    navigate("editor");
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div
        className={clsx(
          "flex items-center justify-between px-4 py-3 bg-white",
          isIOS ? "pt-13" : "pt-3"
        )}
      >
        <button
          type="button"
          onClick={() => {
            hapticImpact("light");
            goBack();
          }}
          className="flex items-center justify-center w-8 h-8 rounded-full text-amber-500 active:bg-black/5 transition-colors"
        >
          <IconChevronLeft className="size-4" />
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
        className="flex-1 overflow-auto py-4 flex flex-col gap-2"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        {openTabIds.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">
            Aucun onglet ouvert
          </p>
        ) : (
          openTabIds.map((id) => {
            const note = notesById.get(id);
            if (!note) return null;

            return (
              <div key={id} className="relative w-11/12 mx-auto">
                <FileRow
                  node={note}
                  onDrillIn={() => {}}
                  onClick={() => handleSelectTab(id)}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticImpact("light");
                    handleCloseTab(id);
                  }}
                  className="absolute top-2 right-3 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center active:bg-gray-300 transition-colors z-10"
                >
                  <IconXmark className="size-3 text-gray-500" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
