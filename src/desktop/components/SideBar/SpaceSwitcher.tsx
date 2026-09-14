import { clsx } from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import {
  ACTIVE_SPACE_STORAGE_KEY,
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
import { hexToRgba } from "../../../shared/lib/color";
import {
  ALL_SPACE_ID,
  type VaultSpace,
  buildOrderedSpaces,
} from "../../../shared/lib/vaultConfig";

export function SpaceSwitcher() {
  const vaultConfig = useAtomValue(vaultConfigAtom);
  const [activeSpace, setActiveSpace] = useAtom(activeSpaceAtom);
  const [spaceNavState, setSpaceNavState] = useAtom(spaceNavStateAtom);
  const [openTabIds, setOpenTabIds] = useAtom(openTabIdsAtom);
  const [activeNoteId, setActiveNoteId] = useAtom(activeNoteIdAtom);
  const [tabHistory, setTabHistory] = useAtom(tabHistoryAtom);
  const [noteBackStack, setNoteBackStack] = useAtom(noteBackStackAtom);

  const spaces = vaultConfig?.spaces ?? [];
  const orderedSpaces = vaultConfig
    ? buildOrderedSpaces(spaces, vaultConfig)
    : [];

  // Purge la valeur obsolète uniquement quand la config vault est réellement chargée
  useEffect(() => {
    if (!vaultConfig) return;
    if (activeSpace !== null && !spaces.some((s) => s.name === activeSpace)) {
      setActiveSpace(null);
    }
  }, [vaultConfig, spaces, activeSpace, setActiveSpace]);

  // Premier lancement (clé absente de localStorage) : sélectionner le premier espace de la liste
  const initDoneRef = useRef(false);
  useEffect(() => {
    if (initDoneRef.current || !vaultConfig || orderedSpaces.length === 0)
      return;
    initDoneRef.current = true;
    const stored = localStorage.getItem(ACTIVE_SPACE_STORAGE_KEY);
    if (stored !== null) return; // déjà persisté
    const first = orderedSpaces[0];
    if (first && first.id !== ALL_SPACE_ID) {
      setActiveSpace((first as VaultSpace).name);
    }
    // Si "Tout" est premier, activeSpace reste null — comportement correct
  }, [vaultConfig, orderedSpaces, setActiveSpace]);

  if (orderedSpaces.length === 0) return null;

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
    <div
      className={clsx(
        "shrink-0 px-2 py-2 flex gap-1 items-center justify-start overflow-x-scroll border-t scrollbar-none",
        "border-line/60"
      )}
    >
      {orderedSpaces.map((entry) => {
        if (entry.id === ALL_SPACE_ID) {
          const isActive = activeSpace === null;
          const showIconOnly = !!(vaultConfig?.iconOnly && entry.icon);
          return (
            <button
              key="__all__"
              type="button"
              onClick={() => switchTo(null)}
              title={showIconOnly ? "Tout" : undefined}
              className={clsx(
                "flex items-center justify-center transition-colors cursor-pointer",
                showIconOnly
                  ? "size-7 shrink-0 rounded-full text-sm"
                  : "flex-1 gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap",
                isActive
                  ? "bg-inverse text-on-inverse"
                  : "text-ink-3 hover:bg-surface-3 hover:text-ink-2"
              )}
            >
              {showIconOnly ? (
                <span>{entry.icon}</span>
              ) : (
                <div className="flex whitespace-nowrap items-center justify-center gap-1">
                  {entry.icon && <span className="shrink-0">{entry.icon}</span>}
                  Tout
                </div>
              )}
            </button>
          );
        }

        const space = entry as VaultSpace;
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
                  ? "text-on-inverse"
                  : "bg-inverse text-on-inverse"
                : "text-ink-3 hover:bg-surface-3 hover:text-ink-2"
            )}
            style={
              isActive && space.color
                ? {
                    backgroundColor: hexToRgba(space.color, 0.6),
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
