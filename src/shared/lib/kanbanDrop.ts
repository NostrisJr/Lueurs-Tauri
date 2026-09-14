/** Identifiant de la zone corbeille du board kanban (droppable dnd-kit). */
export const KANBAN_TRASH_ID = "__kanban-trash__";

export type KanbanDropResult =
  | { kind: "move"; toColId: string }
  | { kind: "delete" }
  | null;

interface Params {
  /** `over.id` de dnd-kit : une colonne, une carte, la corbeille, ou rien. */
  overId: string | null;
  fromColId: string;
  /** Colonnes persistées + colonne virtuelle « Sans valeur ». */
  columnIds: string[];
  columnOfNote: (noteId: string) => string | null;
}

/**
 * Traduit la cible d'un lâcher en action métier. `overId` peut désigner une
 * colonne, une carte (→ sa colonne) ou la corbeille.
 */
export function resolveKanbanDrop({
  overId,
  fromColId,
  columnIds,
  columnOfNote,
}: Params): KanbanDropResult {
  if (!overId) return null;
  if (overId === KANBAN_TRASH_ID) return { kind: "delete" };

  const toColId = columnIds.includes(overId) ? overId : columnOfNote(overId);
  // Même colonne : rien à persister, l'ordre intra-colonne suit __Children__.
  if (!toColId || toColId === fromColId) return null;
  return { kind: "move", toColId };
}
