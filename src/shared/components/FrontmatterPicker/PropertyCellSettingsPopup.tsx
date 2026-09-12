import { useRef } from "react";
import type { NoteFile } from "../../hooks/useFileTree";
import type { NumberDef } from "../../lib/FrontmatterPicker/numberProperty";
import type { PropertyType } from "../../lib/FrontmatterPicker/propertyDraft";
import { isMobile } from "../../lib/platform";
import { AnchoredDropdown } from "../AnchoredDropdown";
import { IconGearshape } from "../PlatformIcon";
import { PropertyCellSettingsFields } from "./PropertyCellSettingsFields";
import type { PropertyCellSettings } from "./usePropertyCellSettings";

export const TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: "text", label: "Texte" },
  { value: "number", label: "Nombre" },
  { value: "enum", label: "Bouton" },
];

/**
 * Options du switcher Texte/Nombre/Bouton, Texte/Bouton désactivés si un
 * template impose un format Nombre — partagé par PropertyCellSettingsPopup
 * (cellule Texte/Bouton libre) et NumberCellSelector (cellule déjà Nombre),
 * seuls les deux endroits où ce switcher est montré dans une cellule de
 * tableau.
 */
export function getPropertyTypeOptions(numberFormatConstraint?: NumberDef) {
  return numberFormatConstraint
    ? TYPE_OPTIONS.map((o) =>
        o.value !== "number"
          ? {
              ...o,
              disabled: true,
              title: "Format imposé par le template : doit rester un nombre",
            }
          : o
      )
    : TYPE_OPTIONS;
}

interface Props {
  settings: PropertyCellSettings;
  fieldKey: string;
  numberFormatConstraint?: NumberDef;
  frontmatter: Record<string, unknown>;
  noteResolver: (path: string) => NoteFile | undefined;
  allNotes: NoteFile[];
}

/**
 * Roue crantée (hover, coin haut droit) → panneau Texte/Nombre/Bouton, pour
 * une cellule de tableau sans contrainte de template (ni enumConstraint ni
 * numberFormatConstraint — cf. TableCell, qui masque cette roue sinon, la
 * roue étant déjà couverte par EnumValueSelector/NumberCellSelector dans ces
 * cas, cf. leurs commentaires "pas de second bouton réglages ici"). Sur
 * mobile, ce bouton n'est pas monté : hover/group-hover n'existent pas au
 * tactile, l'ouverture se fait par appui long sur la cellule (cf.
 * MobileTableCell/useLongPress) qui appelle directement settings.openPopup().
 */
export function PropertyCellSettingsPopup({
  settings,
  fieldKey,
  numberFormatConstraint,
  frontmatter,
  noteResolver,
  allNotes,
}: Props) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const close = () => settings.commitAndClose();

  return (
    <>
      {!isMobile && (
        <button
          ref={anchorRef}
          type="button"
          onClick={() => (settings.open ? close() : settings.openPopup())}
          onMouseDown={(e) => e.preventDefault()}
          title="Réglages de la propriété"
          className={`absolute top-0.5 right-0.5 p-0 bg-transparent border-0 cursor-pointer size-3 transition-colors
            ${settings.open ? "text-gray-500" : "text-transparent group-hover:text-gray-300 hover:text-gray-500"}`}
        >
          <IconGearshape className="size-full" />
        </button>
      )}

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
    </>
  );
}
