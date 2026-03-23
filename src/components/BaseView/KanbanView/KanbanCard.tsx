import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { NoteFile } from "../../FileTree/hooks/useFileTree";

interface Props {
  note: NoteFile;
  kanbanKey: string;
  onClick: (note: NoteFile) => void;
}

export function KanbanCard({ note, onClick }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: note.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(note)}
      className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 cursor-grab active:cursor-grabbing hover:border-gray-300 hover:shadow-sm transition-all select-none group"
    >
      <p className="font-body text-sm text-gray-800 leading-snug">
        {note.name}
      </p>
      {note.title && note.title !== note.name && (
        <p className="font-body text-xs text-gray-400 mt-1 leading-snug line-clamp-2">
          {note.title}
        </p>
      )}
    </div>
  );
}
