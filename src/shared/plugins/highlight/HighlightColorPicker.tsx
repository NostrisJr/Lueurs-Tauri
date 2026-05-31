// Picker flottant de couleur de surlignage (rendu React+Tailwind).
// Présentation pure : tout l'état métier (plage PM, view) vit dans color-picker.ts ;
// ce composant ne connaît que la couleur courante, sa position et les callbacks.

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { HIGHLIGHT_COLORS, getHighlightSolid } from "./colors";
import { isMobile } from "../../lib/platform";

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
        className="shrink-0 cursor-pointer rounded-full border border-white/80 p-0 shadow-sm outline-none transition-transform touch-none hover:scale-[1.2]"
        style={{
          width: state.size,
          height: state.size,
          background: getHighlightSolid(state.color),
        }}
      />

      {open && (
        <div className="absolute left-0 top-4.5 flex w-30 flex-wrap gap-1.5 rounded-[10px] border border-black/8 bg-white p-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
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
                c.id === state.color ? "border-gray-700" : "border-transparent"
              )}
              style={{ background: c.solid }}
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
            className="flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-gray-200 bg-white p-0 text-[11px] text-gray-400 outline-none transition-colors hover:bg-red-100 hover:text-red-500"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
