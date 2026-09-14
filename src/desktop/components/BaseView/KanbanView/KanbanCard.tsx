import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { useCallback, useState } from "react";
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
  // Ref stable → sélectionne le texte au montage de l'input d'édition uniquement
  const editInputRef = useCallback((el: HTMLInputElement | null) => {
    el?.select();
  }, []);

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
      className={clsx(
        "bg-surface border border-line-2 rounded-lg px-3 py-2.5 hover:border-line-3 hover:shadow-sm transition-all select-none group",
        cmdHeld ? "cursor-pointer" : ""
      )}
    >
      {editing ? (
        <input
          ref={editInputRef}
          // biome-ignore lint/a11y/noAutofocus: focus intentionnel à l'ouverture de l'édition
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className={clsx(
            "w-full text-sm bg-transparent outline-none font-body",
            "text-ink"
          )}
        />
      ) : (
        <p
          className={clsx(
            "font-body text-sm leading-snug truncate",
            "text-ink"
          )}
          onDoubleClick={startEdit}
        >
          {note.name}
        </p>
      )}
      {note.title && note.title !== note.name && (
        <p
          className={clsx(
            "font-body text-xs mt-1 leading-snug line-clamp-2",
            "text-ink-4"
          )}
        >
          {note.title}
        </p>
      )}
    </div>
  );
}
