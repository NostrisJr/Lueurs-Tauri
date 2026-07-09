import { clsx } from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import { IconChevronLeft } from "../../../shared/components/PlatformIcon";
import { useNote } from "../../../shared/hooks/useNote";
import {
  activeNoteIdAtom,
  mobileGoBackAtom,
  mobileNavigateAtom,
  mobileResetNavAtom,
  noteBackStackAtom,
  openTabIdsAtom,
  tabNodeByIdAtom,
} from "../../../shared/lib/atoms";
import { iconAccentClass, isIOS } from "../../../shared/lib/platform";
import { hapticImpact } from "../../lib/haptics";
import { FileRow } from "../FileTree/FileRow";
import { MobileSpaceSwitcher } from "../Floating/MobileSpaceSwitcher";
import { SwipeableTabRow } from "./SwipeableTabRow";

export function MobileTabsView() {
  const openTabIds = useAtomValue(openTabIdsAtom);
  const tabNodeById = useAtomValue(tabNodeByIdAtom);
  const goBack = useSetAtom(mobileGoBackAtom);
  const resetNav = useSetAtom(mobileResetNavAtom);
  const navigate = useSetAtom(mobileNavigateAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
  const setNoteBackStack = useSetAtom(noteBackStackAtom);
  const { handleCloseTab, handleCloseAllTabs } = useNote();

  function handleSelectTab(id: string) {
    hapticImpact("light");
    setNoteBackStack([]);
    setActiveNoteId(id);
    resetNav();
    navigate("editor");
  }

  return (
    <div className="relative flex flex-col h-screen bg-gray-100">
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
          className={`flex items-center justify-center w-8 h-8 rounded-full ${iconAccentClass} active:bg-black/5 transition-colors`}
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
            handleCloseAllTabs();
            resetNav();
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
            const node = tabNodeById(id);
            if (!node) return null;

            return (
              <div key={id} className="w-11/12 mx-auto">
                <SwipeableTabRow onClose={() => handleCloseTab(id)}>
                  <FileRow
                    node={node}
                    onDrillIn={() => {}}
                    onClick={() => handleSelectTab(id)}
                  />
                </SwipeableTabRow>
              </div>
            );
          })
        )}
      </div>

      <MobileSpaceSwitcher />
    </div>
  );
}
