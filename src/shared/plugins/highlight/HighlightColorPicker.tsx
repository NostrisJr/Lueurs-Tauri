// Picker flottant de couleur de surlignage (rendu React+Tailwind).
// Présentation pure : tout l'état métier (plage PM, view) vit dans color-picker.ts ;
// ce composant ne connaît que la couleur courante, sa position et les callbacks.

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { HIGHLIGHT_COLORS, getHighlightSolid } from "./colors";

export type PickerState = {
  color: string;
  size: number;
  position: { left: number; top: number };
};

export type HighlightColorPickerProps = {
  // null = masqué (le composant ne rend rien)
  state: PickerState | null;
  onPick: (colorId: string) => void;
  onRemove: () => void;
  onCancelHide: () => void;
  onScheduleHide: () => void;
  onClickOutside: () => void;
};

export function HighlightColorPicker({
  state,
  onPick,
  onRemove,
  onCancelHide,
  onScheduleHide,
  onClickOutside,
}: HighlightColorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Referme le dropdown dès que le picker est masqué
  useEffect(() => {
    if (!state) setOpen(false);
  }, [state]);

  // Clic en dehors → fermer
  useEffect(() => {
    if (!state) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        onClickOutside();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [state, onClickOutside]);

  if (!state) return null;

  return (
    <div
      ref={ref}
      className="fixed z-10 flex items-center"
      style={{ left: state.position.left, top: state.position.top }}
      onMouseEnter={onCancelHide}
      onMouseLeave={onScheduleHide}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={clsx(
          "shrink-0 cursor-pointer rounded-full border p-0 shadow-sm outline-none transition-transform touch-none hover:scale-[1.2]",
          "border-surface/80"
        )}
        style={{
          width: state.size,
          height: state.size,
          background: getHighlightSolid(state.color),
        }}
      />

      {open && (
        <div
          className={clsx(
            "absolute left-0 top-4.5 flex w-30 flex-wrap gap-1.5 rounded-[10px] border p-1.5",
            "border-tint-2 bg-surface shadow-[0_4px_20px_var(--color-shade-2)]"
          )}
        >
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPick(c.id);
                setOpen(false);
              }}
              className={clsx(
                "h-5 w-5 cursor-pointer rounded-full border-2 p-0 outline-none transition-transform hover:scale-[1.15]",
                c.id === state.color ? "border-ink-2" : "border-transparent"
              )}
              style={{ background: getHighlightSolid(c.id) }}
            />
          ))}

          <button
            type="button"
            title="Supprimer le surlignage"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            className={clsx(
              "flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] p-0 text-[11px] outline-none transition-colors",
              "border-line-2 bg-surface text-ink-4 hover:bg-danger-soft-2 hover:text-danger"
            )}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
