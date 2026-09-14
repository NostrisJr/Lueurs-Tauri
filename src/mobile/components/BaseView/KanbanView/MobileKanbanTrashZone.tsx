import { KanbanTrashPill } from "../../../../shared/components/KanbanTrashPill";
import { BASE_STICKY_TOP } from "../constants";

interface Props {
  /** Un drag est en cours — la cible ne se montre qu'à ce moment-là. */
  visible: boolean;
  /** La carte survole la cible. */
  active: boolean;
}

/**
 * Cible de suppression en haut du board, révélée pendant un drag de carte.
 *
 * Détectée par `findDropTarget` via `[data-dropzone-trash]` — le drag mobile
 * est maison, il lit la pile sous le doigt plutôt que des rects mesurés. Ancre
 * sticky de hauteur nulle : `items-start` est indispensable, le stretch par
 * défaut d'un conteneur flex sans hauteur écraserait la pilule à 0px.
 */
export function MobileKanbanTrashZone({ visible, active }: Props) {
  return (
    <div
      className="sticky h-0 overflow-visible z-30 flex items-start justify-center"
      style={{ top: BASE_STICKY_TOP }}
    >
      <div data-dropzone-trash="">
        <KanbanTrashPill visible={visible} active={active} touch />
      </div>
    </div>
  );
}
