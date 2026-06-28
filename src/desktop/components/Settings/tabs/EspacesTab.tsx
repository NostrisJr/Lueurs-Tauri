import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSpacesEditor } from "../../../../shared/hooks/useSpacesEditor";
import { SpaceRow } from "./SpaceRow";

export function EspacesTab() {
  const {
    spaces,
    canEdit,
    iconOnly,
    addSpace,
    setName,
    dedupeName,
    setIcon,
    setColor,
    setIconOnly,
    reorder,
    deleteSpace,
  } = useSpacesEditor();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  if (!canEdit)
    return <p className="text-sm text-gray-400">Aucun vault chargé.</p>;

  function handleReorder(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorder(String(active.id), String(over.id));
  }

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleReorder}
      >
        <SortableContext
          items={spaces.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {spaces.map((space, i) => (
            <SpaceRow
              key={space.id}
              space={space}
              index={i}
              onIconChange={setIcon}
              onColorChange={setColor}
              onNameChange={setName}
              onNameBlur={dedupeName}
              onDelete={deleteSpace}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={addSpace}
        className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 transition-colors cursor-pointer"
      >
        + Ajouter un espace
      </button>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={iconOnly}
          onChange={(e) => setIconOnly(e.target.checked)}
          className="rounded accent-gray-800 cursor-pointer"
        />
        <span className="text-xs text-gray-500">Afficher les icônes uniquement</span>
      </label>
      <p className="text-xs text-gray-400">
        Taguez vos notes avec{" "}
        <code className="font-mono bg-gray-100 px-1 rounded">__space__</code>{" "}
        pour les associer à un espace.
      </p>
    </div>
  );
}
