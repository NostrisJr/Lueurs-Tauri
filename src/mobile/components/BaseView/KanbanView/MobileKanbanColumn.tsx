import { useEffect, useRef, useState } from "react";
import { ColorDotPicker } from "../../../../shared/components/FrontmatterPicker/ColorDotPicker";
import type { NoteFile } from "../../../../shared/hooks/useFileTree";
import type { KanbanColumn as KanbanColumnType } from "../../../../shared/lib/noteTypes";
import { MobileKanbanCard } from "./MobileKanbanCard";

interface Props {
  column: KanbanColumnType;
  notes: NoteFile[];
  onRename: (colId: string, newLabel: string) => void;
  onDelete: (colId: string) => void;
  // Défini uniquement pour les colonnes d'une clé BUTTON → pastille couleur cliquable
  onSetColor?: (colId: string, color: string | undefined) => void;
  virtual?: boolean;
  /** Colonne actuellement survolée par une carte en cours de déplacement. */
  isOver: boolean;
  /** Note en cours de déplacement (toutes colonnes confondues) — reste en place, estompée. */
  draggingNoteId: string | null;
  onCardDragStart: (noteId: string, x: number, y: number) => void;
  onCardDragMove: (x: number, y: number) => void;
  onCardDragEnd: (x: number, y: number) => void;
  onCardDragCancel: () => void;
}

export function MobileKanbanColumn({
  column,
  notes,
  onRename,
  onDelete,
  onSetColor,
  virtual = false,
  isOver,
  draggingNoteId,
  onCardDragStart,
  onCardDragMove,
  onCardDragEnd,
  onCardDragCancel,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== column.label) {
      onRename(column.id, trimmed);
    } else {
      setDraft(column.label);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") {
      setDraft(column.label);
      setEditing(false);
    }
  }

  return (
    <div
      className="shrink-0 flex flex-col"
      style={{ width: "85vw", scrollSnapAlign: "start" }}
    >
      {/* Header colonne */}
      <div className="flex items-center gap-2 mb-3 px-1">
        {/* Pastille couleur cliquable — colonnes d'une clé BUTTON.
            Pas de survol sur mobile → toujours visible, atténuée si aucune couleur. */}
        {!virtual && onSetColor && (
          <ColorDotPicker
            color={column.color}
            onColor={(c) => onSetColor(column.id, c)}
            className={`size-3 rounded-full shrink-0 ${
              column.color ? "" : "opacity-40"
            }`}
          />
        )}
        {!virtual && editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            style={{ fontSize: 16 }}
            className="text-base font-semibold text-gray-700 bg-transparent border-b border-gray-400 outline-none flex-1"
          />
        ) : (
          <button
            type="button"
            onClick={() => !virtual && setEditing(true)}
            className={`text-base font-semibold text-left truncate flex-1 ${
              virtual
                ? "text-gray-400 italic cursor-default"
                : "text-gray-700 cursor-text"
            }`}
          >
            {column.label}
          </button>
        )}
        <span className="text-sm text-gray-400 shrink-0">{notes.length}</span>
        {!virtual && (
          <button
            type="button"
            onClick={() => onDelete(column.id)}
            className="shrink-0 text-gray-300 active:text-red-400 px-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        data-dropzone-column={column.id}
        className={`flex flex-col gap-3 min-h-24 rounded-2xl p-3 transition-colors flex-1 ${
          isOver ? "bg-blue-50" : "bg-gray-50"
        }`}
      >
        {notes.map((note) => (
          <MobileKanbanCard
            key={note.id}
            note={note}
            isDragging={note.id === draggingNoteId}
            onDragStart={onCardDragStart}
            onDragMove={onCardDragMove}
            onDragEnd={onCardDragEnd}
            onDragCancel={onCardDragCancel}
          />
        ))}
      </div>
    </div>
  );
}
