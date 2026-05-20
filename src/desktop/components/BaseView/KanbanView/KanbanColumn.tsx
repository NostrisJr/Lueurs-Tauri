import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEffect, useRef, useState } from "react";
import type { NoteFile } from "../../../../shared/hooks/useFileTree";
import type { KanbanColumn as KanbanColumnType } from "../../../../shared/lib/noteTypes";
import { KanbanCard } from "./KanbanCard";

interface Props {
  column: KanbanColumnType;
  notes: NoteFile[];
  onRename: (colId: string, newLabel: string) => void;
  // Colonne virtuelle — header non éditable, style distinct
  virtual?: boolean;
}

export function KanbanColumn({
  column,
  notes,
  onRename,
  virtual = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.label);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, isOver } = useDroppable({ id: column.id });

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
    <div className="flex flex-col w-64 shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        {!virtual && editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            className="font-title text-sm font-semibold text-gray-700 bg-transparent border-b border-gray-400 outline-none w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => !virtual && setEditing(true)}
            className={`font-title text-sm font-semibold text-left truncate ${
              virtual
                ? "text-gray-400 italic cursor-default"
                : "text-gray-700 hover:text-gray-900 cursor-text"
            }`}
            title={virtual ? undefined : "Renommer la colonne"}
          >
            {column.label}
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400 shrink-0">
          {notes.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 min-h-24 rounded-xl p-2 transition-colors ${
          isOver ? "bg-gray-100" : "bg-gray-50"
        }`}
      >
        <SortableContext
          items={notes.map((n) => n.id)}
          strategy={verticalListSortingStrategy}
        >
          {notes.map((note) => (
            <KanbanCard key={note.id} note={note} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
