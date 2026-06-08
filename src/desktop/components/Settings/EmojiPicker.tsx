import EmojiPickerComponent from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { useEffect, useRef, useState } from "react";

interface EmojiPickerProps {
  value: string | undefined;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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

      {open && (
        <div className="absolute left-0 top-0 mt-1 z-50">
          <EmojiPickerComponent
            data={data}
            onEmojiSelect={(emoji: { native: string }) => {
              onChange(emoji.native);
              setOpen(false);
            }}
            skinTonePosition="none"
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
        </div>
      )}
    </div>
  );
}
