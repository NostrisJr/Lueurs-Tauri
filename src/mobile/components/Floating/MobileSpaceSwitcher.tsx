import clsx from "clsx";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { IconBooksVertical } from "../../../shared/components/PlatformIcon";
import {
  activeSpaceAtom,
  mobileSwitchSpaceAtom,
  vaultConfigAtom,
} from "../../../shared/lib/atoms";
import { hexToRgba } from "../../../shared/lib/color";
import type { VaultSpace } from "../../../shared/lib/vaultConfig";
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

  // Purge la valeur obsolète en localStorage si l'espace actif n'existe plus
  useEffect(() => {
    if (activeSpace !== null && !spaces.some((s) => s.name === activeSpace)) {
      setActiveSpace(null);
    }
  }, [spaces, activeSpace, setActiveSpace]);

  if (spaces.length === 0) return null;

  function handleSwitch(newSpace: string | null) {
    if (newSpace === activeSpace) return;
    hapticImpact("light");
    switchSpace(newSpace);
  }

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
      <FloatingComponent vertical>
        <button
          type="button"
          onClick={() => handleSwitch(null)}
          className={clsx(
            "flex items-center justify-center size-9 rounded-full transition-colors",
            activeSpace === null
              ? "bg-gray-800 text-white"
              : "text-gray-500 active:bg-black/5"
          )}
          aria-label="Tout"
        >
          <IconBooksVertical className="size-4.5" />
        </button>
        {spaces.map((space) => {
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
