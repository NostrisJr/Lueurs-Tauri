import clsx from "clsx";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { IconBooksVertical } from "../../../shared/components/PlatformIcon";
import {
  ACTIVE_SPACE_STORAGE_KEY,
  activeSpaceAtom,
  mobileNavigateAtom,
  mobileSettingsScrollTargetAtom,
  mobileSwitchSpaceAtom,
  spaceSwitcherAlwaysVisibleAtom,
  vaultConfigAtom,
} from "../../../shared/lib/atoms";
import { hexToRgba } from "../../../shared/lib/color";
import {
  ALL_SPACE_ID,
  type VaultSpace,
  buildOrderedSpaces,
} from "../../../shared/lib/vaultConfig";
import { useLongPressBind } from "../../hooks/useLongPress";
import { hapticImpact } from "../../lib/haptics";
import { FloatingComponent } from "./FloatingComponent";

// Libellé compact d'un espace : emoji si présent, sinon 2 premières lettres.
function spaceLabel(space: VaultSpace): string {
  if (space.icon) return space.icon;
  return space.name.slice(0, 2);
}

// Dimensions des boutons ronds de FloatingComponent (vertical) — cf. size-9 + gap-2 + py-2.5
const BUTTON_SIZE = 36;
const BUTTON_GAP = 8;
const PADDING_Y = 10;

function switcherHeight(count: number): number {
  return (
    count * BUTTON_SIZE + Math.max(0, count - 1) * BUTTON_GAP + PADDING_Y * 2
  );
}

export function MobileSpaceSwitcher() {
  const vaultConfig = useAtomValue(vaultConfigAtom);
  const [activeSpace, setActiveSpace] = useAtom(activeSpaceAtom);
  const switchSpace = useSetAtom(mobileSwitchSpaceAtom);
  const alwaysVisible = useAtomValue(spaceSwitcherAlwaysVisibleAtom);
  const navigate = useSetAtom(mobileNavigateAtom);
  const setSettingsScrollTarget = useSetAtom(mobileSettingsScrollTargetAtom);
  // Mode pastille (alwaysVisible = false) : repliée par défaut, s'étend au tap
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Appui long sur un bouton du switcher (quel qu'il soit) = accès rapide aux
  // réglages, scrollés jusqu'à l'encart Espaces (même comportement que le titre
  // du file tree). bind() partage un seul timer/suppression entre boutons : un
  // seul doigt à la fois sur un switcher, pas besoin d'un hook par bouton.
  const bindLongPress = useLongPressBind(() => {
    hapticImpact("medium");
    setSettingsScrollTarget("espaces");
    navigate("settings");
  });

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

  // Premier lancement (clé absente de localStorage) : sélectionner le premier espace
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
  }, [vaultConfig, orderedSpaces, setActiveSpace]);

  // Mode pastille : replie au tap en dehors du composant
  useEffect(() => {
    if (alwaysVisible || !expanded) return;
    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [alwaysVisible, expanded]);

  // Si le réglage repasse à "toujours visible", on n'a plus besoin d'être replié
  useEffect(() => {
    if (alwaysVisible) setExpanded(false);
  }, [alwaysVisible]);

  if (orderedSpaces.length === 0) return null;

  const isCollapsedPastille = !alwaysVisible && !expanded;
  const visibleSpaces = isCollapsedPastille
    ? orderedSpaces.filter((entry) =>
        entry.id === ALL_SPACE_ID
          ? activeSpace === null
          : (entry as VaultSpace).name === activeSpace
      )
    : orderedSpaces;
  // Repli sur le premier espace si l'espace actif ne correspond à aucune entrée (état transitoire)
  const displayedSpaces =
    visibleSpaces.length > 0 ? visibleSpaces : [orderedSpaces[0]];

  function handleEntryTap(newSpace: string | null) {
    if (isCollapsedPastille) {
      hapticImpact("light");
      setExpanded(true);
      return;
    }
    handleSwitch(newSpace);
  }

  function handleSwitch(newSpace: string | null) {
    if (newSpace !== activeSpace) {
      hapticImpact("light");
      switchSpace(newSpace);
    }
    if (!alwaysVisible) setExpanded(false);
  }

  const switcher = (
    <FloatingComponent vertical>
      {displayedSpaces.map((entry) => {
        if (entry.id === ALL_SPACE_ID) {
          const isActive = activeSpace === null;
          return (
            <button
              key="__all__"
              type="button"
              {...bindLongPress(() => handleEntryTap(null))}
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
            {...bindLongPress(() => handleEntryTap(space.name))}
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
  );

  return (
    <div
      ref={containerRef}
      className="absolute right-3 top-1/2 -translate-y-1/2 z-20"
    >
      {alwaysVisible ? (
        switcher
      ) : (
        <div
          style={{
            maxHeight: expanded
              ? switcherHeight(orderedSpaces.length)
              : switcherHeight(1),
            overflow: "hidden",
            borderRadius: 9999,
            transition: "max-height 0.25s ease-out",
          }}
        >
          {switcher}
        </div>
      )}
    </div>
  );
}
