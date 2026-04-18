import { useAtomValue, useSetAtom } from "jotai";
import { activeNoteIdAtom, openTabIdsAtom, treeAtom } from "../../../shared/lib/Atoms";
import { flattenTree, type NoteFile } from "../../../shared/hooks/useFileTree";
import { useNote } from "../../../shared/hooks/useNote";
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
} from "@dnd-kit/sortable";
import { useCallback, useState } from "react";
import { createLogger } from "../../../shared/lib/logger";
import { TabItem, TabOverlay } from "./TabItem.tsx";

const log = createLogger("TabBar");

export function TabBar() {
  // Tous les hooks en premier — avant tout return conditionnel
  const openTabIds = useAtomValue(openTabIdsAtom);
  const activeNoteId = useAtomValue(activeNoteIdAtom);
  const tree = useAtomValue(treeAtom);
  const setOpenTabIds = useSetAtom(openTabIdsAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
  const { handleCloseTab, pushHistory } = useNote();
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

  if (openTabIds.length <= 1) {
    return <div className=" w-full h-10" />;
  }
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-1 h-8 bg-gray-100 inset-shadow-xs rounded-full p-0.75 mt-2 mx-2 overflow-x-auto shrink-0 scroll-hidden">
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
              onSelect={() => {
                setActiveNoteId(tabId);
                pushHistory(tabId);
              }}
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
