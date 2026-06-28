import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { VaultSpace } from "../../../../shared/lib/vaultConfig";
import { EmojiPicker } from "../EmojiPicker";

interface SpaceRowProps {
  space: VaultSpace;
  index: number;
  onIconChange: (index: number, icon: string) => void;
  onColorChange: (index: number, color: string) => void;
  onNameChange: (index: number, name: string) => void;
  onNameBlur: (index: number) => void;
  onDelete: (index: number) => void;
}

export function SpaceRow({
  space,
  index,
  onIconChange,
  onColorChange,
  onNameChange,
  onNameBlur,
  onDelete,
}: SpaceRowProps) {
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
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div className="flex items-center gap-2">
        {/* Poignée de réordonnancement — seuls les listeners du handle déclenchent le drag */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="shrink-0 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none px-0.5"
          aria-label="Réordonner l'espace"
          title="Glisser pour réordonner"
        >
          <svg
            width="10"
            height="16"
            viewBox="0 0 10 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="2.5" cy="3" r="1.3" />
            <circle cx="7.5" cy="3" r="1.3" />
            <circle cx="2.5" cy="8" r="1.3" />
            <circle cx="7.5" cy="8" r="1.3" />
            <circle cx="2.5" cy="13" r="1.3" />
            <circle cx="7.5" cy="13" r="1.3" />
          </svg>
        </button>
        <EmojiPicker
          value={space.icon}
          onChange={(emoji) => onIconChange(index, emoji)}
        />
        <div className="flex items-center gap-1 shrink-0">
          <label
            className="relative cursor-pointer group"
            title="Couleur de l'espace"
            aria-label="Couleur de l'espace"
          >
            <span
              className="block w-[34px] h-[34px] rounded-md border-2 border-white shadow ring-1 ring-gray-200 group-hover:ring-gray-400 transition-all"
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
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
          </label>
          {space.color && (
            <button
              type="button"
              onClick={() => onColorChange(index, "")}
              title="Pas de couleur"
              aria-label="Supprimer la couleur"
              className="w-5 h-5 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer text-base leading-none"
            >
              ×
            </button>
          )}
        </div>
        <input
          type="text"
          value={space.name}
          onChange={(e) => onNameChange(index, e.target.value)}
          onBlur={() => onNameBlur(index)}
          className="flex-1 text-sm border border-gray-200 rounded-md px-2.5 py-1.5 outline-none focus:border-gray-400"
          placeholder="Nom de l'espace"
          aria-label="Nom de l'espace"
        />
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none cursor-pointer px-1"
          aria-label="Supprimer l'espace"
        >
          ×
        </button>
      </div>
    </div>
  );
}
