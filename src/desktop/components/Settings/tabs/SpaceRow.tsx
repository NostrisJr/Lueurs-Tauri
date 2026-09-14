import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import {
  ALL_SPACE_ID,
  type VaultSpace,
} from "../../../../shared/lib/vaultConfig";
import { EmojiPicker } from "../EmojiPicker";

const DRAG_HANDLE_SVG = (
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
);

interface ToutSpaceRowProps {
  icon?: string;
  onIconChange: (icon: string) => void;
}

export function ToutSpaceRow({ icon, onIconChange }: ToutSpaceRowProps) {
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
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className={clsx(
            "shrink-0 cursor-grab active:cursor-grabbing touch-none px-0.5",
            "text-ink-5",
            "hover:text-ink-3"
          )}
          aria-label="Réordonner l'espace"
          title="Glisser pour réordonner"
        >
          {DRAG_HANDLE_SVG}
        </button>
        <EmojiPicker value={icon} onChange={onIconChange} />
        {/* Espacement équivalent au champ couleur */}
        <div className="w-[34px] shrink-0" />
        <span
          className={clsx(
            "flex-1 text-sm px-2.5 py-1.5 select-none",
            "text-ink-4"
          )}
        >
          Tout
        </span>
        {/* Espacement équivalent au bouton × */}
        <div className="w-5 shrink-0" />
      </div>
    </div>
  );
}

interface SpaceRowProps {
  space: VaultSpace;
  index: number;
  onIconChange: (index: number, icon: string) => void;
  onColorChange: (index: number, color: string) => void;
  onNameChange: (index: number, name: string) => void;
  onNameFocus: (index: number) => void;
  onNameBlur: (index: number) => void;
  onDelete: (index: number) => void;
}

export function SpaceRow({
  space,
  index,
  onIconChange,
  onColorChange,
  onNameChange,
  onNameFocus,
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
          className={clsx(
            "shrink-0 cursor-grab active:cursor-grabbing touch-none px-0.5",
            "text-ink-5",
            "hover:text-ink-3"
          )}
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
              className={clsx(
                "block w-[34px] h-[34px] rounded-md border-2 shadow ring-1 transition-all",
                "border-surface ring-line-2",
                "group-hover:ring-line-3"
              )}
              style={{
                background: space.color
                  ? `linear-gradient(135deg, ${space.color}, ${space.color}99)`
                  : "linear-gradient(135deg, var(--color-surface-4), var(--color-surface-5))",
              }}
            />
            <input
              type="color"
              // <input type="color"> n'accepte qu'un littéral #rrggbb, et cette
              // valeur est une donnée choisie par l'utilisateur, pas une couleur
              // de thème : elle ne doit pas basculer en sombre.
              value={space.color ?? "#6366f1"} // theme-ok
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
              className={clsx(
                "w-5 h-5 flex items-center justify-center rounded-full transition-colors cursor-pointer text-base leading-none",
                "text-ink-5",
                "hover:text-ink-3 hover:bg-surface-3"
              )}
            >
              ×
            </button>
          )}
        </div>
        <input
          type="text"
          value={space.name}
          onChange={(e) => onNameChange(index, e.target.value)}
          onFocus={() => onNameFocus(index)}
          onBlur={() => onNameBlur(index)}
          autoCorrect="off"
          autoCapitalize="off"
          className={clsx(
            "flex-1 text-sm border rounded-md px-2.5 py-1.5 outline-none",
            "border-line-2",
            "focus:border-line-3"
          )}
          placeholder="Nom de l'espace"
          aria-label="Nom de l'espace"
        />
        <button
          type="button"
          onClick={() => onDelete(index)}
          className={clsx(
            "transition-colors text-lg leading-none cursor-pointer px-1",
            "text-ink-4",
            "hover:text-danger"
          )}
          aria-label="Supprimer l'espace"
        >
          ×
        </button>
      </div>
    </div>
  );
}
