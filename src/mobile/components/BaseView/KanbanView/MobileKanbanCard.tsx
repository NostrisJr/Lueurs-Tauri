import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSetAtom } from "jotai";
import { useRef, useState } from "react";
import type { NoteFile } from "../../../../shared/hooks/useFileTree";
import { useNote } from "../../../../shared/hooks/useNote";
import { navigateToNoteAtom } from "../../../../shared/lib/atoms";
import { useLongPress } from "../../../hooks/useLongPress";

interface Props {
  note: NoteFile;
}

export function MobileKanbanCard({ note }: Props) {
  const { handleRename } = useNote();
  const navigateToNote = useSetAtom(navigateToNoteAtom);
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

  function beginEdit() {
    setDraft(note.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    beginEdit();
  }

  // Long-press tactile → renommer. Le cleanup des listeners est porté par
  // useLongPress (touchend/touchmove/touchcancel + démontage).
  const longPress = useLongPress(beginEdit, () => {});

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
      className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm active:shadow-md transition-all select-none"
    >
      {editing ? (
        <input
          ref={inputRef}
          // biome-ignore lint/a11y/noAutofocus: focus intentionnel
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 16 }}
          className="w-full bg-transparent outline-none text-gray-800 font-medium"
        />
      ) : (
        <p
          className="text-base font-medium text-gray-800 leading-snug truncate"
          onDoubleClick={startEdit}
          {...longPress}
        >
          {note.name}
        </p>
      )}
      {note.title && note.title !== note.name && (
        <p className="text-sm text-gray-400 mt-1 leading-snug line-clamp-2">
          {note.title}
        </p>
      )}
      {/* Bouton ouvrir la note */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          navigateToNote(note.id);
        }}
        className="mt-2 text-xs text-blue-500 active:text-blue-700 transition-colors"
      >
        Ouvrir →
      </button>
    </div>
  );
}
