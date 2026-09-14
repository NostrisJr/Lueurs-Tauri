import clsx from "clsx";
import { useRef, useState } from "react";
import { pillClasses } from "../../lib/FrontmatterPicker/enumPillColors";
import {
  type EnumDef,
  enumValueState,
  optionColor,
} from "../../lib/FrontmatterPicker/enumProperty";
import { EnumOptionsDropdown } from "./EnumOptionsDropdown";

interface Props {
  value: string;
  constraint: EnumDef;
  disabled?: boolean;
  onChange: (value: string) => void;
}

/**
 * Pill + dropdown pour une propriété contrainte par un ENUM.
 * Le dropdown ne liste que les valeurs permises (pas de retour au placeholder).
 * Une valeur hors-liste est signalée (invalide) sans être effacée.
 * Éditer la définition (options/couleurs) passe par la roue crantée de
 * FrontmatterRow — pas de second bouton réglages ici, ce serait redondant.
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
      ? "bg-danger-soft text-danger line-through"
      : state === "placeholder"
        ? "bg-surface-2 text-ink-4 italic"
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
        className={clsx(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors",
          tone,
          disabled ? "cursor-default" : "cursor-pointer hover:brightness-95"
        )}
      >
        <span>{value || "—"}</span>
        {!disabled && (
          <span className="text-[9px] leading-none opacity-60">▾</span>
        )}
      </button>

      {open && (
        <EnumOptionsDropdown
          anchorRef={buttonRef}
          value={value}
          constraint={constraint}
          onSelect={(v) => {
            onChange(v);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}
