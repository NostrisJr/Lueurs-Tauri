import { EnumOptionsFields } from "../../../desktop/components/Frontmatter/EnumOptionsFields";
/**
 * PropertyModeFields — switcher Texte/Nombre/Bouton + champ correspondant.
 * Extrait du corps de InlineFormulaEditPopup (formule inline du corps de
 * note) pour être réutilisé par les réglages d'une cellule de tableau
 * (usePropertyCellSettings/PropertyCellSettingsPopup), qui a besoin du mode
 * Texte en plus — InlineFormulaPopup continue de n'exposer que Nombre/Bouton
 * (un nœud de formule inline n'est jamais "juste du texte").
 */
import { NumberExprField } from "../../../desktop/components/Frontmatter/NumberExprField";
import { NumberFormatFields } from "../../../desktop/components/Frontmatter/NumberFormatFields";
import type { PropertyOption } from "../../../desktop/components/Frontmatter/lib/frontmatterUtils";
import type { NoteFile } from "../../hooks/useFileTree";
import type { EnumDef } from "../../lib/FrontmatterPicker/enumProperty";
import type { NumberDef } from "../../lib/FrontmatterPicker/numberProperty";
import type { PropertyType } from "../../lib/FrontmatterPicker/propertyDraft";
import { isMobile } from "../../lib/platform";
import { SegmentedControl } from "../SegmentedControl";

interface ModeOption {
  value: PropertyType;
  label: string;
  disabled?: boolean;
  title?: string;
}

interface Props {
  modeOptions: ModeOption[];
  mode: PropertyType;
  onModeChange: (mode: PropertyType) => void;
  /** Ignorés si "text" n'apparaît pas dans modeOptions (cf. InlineFormulaPopup). */
  text?: string;
  onTextChange?: (text: string) => void;
  numberDef: NumberDef;
  onNumberDefChange: (def: NumberDef) => void;
  numberFormatLocked?: boolean;
  enumDef: EnumDef;
  onEnumDefChange: (def: EnumDef) => void;
  allNotes: NoteFile[];
  noteResolver: (path: string) => NoteFile | undefined;
  selfProperties: PropertyOption[];
  refPathOf?: (note: NoteFile) => string;
  dropdownZIndex?: number;
  autoFocus?: boolean;
  onFieldDone?: () => void;
}

export function PropertyModeFields({
  modeOptions,
  mode,
  onModeChange,
  text,
  onTextChange,
  numberDef,
  onNumberDefChange,
  numberFormatLocked,
  enumDef,
  onEnumDefChange,
  allNotes,
  noteResolver,
  selfProperties,
  refPathOf,
  dropdownZIndex,
  autoFocus,
  onFieldDone,
}: Props) {
  const fieldClassName = `w-full bg-transparent outline-none border-b text-gray-700 focus:border-amber-400 transition-colors font-mono ${
    isMobile ? "text-base py-1 border-gray-200" : "text-sm border-gray-300"
  }`;

  return (
    <>
      <SegmentedControl
        options={modeOptions}
        value={mode}
        onChange={onModeChange}
        variant="pill"
      />

      {mode === "text" ? (
        <input
          type="text"
          value={text ?? ""}
          onChange={(e) => onTextChange?.(e.target.value)}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="valeur"
          // biome-ignore lint/a11y/noAutofocus: ouverture intentionnelle du champ en édition
          autoFocus={autoFocus}
          className={fieldClassName}
        />
      ) : mode === "number" ? (
        <div className="flex items-center gap-1">
          <span
            className={`text-gray-300 font-mono leading-none shrink-0 ${isMobile ? "text-base" : "text-xs"}`}
          >
            ƒ
          </span>
          <NumberExprField
            expr={numberDef.expr}
            onChange={(expr) => onNumberDefChange({ ...numberDef, expr })}
            allNotes={allNotes}
            noteResolver={noteResolver}
            selfProperties={selfProperties}
            inputClassName={fieldClassName}
            autoFocus={autoFocus}
            refPathOf={refPathOf}
            dropdownZIndex={dropdownZIndex}
            onFieldDone={onFieldDone}
          />
        </div>
      ) : (
        <EnumOptionsFields
          enumDef={enumDef}
          onChange={onEnumDefChange}
          dropdownZIndex={dropdownZIndex}
          autoFocus={autoFocus}
        />
      )}

      {mode === "number" && (
        <NumberFormatFields
          numberDef={numberDef}
          onChange={onNumberDefChange}
          disabled={numberFormatLocked}
        />
      )}
    </>
  );
}
