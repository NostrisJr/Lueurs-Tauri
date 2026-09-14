import clsx from "clsx";
import type { NumberDef } from "../../../shared/lib/FrontmatterPicker/numberProperty";
import { isMobile } from "../../../shared/lib/platform";

interface Props {
  numberDef: NumberDef;
  onChange: (next: NumberDef) => void;
  /** Format imposé par un template : champs en lecture seule (cf. useValueEditor). */
  disabled?: boolean;
}

/** Décimales + unité d'une propriété Nombre — rendu sous la ligne icônes+champ. */
export function NumberFormatFields({ numberDef, onChange, disabled }: Props) {
  const labelClass = `text-ink-4 uppercase tracking-wide ${isMobile ? "text-base" : "text-[10px]"}`;
  const inputClass = `w-full border outline-none transition-colors ${isMobile ? "rounded-lg" : "rounded"}
    ${isMobile ? "px-3 py-2 text-base" : "px-2 py-1 text-xs"}
    ${
      disabled
        ? "border-line text-ink-4 bg-surface-2 cursor-not-allowed"
        : "border-line-2 focus:border-line-3"
    }`;
  const title = disabled ? "Imposé par le template" : undefined;

  return (
    <div className={clsx("flex", isMobile ? "gap-4" : "gap-2")}>
      <label
        className={clsx(
          "flex flex-col gap-1 shrink-0",
          isMobile ? "w-24" : "w-20"
        )}
      >
        <span className={labelClass}>Décimales</span>
        <input
          type="number"
          min={0}
          value={numberDef.decimals ?? ""}
          placeholder="—"
          disabled={disabled}
          title={title}
          onChange={(e) =>
            onChange({
              ...numberDef,
              decimals:
                e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 flex-1">
        <span className={labelClass}>Unité</span>
        <input
          type="text"
          value={numberDef.unit ?? ""}
          placeholder="km, €, %…"
          disabled={disabled}
          title={title}
          onChange={(e) =>
            onChange({ ...numberDef, unit: e.target.value || undefined })
          }
          className={inputClass}
        />
      </label>
    </div>
  );
}
