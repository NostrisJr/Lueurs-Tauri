import { useDroppable } from "@dnd-kit/core";
import { KanbanTrashPill } from "../../../../shared/components/KanbanTrashPill";
import { KANBAN_TRASH_ID } from "../../../../shared/lib/kanbanDrop";

interface Props {
  /** Un drag est en cours — la cible se montre uniquement à ce moment-là. */
  visible: boolean;
}

/**
 * Cible de suppression en haut du board, révélée pendant un drag de carte.
 *
 * Ancre sticky de hauteur nulle (même pattern que le DocumentNavigator dans
 * NoteEditor) : la pilule reste visible quand la page défile sans décaler les
 * colonnes. `items-start` est indispensable — dans un conteneur flex de hauteur
 * nulle, le stretch par défaut écraserait la pilule à 0px de haut.
 *
 * Montée en permanence et seulement rendue transparente hors drag : dnd-kit
 * mesure les droppables au démarrage du geste, un montage tardif arriverait
 * après la mesure.
 */
export function KanbanTrashZone({ visible }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: KANBAN_TRASH_ID });

  return (
    <div className="sticky top-2 h-0 overflow-visible z-20 flex items-start justify-center">
      <KanbanTrashPill
        ref={setNodeRef}
        visible={visible}
        active={isOver && visible}
      />
    </div>
  );
}
