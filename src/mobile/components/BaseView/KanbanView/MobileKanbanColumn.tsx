import clsx from "clsx";
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
  // Défini uniquement pour les colonnes d'une clé ENUM → pastille couleur cliquable
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
      // data-kanban-column : repère de mesure pour la navigation de bord.
      // Snap centré : la colonne visée arrive au milieu de l'écran, pas collée
      // au bord d'où vient le doigt.
      data-kanban-column=""
      className="shrink-0 flex flex-col"
      style={{ width: "85vw", scrollSnapAlign: "center" }}
    >
      {/* Header colonne */}
      <div className="flex items-center gap-2 mb-3 px-1">
        {/* Pastille couleur cliquable — colonnes d'une clé ENUM.
            Pas de survol sur mobile → toujours visible, atténuée si aucune couleur. */}
        {!virtual && onSetColor && (
          <ColorDotPicker
            color={column.color}
            onColor={(c) => onSetColor(column.id, c)}
            className={clsx(
              "size-5 rounded-full shrink-0",
              column.color ? "" : "opacity-40"
            )}
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
            className={clsx(
              "text-base font-semibold bg-transparent border-b outline-none flex-1",
              "text-ink-2 border-line-3"
            )}
          />
        ) : (
          <button
            type="button"
            onClick={() => !virtual && setEditing(true)}
            className={clsx(
              "text-base font-semibold text-left truncate flex-1",
              virtual
                ? "text-ink-4 italic cursor-default"
                : "text-ink-2 cursor-text"
            )}
          >
            {column.label}
          </button>
        )}
        <span className="text-sm text-ink-4 shrink-0">{notes.length}</span>
        {!virtual && (
          <button
            type="button"
            onClick={() => onDelete(column.id)}
            className={clsx(
              "shrink-0 px-1",
              "text-ink-5",
              "active:text-danger-2"
            )}
          >
            ✕
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        data-dropzone-column={column.id}
        className={clsx(
          "flex flex-col gap-3 min-h-24 rounded-2xl p-3 transition-colors flex-1",
          isOver ? "bg-info/10" : "bg-surface-2"
        )}
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
