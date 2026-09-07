import { useRef, useState } from "react";
import { NodeIconProvider } from "../../../shared/components/NodeIconProvider";
import {
  IconRectangleStack,
  IconXmark,
} from "../../../shared/components/PlatformIcon";
import { Squircle } from "../../../shared/components/Squircle";
import type { MediaFile, NoteFile } from "../../../shared/hooks/useFileTree";
import { useLongPress } from "../../hooks/useLongPress";
import { hapticImpact } from "../../lib/haptics";
import { NodePreviewCard } from "../Row";
import { RowContextMenu } from "../Row/RowContextMenu";

interface Props {
  node: NoteFile | MediaFile;
  hasOtherTabs: boolean;
  onSelect: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
}

/**
 * Carte carrée de la grille 2 colonnes des onglets. Pas de swipe-to-delete
 * (cf. MobileRowGestures) : dans une cellule à moitié largeur, un swipe
 * horizontal serait ambigu avec le swipe de navigation (retour / onglets,
 * gérés globalement dans MobileApp) — fermeture par bouton visible à la place.
 */
export function TabCard({
  node,
  hasOtherTabs,
  onSelect,
  onClose,
  onCloseOthers,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);

  function handleLongPress() {
    if (!cardRef.current) return;
    hapticImpact("light");
    setMenuRect(cardRef.current.getBoundingClientRect());
  }

  const longPress = useLongPress(handleLongPress, onSelect);

  return (
    <div ref={cardRef} className="relative">
      <Squircle
        radius={20}
        className="aspect-square w-full bg-white active:scale-[0.98] transition-transform flex flex-col items-center justify-center gap-2 p-3"
        {...longPress}
      >
        <NodeIconProvider node={node} className="text-gray-400 size-7" />
        <p className="text-sm font-semibold text-gray-900 text-center line-clamp-2 break-words">
          {node.name}
        </p>
      </Squircle>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          hapticImpact("medium");
          onClose();
        }}
        className="absolute -top-1.5 -right-1.5 size-6 rounded-full bg-gray-900/80 text-white flex items-center justify-center active:bg-gray-900 transition-colors"
        aria-label="Fermer l'onglet"
      >
        <IconXmark className="size-3" />
      </button>

      {menuRect && (
        <RowContextMenu
          rect={menuRect}
          config={{
            preview: <NodePreviewCard node={node} />,
            items: [
              {
                id: "close",
                label: "Fermer l'onglet",
                icon: IconXmark,
                destructive: true,
                onPress: onClose,
              },
              ...(hasOtherTabs
                ? [
                    {
                      id: "close-others",
                      label: "Fermer les autres onglets",
                      icon: IconRectangleStack,
                      onPress: onCloseOthers,
                    },
                  ]
                : []),
            ],
          }}
          phase="open"
          dragPoint={null}
          onDismiss={() => setMenuRect(null)}
          onActivate={() => {
            setMenuRect(null);
            onSelect();
          }}
          onDragBegin={() => {}}
          onDragUpdate={() => {}}
          onDragFinish={() => {}}
        />
      )}
    </div>
  );
}
