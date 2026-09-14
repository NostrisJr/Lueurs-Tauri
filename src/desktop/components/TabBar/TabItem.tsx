import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { IconXmark } from "../../../shared/components/PlatformIcon";
import type { MediaFile, NoteFile } from "../../../shared/hooks/useFileTree";

export function TabItem({
  tabId,
  note,
  isActive,
  isGhost,
  onSelect,
  onClose,
}: {
  tabId: string;
  note: NoteFile | MediaFile;
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
      className={clsx(
        "relative flex items-center justify-center gap-2 px-4 py-1 min-w-30 rounded-full whitespace-nowrap transition-all flex-1 group",
        isActive
          ? "bg-control hover:bg-surface-2 text-ink min-w-50 shadow-sm shadow-shade-2 ring-1 ring-control ring-inset inset-shadow-sm inset-shadow-control"
          : "bg-none text-ink-4 hover:bg-surface-4 min-w-30"
      )}
      onClick={onSelect}
    >
      <button
        type="button"
        className={clsx(
          "absolute left-3 text-ink-3 invisible group-hover:visible select-none rounded-full p-1.5 flex items-center justify-center",
          isActive
            ? " hover:text-ink-2 hover:bg-surface-4/50"
            : "hover:text-ink hover:bg-surface-5"
        )}
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
}: { note: NoteFile | MediaFile; isActive: boolean }) {
  return (
    <div
      className={clsx(
        "relative flex items-center justify-center gap-2 px-4 py-1 rounded-full whitespace-nowrap shrink-0 cursor-grabbing shadow-md",
        isActive ? "bg-surface text-ink" : "bg-surface-2 text-ink-4"
      )}
    >
      <span className="truncate select-none px-5">{note.name}</span>
    </div>
  );
}
