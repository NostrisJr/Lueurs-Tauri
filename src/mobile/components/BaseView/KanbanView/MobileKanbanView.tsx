import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCallback, useState } from "react";
import type { NoteFile } from "../../../../shared/hooks/useFileTree";
import { type KanbanCards, NO_VALUE_COLUMN_ID } from "../../../../shared/lib/Atoms";
import type { KanbanColumn as KanbanColumnType } from "../../../../shared/lib/noteTypes";
import { MobileKanbanCard } from "./MobileKanbanCard";
import { MobileKanbanColumn } from "./MobileKanbanColumn";

interface Props {
  columns: KanbanColumnType[];
  cards: KanbanCards;
  kanbanKey: string;
  onMoveCard: (
    noteId: string,
    fromColId: string,
    toColId: string
  ) => Promise<void>;
  onRenameColumn: (colId: string, newLabel: string) => Promise<void>;
  onAddColumn: (label: string) => void;
}

export function MobileKanbanView({
  columns,
  cards,
  kanbanKey,
  onMoveCard,
  onRenameColumn,
  onAddColumn,
}: Props) {
  const [activeNote, setActiveNote] = useState<NoteFile | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState("");

  // Touch delay court pour ne pas bloquer le scroll horizontal
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  function findColumnOfNote(noteId: string): string | null {
    for (const [colId, notes] of Object.entries(cards)) {
      if (notes.some((n) => n.id === noteId)) return colId;
    }
    return null;
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: cards capturé intentionnellement
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const noteId = event.active.id as string;
      const colId = findColumnOfNote(noteId);
      if (!colId) return;
      setActiveNote(cards[colId]?.find((n) => n.id === noteId) ?? null);
    },
    [cards]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: cards/columns capturés intentionnellement
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveNote(null);
      const { active, over } = event;
      if (!over) return;
      const noteId = active.id as string;
      const fromColId = findColumnOfNote(noteId);
      if (!fromColId) return;
      const allColIds = new Set([
        ...columns.map((c) => c.id),
        NO_VALUE_COLUMN_ID,
      ]);
      const toColId = allColIds.has(over.id as string)
        ? (over.id as string)
        : findColumnOfNote(over.id as string);
      if (!toColId || toColId === fromColId) return;
      onMoveCard(noteId, fromColId, toColId);
    },
    [cards, columns, onMoveCard]
  );

  function commitAddColumn() {
    const trimmed = newColumnLabel.trim();
    if (trimmed) onAddColumn(trimmed);
    setNewColumnLabel("");
    setAddingColumn(false);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex gap-4 px-4 py-3 overflow-x-auto h-full"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {columns.map((col) => (
          <MobileKanbanColumn
            key={col.id}
            column={col}
            notes={cards[col.id] ?? []}
            kanbanKey={kanbanKey}
            onRename={onRenameColumn}
          />
        ))}

        {cards[NO_VALUE_COLUMN_ID] && cards[NO_VALUE_COLUMN_ID].length > 0 && (
          <MobileKanbanColumn
            key={NO_VALUE_COLUMN_ID}
            column={{ id: NO_VALUE_COLUMN_ID, label: "Sans valeur" }}
            notes={cards[NO_VALUE_COLUMN_ID]}
            kanbanKey={kanbanKey}
            onRename={() => {}}
            virtual
          />
        )}

        {/* Ajout de colonne */}
        <div
          className="shrink-0 flex flex-col"
          style={{ width: "85vw", scrollSnapAlign: "start" }}
        >
          {addingColumn ? (
            <div className="bg-gray-50 rounded-2xl p-3">
              <input
                // biome-ignore lint/a11y/noAutofocus: focus intentionnel
                autoFocus
                value={newColumnLabel}
                onChange={(e) => setNewColumnLabel(e.target.value)}
                onBlur={commitAddColumn}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitAddColumn();
                  if (e.key === "Escape") {
                    setNewColumnLabel("");
                    setAddingColumn(false);
                  }
                }}
                placeholder="Nom de la colonne…"
                style={{ fontSize: 16 }}
                className="w-full bg-transparent outline-none text-gray-700 border-b border-gray-400 pb-1"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingColumn(true)}
              className="text-left px-3 py-3 rounded-2xl text-base text-gray-400 active:bg-gray-50 transition-colors"
            >
              + Ajouter une colonne
            </button>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeNote && (
          <MobileKanbanCard note={activeNote} kanbanKey={kanbanKey} />
        )}
      </DragOverlay>
    </DndContext>
  );
}
