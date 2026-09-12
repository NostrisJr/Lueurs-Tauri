import { useEffect, useRef } from "react";
import { ColorDotPicker } from "../../../shared/components/FrontmatterPicker/ColorDotPicker";
import { IconPlus, IconXCircle } from "../../../shared/components/PlatformIcon";
import {
  type EnumDef,
  addOption,
  removeOption,
  updateOptionValue,
} from "../../../shared/lib/FrontmatterPicker/enumProperty";
import { isMobile } from "../../../shared/lib/platform";

interface Props {
  enumDef: EnumDef;
  onChange: (next: EnumDef) => void;
  /** Cf. ColorDotPicker.zIndex — nécessaire si ce champ est rendu dans un popup déjà empilé. */
  dropdownZIndex?: number;
  /** Focus la première option au montage (pas seulement à l'ajout, cf. l'effet ci-dessous). */
  autoFocus?: boolean;
}

/**
 * Options d'une propriété Bouton — rendu sous la ligne icônes+champ, comme
 * NumberFormatFields pour Nombre. Liste éditable (libellé, couleur, défaut,
 * retrait) + ajout, en remplacement de la saisie brute $$ENUM([...])$$.
 */
export function EnumOptionsFields({
  enumDef,
  onChange,
  dropdownZIndex,
  autoFocus,
}: Props) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const prevLength = useRef(enumDef.options.length);

  // Focus la dernière option ajoutée — jamais au retrait ou au renommage.
  useEffect(() => {
    if (enumDef.options.length > prevLength.current) {
      inputRefs.current[enumDef.options.length - 1]?.focus();
    }
    prevLength.current = enumDef.options.length;
  }, [enumDef.options.length]);

  // Focus la première option au montage (ouverture de la sheet) — sans ça,
  // Texte/Nombre recevaient le focus automatique à l'ouverture (donc le
  // clavier) mais pas Bouton, provoquant un aller-retour de hauteur au tap
  // suivant sur un champ.
  // biome-ignore lint/correctness/useExhaustiveDependencies: une seule fois au montage, pas à chaque changement de autoFocus
  useEffect(() => {
    if (autoFocus) inputRefs.current[0]?.focus();
  }, []);

  const inputClass = `flex-1 min-w-0 border outline-none transition-colors border-gray-200 focus:border-gray-400 ${isMobile ? "rounded-lg" : "rounded"}
    ${isMobile ? "px-3 py-2 text-base" : "px-2 py-1 text-xs"}`;
  const iconButtonClass = `shrink-0 flex items-center justify-center p-0 bg-transparent border-0 cursor-pointer transition-colors ${isMobile ? "size-4" : "size-3"}`;

  return (
    <div className="flex flex-col gap-1.5">
      {enumDef.options.map((opt, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: liste seulement ajoutée/retirée en bout, jamais réordonnée ; une clé basée sur la valeur ferait perdre le focus à chaque frappe (renommage)
        <div key={i} className="flex items-center gap-2">
          <ColorDotPicker
            color={opt.color}
            onColor={(color) =>
              onChange({
                ...enumDef,
                options: enumDef.options.map((o, j) =>
                  j === i ? { ...o, color } : o
                ),
              })
            }
            title="Couleur"
            className={`shrink-0 rounded-full border-2 border-white shadow-sm cursor-pointer transition-transform hover:scale-110 ${isMobile ? "size-6" : "size-5"}`}
            zIndex={dropdownZIndex}
          />
          <input
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            value={opt.value}
            onChange={(e) =>
              onChange(updateOptionValue(enumDef, i, e.target.value))
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
            onClick={() => onChange({ ...enumDef, default: opt.value })}
            title="Valeur par défaut des héritiers"
            className={`shrink-0 flex items-center justify-center transition-colors cursor-pointer ${isMobile ? "size-5" : "size-3"} ${
              opt.value === enumDef.default
                ? "text-amber-500"
                : "text-gray-200 hover:text-gray-400"
            }`}
          >
            <span
              className={
                isMobile ? "text-base leading-none" : "text-[10px] leading-none"
              }
            >
              ●
            </span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(removeOption(enumDef, i))}
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
        onClick={() => onChange(addOption(enumDef))}
        className={`flex items-center gap-1 self-start text-gray-400 hover:text-gray-600 transition-colors cursor-pointer ${isMobile ? "text-base py-1" : "text-xs"}`}
      >
        <IconPlus className={isMobile ? "size-4" : "size-3"} />
        ajouter une option
      </button>
    </div>
  );
}
