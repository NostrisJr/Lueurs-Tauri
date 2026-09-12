import { pillClasses } from "../../lib/FrontmatterPicker/enumPillColors";
import type { EnumDef } from "../../lib/FrontmatterPicker/enumProperty";
import { isMobile } from "../../lib/platform";
import { AnchoredDropdown } from "../AnchoredDropdown";

interface Props {
  anchorRef: { current: HTMLElement | null };
  value: string;
  constraint: EnumDef;
  onSelect: (value: string) => void;
  onClose: () => void;
  className?: string;
  zIndex?: number;
}

/**
 * Liste d'options d'un dropdown ENUM — extrait d'EnumValueSelector pour être
 * réutilisé par le dropdown rapide d'une formule inline ENUM (node-view.ts,
 * pas de pill React propre là-bas : l'ancre est le span DOM du nœud).
 */
export function EnumOptionsDropdown({
  anchorRef,
  value,
  constraint,
  onSelect,
  onClose,
  className = "w-40",
  zIndex,
}: Props) {
  return (
    <AnchoredDropdown
      anchorRef={anchorRef}
      onClose={onClose}
      className={className}
      zIndex={zIndex}
    >
      {constraint.options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={`w-full text-left hover:bg-gray-50 active:bg-gray-50 transition-colors flex items-center gap-2
            ${isMobile ? "px-4 py-3.5" : "px-3 py-1.5"}`}
        >
          <span
            className={`inline-flex px-2 py-0.5 rounded-md font-medium ${isMobile ? "text-base" : "text-xs"} ${pillClasses(opt.color)}`}
          >
            {opt.value}
          </span>
          {opt.value === value && (
            <span
              className={`text-gray-400 ${isMobile ? "text-base" : "text-[10px]"}`}
            >
              ✓
            </span>
          )}
        </button>
      ))}
    </AnchoredDropdown>
  );
}
