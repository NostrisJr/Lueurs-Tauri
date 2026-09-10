import { platform } from "@tauri-apps/plugin-os";
import { useEffect, useRef } from "react";
import { ColorDotPicker } from "../../../shared/components/FrontmatterPicker/ColorDotPicker";
import { IconPlus, IconXCircle } from "../../../shared/components/PlatformIcon";
import {
  type ButtonDef,
  addOption,
  removeOption,
  updateOptionValue,
} from "../../../shared/lib/FrontmatterPicker/buttonProperty";

interface Props {
  buttonDef: ButtonDef;
  onChange: (next: ButtonDef) => void;
}

/**
 * Options d'une propriété Bouton — rendu sous la ligne icônes+champ, comme
 * NumberFormatFields pour Nombre. Liste éditable (libellé, couleur, défaut,
 * retrait) + ajout, en remplacement de la saisie brute $$BUTTON([...])$$.
 */
export function ButtonOptionsFields({ buttonDef, onChange }: Props) {
  const isMobile = platform() === "ios";
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const prevLength = useRef(buttonDef.options.length);

  // Focus la dernière option ajoutée — jamais au retrait ou au renommage.
  useEffect(() => {
    if (buttonDef.options.length > prevLength.current) {
      inputRefs.current[buttonDef.options.length - 1]?.focus();
    }
    prevLength.current = buttonDef.options.length;
  }, [buttonDef.options.length]);

  const inputClass = `flex-1 min-w-0 border rounded outline-none transition-colors border-gray-200 focus:border-gray-400
    ${isMobile ? "px-3 py-2 text-base" : "px-2 py-1 text-xs"}`;
  const iconButtonClass = `shrink-0 p-0 bg-transparent border-0 cursor-pointer transition-colors ${isMobile ? "size-4" : "size-3"}`;

  return (
    <div className="flex flex-col gap-1.5">
      {buttonDef.options.map((opt, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: liste seulement ajoutée/retirée en bout, jamais réordonnée ; une clé basée sur la valeur ferait perdre le focus à chaque frappe (renommage)
        <div key={i} className="flex items-center gap-2">
          <ColorDotPicker
            color={opt.color}
            onColor={(color) =>
              onChange({
                ...buttonDef,
                options: buttonDef.options.map((o, j) =>
                  j === i ? { ...o, color } : o
                ),
              })
            }
            title="Couleur"
            className={`shrink-0 rounded-full border-2 border-white shadow-sm cursor-pointer transition-transform hover:scale-110 ${isMobile ? "size-6" : "size-5"}`}
          />
          <input
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            value={opt.value}
            onChange={(e) =>
              onChange(updateOptionValue(buttonDef, i, e.target.value))
            }
            placeholder="Libellé"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            style={isMobile ? { fontSize: 16 } : undefined}
            className={inputClass}
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange({ ...buttonDef, default: opt.value })}
            title="Valeur par défaut des héritiers"
            className={`shrink-0 text-[10px] leading-none transition-colors cursor-pointer ${
              opt.value === buttonDef.default
                ? "text-amber-500"
                : "text-gray-200 hover:text-gray-400"
            }`}
          >
            ●
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(removeOption(buttonDef, i))}
            title="Retirer l'option"
            className={`${iconButtonClass} text-gray-300 hover:text-red-400`}
          >
            <IconXCircle className="size-full" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onChange(addOption(buttonDef))}
        className={`flex items-center gap-1 self-start text-gray-400 hover:text-gray-600 transition-colors cursor-pointer ${isMobile ? "text-sm py-1" : "text-xs"}`}
      >
        <IconPlus className={isMobile ? "size-4" : "size-3"} />
        ajouter une option
      </button>
    </div>
  );
}
