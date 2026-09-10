import { useRef } from "react";
import { toPropertyOptions } from "../../../desktop/components/Frontmatter/lib/frontmatterUtils";
import type { NoteFile } from "../../hooks/useFileTree";
import type { NumberDef } from "../../lib/FrontmatterPicker/numberProperty";
import type { PropertyType } from "../../lib/FrontmatterPicker/propertyDraft";
import { AnchoredDropdown } from "../AnchoredDropdown";
import { IconGearshape } from "../PlatformIcon";
import { PropertyModeFields } from "./PropertyModeFields";
import type { PropertyCellSettings } from "./usePropertyCellSettings";

const TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: "text", label: "Texte" },
  { value: "number", label: "Nombre" },
  { value: "enum", label: "Bouton" },
];

interface Props {
  settings: PropertyCellSettings;
  fieldKey: string;
  numberFormatConstraint?: NumberDef;
  frontmatter: Record<string, unknown>;
  noteResolver: (path: string) => NoteFile | undefined;
  allNotes: NoteFile[];
  onCommit: (value: string) => void;
}

/**
 * Roue crantée (hover, coin haut droit) → panneau Texte/Nombre/Bouton, pour
 * une cellule de tableau sans contrainte de template (ni enumConstraint ni
 * numberFormatConstraint — cf. TableCell, qui masque cette roue sinon, la
 * roue étant déjà couverte par EnumValueSelector/NumberCellSelector dans ces
 * cas, cf. leurs commentaires "pas de second bouton réglages ici").
 */
export function PropertyCellSettingsPopup({
  settings,
  fieldKey,
  numberFormatConstraint,
  frontmatter,
  noteResolver,
  allNotes,
  onCommit,
}: Props) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const close = () => settings.commitAndClose(onCommit);

  // Format imposé par un template : Texte/Bouton désactivés — même règle que
  // FrontmatterRow.typeOptions, jamais atteinte ici en pratique (cf. TableCell,
  // qui délègue déjà ce cas à NumberCellSelector), gardée par cohérence.
  const typeOptions = numberFormatConstraint
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

  return (
    <>
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

      {settings.open && settings.draft && (
        <AnchoredDropdown anchorRef={anchorRef} onClose={close} className="p-2">
          <div
            className="flex flex-col gap-2"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault();
                close();
              }
            }}
          >
            <PropertyModeFields
              modeOptions={typeOptions}
              mode={settings.draft.type}
              onModeChange={settings.handleTypeChange}
              text={settings.draft.text}
              onTextChange={(text) =>
                settings.setDraft(settings.draft && { ...settings.draft, text })
              }
              numberDef={settings.draft.numberDef}
              onNumberDefChange={(numberDef) =>
                settings.setDraft(
                  settings.draft && { ...settings.draft, numberDef }
                )
              }
              numberFormatLocked={!!numberFormatConstraint}
              enumDef={settings.draft.enumDef}
              onEnumDefChange={(enumDef) =>
                settings.setDraft(
                  settings.draft && { ...settings.draft, enumDef }
                )
              }
              allNotes={allNotes}
              noteResolver={noteResolver}
              selfProperties={toPropertyOptions(
                Object.keys(frontmatter),
                fieldKey
              )}
              autoFocus
            />
          </div>
        </AnchoredDropdown>
      )}
    </>
  );
}
