import { useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { NoteFile } from "../FileTree/hooks/useFileTree";
import { useNote } from "../../hooks/useNote";
import { useSetAtom } from "jotai";
import { navigateToNoteAtom } from "../../lib/atoms.ts";

interface Props {
  note: NoteFile;
  kanbanKey: string;
}

export function MobileKanbanCard({ note }: Props) {
  const { handleRename } = useNote();
  const navigateToNote = useSetAtom(navigateToNoteAtom);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: note.id });

  function startEdit(e: React.TouchEvent | React.MouseEvent) {
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
    if (e.key === "Escape") { setEditing(false); setDraft(note.name); }
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
          onTouchStart={(e) => {
            // Long press → renommer
            const timer = setTimeout(() => startEdit(e), 600);
            const cancel = () => clearTimeout(timer);
            document.addEventListener("touchend", cancel, { once: true });
            document.addEventListener("touchmove", cancel, { once: true });
          }}
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
        onClick={(e) => { e.stopPropagation(); navigateToNote(note.id); }}
        className="mt-2 text-xs text-blue-500 active:text-blue-700 transition-colors"
      >
        Ouvrir →
      </button>
    </div>
  );
}
