import clsx from "clsx";
import { useRef } from "react";
import type { NoteFile } from "../../hooks/useFileTree";
import type { NumberDef } from "../../lib/FrontmatterPicker/numberProperty";
import { computeFormula, isFormula, isFormulaError } from "../../lib/formulas";
import { isMobile } from "../../lib/platform";
import { AnchoredDropdown } from "../AnchoredDropdown";
import { PropertyCellSettingsFields } from "./PropertyCellSettingsFields";
import type { PropertyCellSettings } from "./usePropertyCellSettings";

interface Props {
  fieldKey: string;
  value: string;
  /** Contrainte de format imposée par un template : decimals/unit imposés, expr libre. */
  numberFormatConstraint?: NumberDef;
  frontmatter: Record<string, unknown>;
  noteResolver: (path: string) => NoteFile | undefined;
  allNotes: NoteFile[];
  settings: PropertyCellSettings;
}

/**
 * Cellule Nombre d'un tableau (BaseView) : valeur formatée affichée en ligne,
 * édition (switcher Texte/Nombre/Bouton + expression + décimales/unité) dans
 * un popup flottant ancré au tap. `settings` est instancié UNE fois par
 * TableCell/MobileTableCell et partagé avec PropertyCellSettingsPopup — sans
 * ça, une cellule en $$NUMBER(...)$$ non contrainte n'avait aucun moyen de
 * repasser en Texte/Bouton depuis le tableau (le switcher n'existait que côté
 * PropertyCellSettingsPopup, jamais monté en même temps qu'une valeur Nombre).
 */
export function NumberCellSelector({
  fieldKey,
  value,
  numberFormatConstraint,
  frontmatter,
  noteResolver,
  allNotes,
  settings,
}: Props) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const close = () => settings.commitAndClose();

  const formula = isFormula(value);
  const displayValue = formula
    ? computeFormula(value, frontmatter, undefined, noteResolver)
    : value;
  const isError = isFormulaError(displayValue);

  return (
    <span className="inline-flex w-full min-w-0">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => (settings.open ? close() : settings.openPopup())}
        className={clsx(
          "w-full min-w-0 truncate text-left bg-transparent",
          "text-ink-2",
          formula && "flex items-baseline gap-1",
          isMobile ? "text-base" : "text-xs"
        )}
      >
        {formula && (
          <span
            className={clsx(
              "font-mono text-[10px] leading-none shrink-0",
              "text-ink-5"
            )}
          >
            ƒ
          </span>
        )}
        <span className={clsx(isError && "text-danger-2")}>
          {displayValue || "—"}
        </span>
      </button>

      {settings.open && settings.draft && (
        <AnchoredDropdown anchorRef={anchorRef} onClose={close} className="p-2">
          <PropertyCellSettingsFields
            settings={settings}
            fieldKey={fieldKey}
            numberFormatConstraint={numberFormatConstraint}
            frontmatter={frontmatter}
            noteResolver={noteResolver}
            allNotes={allNotes}
          />
        </AnchoredDropdown>
      )}
    </span>
  );
}
