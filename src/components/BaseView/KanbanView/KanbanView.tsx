import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { NoteFile } from "../../FileTree/hooks/useFileTree";
import type { KanbanColumn as KanbanColumnType } from "../../../lib/noteTypes";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { NO_VALUE_COLUMN_ID, type KanbanCards } from "../../../lib/atoms";
import { createLogger } from "../../../lib/logger";

const log = createLogger("KanbanView");

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
  onCardClick: (note: NoteFile) => void;
}

export function KanbanView({
  columns,
  cards,
  kanbanKey,
  onMoveCard,
  onRenameColumn,
  onAddColumn,
  onCardClick,
}: Props) {
  const [activeNote, setActiveNote] = useState<NoteFile | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Retrouve la colonne d'une note
  function findColumnOfNote(noteId: string): string | null {
    for (const [colId, notes] of Object.entries(cards)) {
      if (notes.some((n) => n.id === noteId)) return colId;
    }
    return null;
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const noteId = event.active.id as string;
      const colId = findColumnOfNote(noteId);
      if (!colId) return;
      const note = cards[colId]?.find((n) => n.id === noteId) ?? null;
      setActiveNote(note);
      log.info("drag démarré", { noteId });
    },
    [cards]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveNote(null);
      const { active, over } = event;
      if (!over) return;

      const noteId = active.id as string;
      const fromColId = findColumnOfNote(noteId);
      if (!fromColId) return;

      // over.id peut être un colId (persisté ou virtuel) ou un noteId — on résout la colonne cible
      const allColIds = new Set([
        ...columns.map((c) => c.id),
        NO_VALUE_COLUMN_ID,
      ]);
      const toColId = allColIds.has(over.id as string)
        ? (over.id as string)
        : findColumnOfNote(over.id as string);

      if (!toColId || toColId === fromColId) return;

      log.info("drag terminé", { noteId, fromColId, toColId });
      onMoveCard(noteId, fromColId, toColId);
    },
    [cards, columns, onMoveCard]
  );

  function commitAddColumn() {
    const trimmed = newColumnLabel.trim();
    if (trimmed) {
      onAddColumn(trimmed);
      log.info("nouvelle colonne ajoutée", { label: trimmed });
    }
    setNewColumnLabel("");
    setAddingColumn(false);
  }

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitAddColumn();
    if (e.key === "Escape") {
      setNewColumnLabel("");
      setAddingColumn(false);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-4 overflow-x-auto h-full items-start">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            notes={cards[col.id] ?? []}
            kanbanKey={kanbanKey}
            onRename={onRenameColumn}
            onCardClick={onCardClick}
          />
        ))}

        {/* Colonne virtuelle — affichée uniquement si des notes sont sans valeur */}
        {cards[NO_VALUE_COLUMN_ID] && cards[NO_VALUE_COLUMN_ID].length > 0 && (
          <KanbanColumn
            key={NO_VALUE_COLUMN_ID}
            column={{ id: NO_VALUE_COLUMN_ID, label: "Sans valeur" }}
            notes={cards[NO_VALUE_COLUMN_ID]}
            kanbanKey={kanbanKey}
            onRename={() => {}}
            onCardClick={onCardClick}
            virtual
          />
        )}

        {/* Ajout de colonne */}
        <div className="w-64 shrink-0">
          {addingColumn ? (
            <div className="bg-gray-50 rounded-xl p-2">
              <input
                // biome-ignore lint/a11y/noAutofocus: <explanation>
                autoFocus
                value={newColumnLabel}
                onChange={(e) => setNewColumnLabel(e.target.value)}
                onBlur={commitAddColumn}
                onKeyDown={handleAddKeyDown}
                placeholder="Nom de la colonne…"
                className="w-full font-body text-sm bg-transparent outline-none px-1 py-0.5 border-b border-gray-400"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingColumn(true)}
              className="w-full text-left px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors font-body"
            >
              + Ajouter une colonne
            </button>
          )}
        </div>
      </div>

      {/* Carte fantôme pendant le drag */}
      <DragOverlay>
        {activeNote && (
          <KanbanCard
            note={activeNote}
            kanbanKey={kanbanKey}
            onClick={() => {}}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
