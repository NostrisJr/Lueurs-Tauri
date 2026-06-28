import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmojiMartPicker } from "../../../shared/components/EmojiMartPicker";

const PICKER_W = 352;
const PICKER_H = 435;
const MARGIN = 8;
const OFFSET_X = 20;

interface EmojiPickerProps {
  value: string | undefined;
  onChange: (emoji: string) => void;
}

function computePosition(rect: DOMRect): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Essaie d'ouvrir en-dessous
  let top = rect.bottom + MARGIN;
  if (top + PICKER_H > vh - MARGIN) {
    // Ouvre au-dessus si pas assez de place en-dessous
    top = rect.top - PICKER_H - MARGIN;
  }
  // Garde dans le viewport verticalement
  top = Math.max(MARGIN, Math.min(top, vh - PICKER_H - MARGIN));

  // Aligne légèrement à droite du bouton, recentre si déborde
  let left = rect.left + OFFSET_X;
  if (left + PICKER_W > vw - MARGIN) {
    left = vw - PICKER_W - MARGIN;
  }
  left = Math.max(MARGIN, left);

  return { top, left };
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  function openPicker() {
    if (btnRef.current) {
      setPos(computePosition(btnRef.current.getBoundingClientRect()));
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        className="w-10 h-9 flex items-center justify-center border border-gray-200 rounded-md text-base hover:border-gray-400 transition-colors cursor-pointer"
        aria-label="Choisir une icône"
        title="Choisir une icône"
      >
        {value ? (
          <span>{value}</span>
        ) : (
          <span className="text-gray-300 text-xs">+</span>
        )}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: PICKER_W,
              zIndex: 9999,
            }}
          >
            <EmojiMartPicker
              height={PICKER_H}
              onSelect={(emoji) => {
                onChange(emoji);
                setOpen(false);
              }}
            />
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="w-full mt-1 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-100 shadow transition-colors cursor-pointer"
              >
                Supprimer l'icône
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
