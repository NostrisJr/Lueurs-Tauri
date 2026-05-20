import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState } from "react";
import type { NoteFile } from "../../../../shared/hooks/useFileTree";
import { useNote } from "../../../../shared/hooks/useNote";
import { useCmdHeld } from "../../../hooks/useCmdHeld";

interface Props {
  note: NoteFile;
}

export function KanbanCard({ note }: Props) {
  const { handleSelectNote, handleRename } = useNote();
  const cmdHeld = useCmdHeld();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id });

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(note.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitEdit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== note.name) {
      handleRename(note.id, trimmed, false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    e.stopPropagation();
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") {
      setEditing(false);
      setDraft(note.name);
    }
  }

  function handleClick(e: React.MouseEvent) {
    if (e.metaKey) handleSelectNote(note, true);
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`bg-white border border-gray-200 rounded-lg px-3 py-2.5 hover:border-gray-300 hover:shadow-sm transition-all select-none group ${cmdHeld ? "cursor-pointer" : ""}`}
    >
      {editing ? (
        <input
          ref={inputRef}
          // biome-ignore lint/a11y/noAutofocus: focus intentionnel à l'ouverture de l'édition
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="w-full text-sm bg-transparent outline-none text-gray-800 font-body"
        />
      ) : (
        <p
          className="font-body text-sm text-gray-800 leading-snug truncate"
          onDoubleClick={startEdit}
        >
          {note.name}
        </p>
      )}
      {note.title && note.title !== note.name && (
        <p className="font-body text-xs text-gray-400 mt-1 leading-snug line-clamp-2">
          {note.title}
        </p>
      )}
    </div>
  );
}
