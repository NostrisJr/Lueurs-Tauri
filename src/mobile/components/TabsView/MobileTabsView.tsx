import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useRef, useState } from "react";
import {
  IconChevronLeft,
  IconTrash,
} from "../../../shared/components/PlatformIcon";
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
import { iconAccentClass } from "../../../shared/lib/platform";
import { hapticImpact } from "../../lib/haptics";
import { FloatingCollapsibleTitle } from "../Floating/FloatingCollapsibleTitle";
import {
  FLOATING_HEADER_LIST_GAP,
  FLOATING_HEADER_SCROLL_OFFSET,
  FloatingHeaderBar,
  TITLE_COLLAPSE_RANGE,
  TITLE_COLLAPSE_START,
} from "../Floating/FloatingHeaderBar";
import { MobileSpaceSwitcher } from "../Floating/MobileSpaceSwitcher";
import { TabCard } from "./TabCard";

export function MobileTabsView() {
  const openTabIds = useAtomValue(openTabIdsAtom);
  const tabNodeById = useAtomValue(tabNodeByIdAtom);
  const goBack = useSetAtom(mobileGoBackAtom);
  const resetNav = useSetAtom(mobileResetNavAtom);
  const navigate = useSetAtom(mobileNavigateAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
  const setNoteBackStack = useSetAtom(noteBackStackAtom);
  const setOpenTabIds = useSetAtom(openTabIdsAtom);
  const { handleCloseTab, handleCloseAllTabs } = useNote();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [titleCollapseProgress, setTitleCollapseProgress] = useState(0);
  const titleCollapseProgressRef = useRef(0);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const progress = Math.min(
      Math.max(
        (container.scrollTop - TITLE_COLLAPSE_START) / TITLE_COLLAPSE_RANGE,
        0
      ),
      1
    );
    if (progress !== titleCollapseProgressRef.current) {
      titleCollapseProgressRef.current = progress;
      setTitleCollapseProgress(progress);
    }
  }, []);

  function handleSelectTab(id: string) {
    hapticImpact("light");
    setNoteBackStack([]);
    setActiveNoteId(id);
    resetNav();
    navigate("editor");
  }

  function handleClose(id: string) {
    if (handleCloseTab(id)) resetNav();
  }

  function handleCloseOthers(id: string) {
    hapticImpact("medium");
    setOpenTabIds([id]);
    setActiveNoteId(id);
  }

  // Même technique de fondu que MobileEditor/MobileFileTree : le contenu qui
  // traverse la zone sous la barre translucide s'estompe plutôt que d'être
  // coupé net par l'overflow.
  const headerFadeZoneHeight = FLOATING_HEADER_SCROLL_OFFSET * 1.45;
  const headerFadeTopAlpha = 1 - titleCollapseProgress;
  const headerFadeMidAlpha = 1 - titleCollapseProgress * 0.96;
  const headerFadeMask = `linear-gradient(to bottom, rgba(0,0,0,${headerFadeTopAlpha}) 0, rgba(0,0,0,${headerFadeMidAlpha}) ${
    headerFadeZoneHeight * 0.8
  }px, black ${headerFadeZoneHeight}px)`;

  return (
    <div className="relative flex flex-col h-screen bg-gray-100">
      <FloatingHeaderBar
        collapseProgress={titleCollapseProgress}
        rightPill={openTabIds.length > 0}
        left={
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
        }
        center={
          <FloatingCollapsibleTitle
            text={`${openTabIds.length} onglet${openTabIds.length > 1 ? "s" : ""}`}
            collapseProgress={titleCollapseProgress}
          />
        }
        right={
          openTabIds.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                hapticImpact("medium");
                handleCloseAllTabs();
                resetNav();
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full text-red-500 active:bg-black/5 transition-colors"
              aria-label="Tout fermer"
              title="Tout fermer"
            >
              <IconTrash className="size-4.5" />
            </button>
          ) : (
            <div className="w-8 h-8" />
          )
        }
      />

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
        style={{
          paddingTop: FLOATING_HEADER_SCROLL_OFFSET + FLOATING_HEADER_LIST_GAP,
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          maskImage: headerFadeMask,
          WebkitMaskImage: headerFadeMask,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
        }}
      >
        {openTabIds.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">
            Aucun onglet ouvert
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 w-11/12 mx-auto">
            {openTabIds.map((id) => {
              const node = tabNodeById(id);
              if (!node) return null;
              return (
                <TabCard
                  key={id}
                  node={node}
                  hasOtherTabs={openTabIds.length > 1}
                  onSelect={() => handleSelectTab(id)}
                  onClose={() => handleClose(id)}
                  onCloseOthers={() => handleCloseOthers(id)}
                />
              );
            })}
          </div>
        )}
      </div>

      <MobileSpaceSwitcher />
    </div>
  );
}
