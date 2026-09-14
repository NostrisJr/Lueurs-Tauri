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
import clsx from "clsx";
import { useSpacesEditor } from "../../../../shared/hooks/useSpacesEditor";
import {
  ALL_SPACE_ID,
  type VaultSpace,
} from "../../../../shared/lib/vaultConfig";
import { SpaceRow, ToutSpaceRow } from "./SpaceRow";

export function EspacesTab() {
  const {
    spaces,
    orderedEntries,
    canEdit,
    iconOnly,
    toutIcon,
    addSpace,
    beginRename,
    setName,
    dedupeName,
    setIcon,
    setColor,
    setIconOnly,
    setToutIcon,
    reorder,
    deleteSpace,
  } = useSpacesEditor();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  if (!canEdit)
    return <p className="text-sm text-ink-4">Aucun vault chargé.</p>;

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
          items={orderedEntries.map((e) => e.id)}
          strategy={verticalListSortingStrategy}
        >
          {orderedEntries.map((entry) => {
            if (entry.id === ALL_SPACE_ID) {
              return (
                <ToutSpaceRow
                  key="__all__"
                  icon={toutIcon}
                  onIconChange={setToutIcon}
                />
              );
            }
            const space = entry as VaultSpace;
            const idx = spaces.indexOf(space);
            return (
              <SpaceRow
                key={space.id}
                space={space}
                index={idx}
                onIconChange={setIcon}
                onColorChange={setColor}
                onNameChange={setName}
                onNameFocus={beginRename}
                onNameBlur={dedupeName}
                onDelete={deleteSpace}
              />
            );
          })}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={addSpace}
        className={clsx(
          "text-xs disabled:opacity-40 transition-colors cursor-pointer",
          "text-ink-3",
          "hover:text-ink-2"
        )}
      >
        + Ajouter un espace
      </button>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={iconOnly}
          onChange={(e) => setIconOnly(e.target.checked)}
          className="rounded accent-ink cursor-pointer"
        />
        <span className="text-xs text-ink-3">
          Afficher les icônes uniquement
        </span>
      </label>
      <p className="text-xs text-ink-4">
        Taguez vos notes avec{" "}
        <code className={clsx("font-mono px-1 rounded", "bg-surface-3")}>
          __Space__
        </code>{" "}
        pour les associer à un espace.
      </p>
    </div>
  );
}
