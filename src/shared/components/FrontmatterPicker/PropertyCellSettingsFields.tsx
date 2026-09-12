import { toPropertyOptions } from "../../../desktop/components/Frontmatter/lib/frontmatterUtils";
import type { NoteFile } from "../../hooks/useFileTree";
import type { NumberDef } from "../../lib/FrontmatterPicker/numberProperty";
import { getPropertyTypeOptions } from "./PropertyCellSettingsPopup";
import { PropertyModeFields } from "./PropertyModeFields";
import type { PropertyCellSettings } from "./usePropertyCellSettings";

interface Props {
  settings: PropertyCellSettings;
  fieldKey: string;
  numberFormatConstraint?: NumberDef;
  frontmatter: Record<string, unknown>;
  noteResolver: (path: string) => NoteFile | undefined;
  allNotes: NoteFile[];
}

/**
 * Corps du panneau de réglages Texte/Nombre/Bouton d'une cellule de tableau —
 * factorisé entre PropertyCellSettingsPopup (déclenché par la roue crantée,
 * cellule Texte/Bouton libre) et NumberCellSelector (déclenché en tapant la
 * valeur, cellule déjà Nombre) : les deux montent le même `settings.draft`
 * dans le même switcher, seul le déclencheur d'ouverture diffère.
 */
export function PropertyCellSettingsFields({
  settings,
  fieldKey,
  numberFormatConstraint,
  frontmatter,
  noteResolver,
  allNotes,
}: Props) {
  if (!settings.draft) return null;
  const { draft } = settings;
  const close = () => settings.commitAndClose();

  return (
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
        modeOptions={getPropertyTypeOptions(numberFormatConstraint)}
        mode={draft.type}
        onModeChange={settings.handleTypeChange}
        text={draft.text}
        onTextChange={(text) => settings.setDraft({ ...draft, text })}
        numberDef={draft.numberDef}
        onNumberDefChange={(numberDef) =>
          settings.setDraft({ ...draft, numberDef })
        }
        numberFormatLocked={!!numberFormatConstraint}
        enumDef={draft.enumDef}
        onEnumDefChange={(enumDef) => settings.setDraft({ ...draft, enumDef })}
        allNotes={allNotes}
        noteResolver={noteResolver}
        selfProperties={toPropertyOptions(Object.keys(frontmatter), fieldKey)}
        autoFocus
      />
    </div>
  );
}
