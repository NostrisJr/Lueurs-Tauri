import { clsx } from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { useEffect } from "react";
import {
  KEY_ALL,
  type SpaceNavState,
  activeNoteIdAtom,
  activeSpaceAtom,
  noteBackStackAtom,
  openTabIdsAtom,
  spaceNavStateAtom,
  tabHistoryAtom,
  vaultConfigAtom,
} from "../../../shared/lib/atoms";

export function SpaceSwitcher() {
  const vaultConfig = useAtomValue(vaultConfigAtom);
  const [activeSpace, setActiveSpace] = useAtom(activeSpaceAtom);
  const [spaceNavState, setSpaceNavState] = useAtom(spaceNavStateAtom);
  const [openTabIds, setOpenTabIds] = useAtom(openTabIdsAtom);
  const [activeNoteId, setActiveNoteId] = useAtom(activeNoteIdAtom);
  const [tabHistory, setTabHistory] = useAtom(tabHistoryAtom);
  const [noteBackStack, setNoteBackStack] = useAtom(noteBackStackAtom);

  const spaces = vaultConfig?.spaces ?? [];

  // Purge la valeur obsolète en localStorage si l'espace actif n'existe plus
  useEffect(() => {
    if (activeSpace !== null && !spaces.some((s) => s.name === activeSpace)) {
      setActiveSpace(null);
    }
  }, [spaces, activeSpace, setActiveSpace]);

  if (spaces.length === 0) return null;

  function switchTo(newSpace: string | null) {
    if (newSpace === activeSpace) return;

    const currentKey = activeSpace ?? KEY_ALL;
    const newKey = newSpace ?? KEY_ALL;

    const current: SpaceNavState = {
      openTabIds,
      activeNoteId,
      tabHistory,
      noteBackStack,
    };
    setSpaceNavState((prev) => ({ ...prev, [currentKey]: current }));

    const saved = spaceNavState[newKey];
    setOpenTabIds(saved?.openTabIds ?? []);
    setActiveNoteId(saved?.activeNoteId ?? null);
    setTabHistory(saved?.tabHistory ?? []);
    setNoteBackStack(saved?.noteBackStack ?? []);
    setActiveSpace(newSpace);
  }

  return (
    <div className="shrink-0 px-2 py-2 flex gap-1 items-center justify-start overflow-x-scroll border-t border-gray-100/60 scrollbar-none">
      <button
        type="button"
        onClick={() => switchTo(null)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors cursor-pointer ${
          activeSpace === null
            ? "bg-gray-800 text-white"
            : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        }`}
      >
        Tout
      </button>
      {spaces.map((space) => {
        const isActive = activeSpace === space.name;
        const showIconOnly = !!(vaultConfig?.iconOnly && space.icon);
        return (
          <button
            key={space.name}
            type="button"
            onClick={() => switchTo(space.name)}
            title={showIconOnly ? space.name : undefined}
            className={clsx(
              "flex items-center justify-center transition-colors cursor-pointer",
              showIconOnly
                ? "size-7 shrink-0 rounded-full text-sm"
                : "flex-1 gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap",
              isActive
                ? space.color
                  ? "text-white"
                  : "bg-gray-800 text-white"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            )}
            style={
              isActive && space.color
                ? {
                    backgroundColor: `rgb(from ${space.color} r g b / 0.6)`,
                  }
                : undefined
            }
          >
            {showIconOnly ? (
              <span>{space.icon}</span>
            ) : (
              <div className="flex whitespace-nowrap items-center justify-center gap-1">
                {space.icon && <span className="shrink-0">{space.icon}</span>}
                {space.name}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
