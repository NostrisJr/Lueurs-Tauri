import { useRef, useState } from "react";
import {
  type ButtonDef,
  enumValueState,
  optionColor,
} from "../../lib/FrontmatterPicker/buttonProperty";
import { pillClasses } from "../../lib/FrontmatterPicker/enumPillColors";
import { AnchoredDropdown } from "../AnchoredDropdown";

interface Props {
  value: string;
  constraint: ButtonDef;
  disabled?: boolean;
  onChange: (value: string) => void;
}

/**
 * Pill + dropdown pour une propriété contrainte par un BUTTON.
 * Le dropdown ne liste que les valeurs permises (pas de retour au placeholder).
 * Une valeur hors-liste est signalée (invalide) sans être effacée.
 */
export function EnumValueSelector({
  value,
  constraint,
  disabled,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const state = enumValueState(value, constraint);

  const tone =
    state === "invalid"
      ? "bg-red-50 text-red-500 line-through"
      : state === "placeholder"
        ? "bg-gray-50 text-gray-400 italic"
        : pillClasses(optionColor(value, constraint));

  return (
    <span className="inline-flex">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        title={
          state === "invalid" ? "Valeur non permise par le template" : undefined
        }
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${tone} ${
          disabled ? "cursor-default" : "cursor-pointer hover:brightness-95"
        }`}
      >
        <span>{value || "—"}</span>
        {!disabled && (
          <span className="text-[9px] leading-none opacity-60">▾</span>
        )}
      </button>

      {open && (
        <AnchoredDropdown
          anchorRef={buttonRef}
          onClose={() => setOpen(false)}
          className="w-40"
        >
          {constraint.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <span
                className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${pillClasses(opt.color)}`}
              >
                {opt.value}
              </span>
              {opt.value === value && (
                <span className="text-[10px] text-gray-400">✓</span>
              )}
            </button>
          ))}
        </AnchoredDropdown>
      )}
    </span>
  );
}
