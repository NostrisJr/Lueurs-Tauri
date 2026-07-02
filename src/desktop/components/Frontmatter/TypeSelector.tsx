import { platform } from "@tauri-apps/plugin-os";
import { useRef, useState } from "react";
import { AnchoredDropdown } from "../../../shared/components/AnchoredDropdown";
import { NoteType, type NoteTypeValue } from "../../../shared/lib/noteTypes";

const TYPE_LABELS: Record<NoteTypeValue, string> = {
  [NoteType.NOTE]: "note",
  [NoteType.FOLDER]: "folder",
  [NoteType.TEMPLATE]: "template",
  [NoteType.BASE]: "base",
};

interface Props {
  value: string;
  onChange: (value: NoteTypeValue) => void;
}

export function TypeSelector({ value, onChange }: Props) {
  const isMobile = platform() === "ios";
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const label =
    TYPE_LABELS[value as NoteTypeValue] ?? value.replace(/^__|__$/g, "");

  return (
    <div className="flex-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-bold text-gray-600 hover:text-gray-800 text-xs transition-colors cursor-pointer select-none"
      >
        {label}
      </button>

      {open && (
        <AnchoredDropdown
          anchorRef={buttonRef}
          onClose={() => setOpen(false)}
          className="w-40"
        >
          {Object.values(NoteType).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onChange(type);
                setOpen(false);
              }}
              className={`w-full text-left transition-colors active:bg-gray-50
                ${isMobile ? "px-4 py-3.5 text-base hover:bg-gray-50" : "px-3 py-1.5 text-xs hover:bg-gray-50"}
                ${type === value ? "font-bold text-gray-700" : "text-gray-600"}`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </AnchoredDropdown>
      )}
    </div>
  );
}
