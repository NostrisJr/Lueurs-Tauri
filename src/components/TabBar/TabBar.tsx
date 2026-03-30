import { useAtomValue, useSetAtom } from "jotai";
import { activeNoteIdAtom, openTabIdsAtom, treeAtom } from "../../lib/atoms";
import { flattenTree, type NoteFile } from "../FileTree/hooks/useFileTree";
import { useNote } from "../../hooks/useNote";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { sfXmarkCircle } from "@bradleyhodges/sfsymbols";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useState } from "react";
import { createLogger } from "../../lib/logger";

const log = createLogger("TabBar");

function TabItem({
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
      className={`flex items-center gap-2 px-3 py-1 rounded-full cursor-grab active:cursor-grabbing whitespace-nowrap transition-all duration-300 shrink-0 ${
        isActive
          ? "bg-white text-black drop-shadow-sm drop-shadow-slate-600/20 border-white border"
          : "bg-gray-50 border border-gray-200 text-gray-400 hover:bg-gray-200 shadow-xs"
      }`}
      onClick={onSelect}
    >
      <span className="truncate max-w-40">{note.name}</span>
      <button
        type="button"
        className="text-gray-400 hover:text-gray-700 font-bold leading-none cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={`Fermer ${note.name}`}
      >
        <SFIcon icon={sfXmarkCircle} className="size-3" />
      </button>
    </div>
  );
}

function TabOverlay({ note, isActive }: { note: NoteFile; isActive: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1 rounded-full whitespace-nowrap shrink-0 cursor-grabbing shadow-md ${
        isActive
          ? "bg-white text-black font-medium"
          : "bg-gray-50 text-gray-600"
      }`}
    >
      <span className="truncate max-w-40">{note.name}</span>
      <SFIcon icon={sfXmarkCircle} className="size-3 text-gray-400" />
    </div>
  );
}

export function TabBar() {
  // Tous les hooks en premier — avant tout return conditionnel
  const openTabIds = useAtomValue(openTabIdsAtom);
  const activeNoteId = useAtomValue(activeNoteIdAtom);
  const tree = useAtomValue(treeAtom);
  const setOpenTabIds = useSetAtom(openTabIdsAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
  const { handleCloseTab } = useNote();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIdx = openTabIds.indexOf(active.id as string);
      const newIdx = openTabIds.indexOf(over.id as string);
      const newOrder = Array.from(openTabIds);
      newOrder.splice(oldIdx, 1);
      newOrder.splice(newIdx, 0, active.id as string);

      setOpenTabIds(newOrder);
      log.info("onglets réorganisés", { from: oldIdx, to: newIdx });
    },
    [openTabIds, setOpenTabIds]
  );

  if (openTabIds.length === 0) return null;

  const allNotes = flattenTree(tree);
  const tabs = openTabIds
    .map((tabId) => ({ tabId, note: allNotes.find((n) => n.id === tabId) }))
    .filter(
      (item): item is { tabId: string; note: NoteFile } =>
        item.note !== undefined
    );

  const draggingNote = draggingId
    ? allNotes.find((n) => n.id === draggingId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-2 bg-gray-100 inset-shadow-xs rounded-full p-1 mt-2 mx-2 overflow-x-auto shrink-0 scroll-hidden">
        <SortableContext
          items={openTabIds}
          strategy={horizontalListSortingStrategy}
        >
          {tabs.map(({ tabId, note }) => (
            <TabItem
              key={tabId}
              tabId={tabId}
              note={note}
              isActive={tabId === activeNoteId}
              isGhost={tabId === draggingId}
              onSelect={() => setActiveNoteId(tabId)}
              onClose={() => handleCloseTab(tabId)}
            />
          ))}
        </SortableContext>
      </div>
      <DragOverlay>
        {draggingNote && (
          <TabOverlay
            note={draggingNote}
            isActive={draggingId === activeNoteId}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
