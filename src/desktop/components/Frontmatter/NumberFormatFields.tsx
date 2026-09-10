import { platform } from "@tauri-apps/plugin-os";
import type { NumberDef } from "../../../shared/lib/FrontmatterPicker/numberProperty";

interface Props {
  numberDef: NumberDef;
  onChange: (next: NumberDef) => void;
  /** Format imposé par un template : champs en lecture seule (cf. useValueEditor). */
  disabled?: boolean;
}

/** Décimales + unité d'une propriété Nombre — rendu sous la ligne icônes+champ. */
export function NumberFormatFields({ numberDef, onChange, disabled }: Props) {
  const isMobile = platform() === "ios";
  const labelClass = `text-gray-400 uppercase tracking-wide ${isMobile ? "text-base" : "text-[10px]"}`;
  const inputClass = `w-full border rounded outline-none transition-colors
    ${isMobile ? "px-3 py-2 text-base" : "px-2 py-1 text-xs"}
    ${
      disabled
        ? "border-gray-100 text-gray-400 bg-gray-50 cursor-not-allowed"
        : "border-gray-200 focus:border-gray-400"
    }`;
  const title = disabled ? "Imposé par le template" : undefined;

  return (
    <div className="flex gap-2">
      <label className="flex flex-col gap-1 w-20 shrink-0">
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
