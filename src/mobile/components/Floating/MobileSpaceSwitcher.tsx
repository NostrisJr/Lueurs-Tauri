import clsx from "clsx";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { IconBooksVertical } from "../../../shared/components/PlatformIcon";
import {
  ACTIVE_SPACE_STORAGE_KEY,
  activeSpaceAtom,
  mobileSwitchSpaceAtom,
  vaultConfigAtom,
} from "../../../shared/lib/atoms";
import { hexToRgba } from "../../../shared/lib/color";
import {
  ALL_SPACE_ID,
  type VaultSpace,
  buildOrderedSpaces,
} from "../../../shared/lib/vaultConfig";
import { hapticImpact } from "../../lib/haptics";
import { FloatingComponent } from "./FloatingComponent";

// Libellé compact d'un espace : emoji si présent, sinon 2 premières lettres.
function spaceLabel(space: VaultSpace): string {
  if (space.icon) return space.icon;
  return space.name.slice(0, 2);
}

export function MobileSpaceSwitcher() {
  const vaultConfig = useAtomValue(vaultConfigAtom);
  const [activeSpace, setActiveSpace] = useAtom(activeSpaceAtom);
  const switchSpace = useSetAtom(mobileSwitchSpaceAtom);

  const spaces = vaultConfig?.spaces ?? [];
  const orderedSpaces = vaultConfig ? buildOrderedSpaces(spaces, vaultConfig) : [];

  // Purge la valeur obsolète uniquement quand la config vault est réellement chargée
  useEffect(() => {
    if (!vaultConfig) return;
    if (activeSpace !== null && !spaces.some((s) => s.name === activeSpace)) {
      setActiveSpace(null);
    }
  }, [vaultConfig, spaces, activeSpace, setActiveSpace]);

  // Premier lancement (clé absente de localStorage) : sélectionner le premier espace
  const initDoneRef = useRef(false);
  useEffect(() => {
    if (initDoneRef.current || !vaultConfig || orderedSpaces.length === 0) return;
    initDoneRef.current = true;
    const stored = localStorage.getItem(ACTIVE_SPACE_STORAGE_KEY);
    if (stored !== null) return; // déjà persisté
    const first = orderedSpaces[0];
    if (first && first.id !== ALL_SPACE_ID) {
      setActiveSpace((first as VaultSpace).name);
    }
  }, [vaultConfig, orderedSpaces, setActiveSpace]);

  if (orderedSpaces.length === 0) return null;

  function handleSwitch(newSpace: string | null) {
    if (newSpace === activeSpace) return;
    hapticImpact("light");
    switchSpace(newSpace);
  }

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
      <FloatingComponent vertical>
        {orderedSpaces.map((entry) => {
          if (entry.id === ALL_SPACE_ID) {
            const isActive = activeSpace === null;
            return (
              <button
                key="__all__"
                type="button"
                onClick={() => handleSwitch(null)}
                className={clsx(
                  "flex items-center justify-center size-9 rounded-full transition-colors",
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-500 active:bg-black/5"
                )}
                aria-label="Tout"
              >
                {entry.icon ? (
                  <span className="text-sm">{entry.icon}</span>
                ) : (
                  <IconBooksVertical className="size-4.5" />
                )}
              </button>
            );
          }

          const space = entry as VaultSpace;
          const isActive = activeSpace === space.name;
          return (
            <button
              key={space.id}
              type="button"
              onClick={() => handleSwitch(space.name)}
              className={clsx(
                "flex items-center justify-center size-9 rounded-full text-sm transition-colors",
                isActive
                  ? space.color
                    ? "text-white"
                    : "bg-gray-800 text-white"
                  : "text-gray-600 active:bg-black/5"
              )}
              style={
                isActive && space.color
                  ? { backgroundColor: hexToRgba(space.color, 0.7) }
                  : undefined
              }
              aria-label={space.name}
            >
              {spaceLabel(space)}
            </button>
          );
        })}
      </FloatingComponent>
    </div>
  );
}
