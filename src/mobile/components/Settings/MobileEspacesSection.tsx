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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Squircle } from "../../../shared/components/Squircle";
import { useSpacesEditor } from "../../../shared/hooks/useSpacesEditor";
import { ALL_SPACE_ID, type VaultSpace } from "../../../shared/lib/vaultConfig";
import { hapticImpact } from "../../lib/haptics";
import { MobileEmojiField } from "./MobileEmojiField";

const DRAG_HANDLE = (
  <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
    <circle cx="2.5" cy="3" r="1.3" />
    <circle cx="7.5" cy="3" r="1.3" />
    <circle cx="2.5" cy="8" r="1.3" />
    <circle cx="7.5" cy="8" r="1.3" />
    <circle cx="2.5" cy="13" r="1.3" />
    <circle cx="7.5" cy="13" r="1.3" />
  </svg>
);

// Ligne "Tout" — non supprimable, non renommable, icône modifiable
function ToutRow({
  icon,
  onIconChange,
  isLast,
}: {
  icon?: string;
  onIconChange: (icon: string) => void;
  isLast: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ALL_SPACE_ID });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-3 bg-white ${isLast ? "" : "border-b border-gray-100"}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 text-gray-300 touch-none px-0.5"
        aria-label="Réordonner l'espace"
      >
        {DRAG_HANDLE}
      </button>
      <MobileEmojiField value={icon} onChange={onIconChange} />
      {/* Espacement équivalent au champ couleur */}
      <div className="w-9 shrink-0" />
      <span className="flex-1 text-base text-gray-400 px-2.5 py-2 select-none">
        Tout
      </span>
      {/* Espacement équivalent au × */}
      <div className="w-8 shrink-0" />
    </div>
  );
}

interface RowProps {
  space: VaultSpace;
  index: number;
  onNameChange: (index: number, name: string) => void;
  onNameBlur: (index: number) => void;
  onIconChange: (index: number, icon: string) => void;
  onColorChange: (index: number, color: string) => void;
  onDelete: (index: number) => void;
  isLast: boolean;
}

function SpaceRow({
  space,
  index,
  onNameChange,
  onNameBlur,
  onIconChange,
  onColorChange,
  onDelete,
  isLast,
}: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: space.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-3 bg-white ${
        isLast ? "" : "border-b border-gray-100"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 text-gray-300 touch-none px-0.5"
        aria-label="Réordonner l'espace"
      >
        {DRAG_HANDLE}
      </button>

      <MobileEmojiField
        value={space.icon}
        onChange={(icon) => onIconChange(index, icon)}
      />

      <label
        className="relative shrink-0 cursor-pointer"
        aria-label="Couleur de l'espace"
      >
        <span
          className="block w-9 h-9 rounded-lg border-2 border-white shadow ring-1 ring-gray-200"
          style={{
            background: space.color
              ? `linear-gradient(135deg, ${space.color}, ${space.color}99)`
              : "linear-gradient(135deg, #e5e7eb, #d1d5db)",
          }}
        />
        <input
          type="color"
          value={space.color ?? "#6366f1"}
          onChange={(e) => onColorChange(index, e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full"
        />
      </label>

      <input
        type="text"
        value={space.name}
        onChange={(e) => onNameChange(index, e.target.value)}
        onBlur={() => onNameBlur(index)}
        className="flex-1 min-w-0 text-base border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:border-gray-400"
        placeholder="Nom de l'espace"
        aria-label="Nom de l'espace"
      />

      <button
        type="button"
        onClick={() => {
          hapticImpact("medium");
          onDelete(index);
        }}
        className="shrink-0 text-gray-400 active:text-red-500 transition-colors text-2xl leading-none px-1"
        aria-label="Supprimer l'espace"
      >
        ×
      </button>
    </div>
  );
}

export function MobileEspacesSection() {
  const {
    spaces,
    orderedEntries,
    canEdit,
    iconOnly,
    toutIcon,
    addSpace,
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

  if (!canEdit) return null;

  function handleReorder(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorder(String(active.id), String(over.id));
  }

  return (
    <>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mt-8 mb-3 px-1">
        Espaces
      </p>
      <div style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.06))" }}>
        <Squircle
          radius={18}
          className="overflow-hidden bg-white border border-gray-100"
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleReorder}
          >
            <SortableContext
              items={orderedEntries.map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              {orderedEntries.map((entry, i) => {
                const isLast = i === orderedEntries.length - 1;
                if (entry.id === ALL_SPACE_ID) {
                  return (
                    <ToutRow
                      key="__all__"
                      icon={toutIcon}
                      onIconChange={setToutIcon}
                      isLast={isLast}
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
                    onNameChange={setName}
                    onNameBlur={dedupeName}
                    onIconChange={setIcon}
                    onColorChange={setColor}
                    onDelete={deleteSpace}
                    isLast={isLast}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
          <button
            type="button"
            onClick={() => {
              hapticImpact("light");
              addSpace();
            }}
            className="w-full px-4 py-4 text-left text-base text-amber-500 active:bg-gray-50 transition-colors border-t border-gray-100"
          >
            + Ajouter un espace
          </button>
        </Squircle>
      </div>
      <div style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.06))" }} className="mt-3">
        <Squircle radius={18} className="overflow-hidden bg-white border border-gray-100">
          <label className="flex items-center justify-between px-4 py-3 cursor-pointer">
            <span className="text-base text-gray-700">Icônes uniquement</span>
            <input
              type="checkbox"
              checked={iconOnly}
              onChange={(e) => setIconOnly(e.target.checked)}
              className="w-5 h-5 rounded accent-gray-800 cursor-pointer"
            />
          </label>
        </Squircle>
      </div>
      <p className="mt-2 text-xs text-gray-400 px-1">
        Taguez vos notes avec{" "}
        <code className="font-mono bg-gray-100 px-1 rounded">__space__</code>{" "}
        pour les associer à un espace.
      </p>
    </>
  );
}
