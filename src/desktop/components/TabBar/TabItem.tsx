import { IconXmark } from "../../../shared/components/PlatformIcon";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { NoteFile } from "../../../shared/hooks/useFileTree";

export function TabItem({
  tabId,
  note,
  isActive,
  isGhost,
  onSelect,
  onClose,
}: {
  tabId: string;
  note: NoteFile;
  isActive: boolean;
  isGhost?: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: tabId });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        visibility: isGhost ? "hidden" : undefined,
      }}
      {...attributes}
      {...listeners}
      className={`relative flex items-center justify-center gap-2 px-4 py-1 min-w-30 rounded-full whitespace-nowrap transition-all flex-1 group 
        ${
          isActive
            ? "bg-white hover:bg-stone-50 text-black min-w-50 shadow-sm shadow-gray-400/40 ring-1 ring-white ring-inset inset-shadow-sm inset-shadow-white"
            : "bg-none text-gray-400 hover:bg-gray-200 min-w-30"
        }`}
      onClick={onSelect}
    >
      <button
        type="button"
        className={`absolute left-3 text-gray-500 invisible group-hover:visible select-none rounded-full p-1.5 flex items-center justify-center
          ${isActive ? " hover:text-gray-700 hover:bg-gray-200/50" : "hover:text-gray-800  hover:bg-gray-300"}`}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={`Fermer ${note.name}`}
      >
        <IconXmark className="size-2" />
      </button>
      <span className="truncate select-none px-5">{note.name}</span>
    </div>
  );
}
export function TabOverlay({
  note,
  isActive,
}: { note: NoteFile; isActive: boolean }) {
  return (
    <div
      className={`relative flex items-center justify-center gap-2 px-4 py-1 rounded-full whitespace-nowrap shrink-0 cursor-grabbing shadow-md ${isActive ? "bg-white text-black" : "bg-gray-50 text-gray-400"}`}
    >
      <span className="truncate select-none px-5">{note.name}</span>
    </div>
  );
}
