import clsx from "clsx";
import { useRef, useState } from "react";
import { AnchoredDropdown } from "../../../shared/components/AnchoredDropdown";
import { NoteType, type NoteTypeValue } from "../../../shared/lib/noteTypes";
import { isMobile } from "../../../shared/lib/platform";

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
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const label =
    TYPE_LABELS[value as NoteTypeValue] ?? value.replace(/^__|__$/g, "");

  return (
    <div className="flex-1 mt-0.5">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "font-bold text-xs transition-colors cursor-pointer select-none",
          "text-ink-2",
          "hover:text-ink"
        )}
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
              className={clsx(
                "w-full text-left transition-colors active:bg-surface-2",
                isMobile
                  ? "px-4 py-3.5 text-base hover:bg-surface-2"
                  : "px-3 py-1.5 text-xs hover:bg-surface-2",
                type === value ? "font-bold text-ink-2" : "text-ink-2"
              )}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </AnchoredDropdown>
      )}
    </div>
  );
}
