import { useRef, useState } from "react";
import { NoteChip } from "./NoteChip";
import { SystemField, type NoteTypeValue } from "../../lib/noteTypes";
import { TypeSelector } from "./TypeSelector";
import { isFormula, computeFormula } from "../../lib/formulas";
import type { NoteFile } from "../FileTree/hooks/useFileTree";

interface Props {
  fieldKey: string;
  value: string | string[];
  isNoteArray: boolean;
  isSystem: boolean;
  isValueLocked: boolean;
  // Propriétés de la note courante — nécessaires pour évaluer les formules
  formulaVars?: Record<string, unknown>;
  // Notes enfant de la base — nécessaires pour agg()
  formulaChildren?: NoteFile[];
  onTextChange: (value: string) => void;
  onTextBlur: () => void;
  onRemoveNote: (path: string) => void;
  noteName: (path: string) => string;
}

export function FrontmatterValue({
  fieldKey,
  value,
  isNoteArray,
  isSystem,
  isValueLocked,
  formulaVars,
  formulaChildren,
  onTextChange,
  onTextBlur,
  onRemoveNote,
  noteName,
}: Props) {
  const [editingFormula, setEditingFormula] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (fieldKey === SystemField.TYPE) {
    return (
      <TypeSelector
        value={value as string}
        onChange={(type: NoteTypeValue) => onTextChange(type)}
      />
    );
  }

  if (isNoteArray) {
    const paths = value as string[];
    return (
      <div className="flex flex-wrap gap-1 flex-1">
        {paths.map((path) => (
          <NoteChip
            key={path}
            name={noteName(path)}
            onRemove={() => onRemoveNote(path)}
          />
        ))}
        {paths.length === 0 && (
          <span className="text-gray-300 italic text-xs mt-0.5">
            aucune note
          </span>
        )}
      </div>
    );
  }

  const strValue = value as string;

  // ── Propriété calculée ────────────────────────────────────────────────────
  if (isFormula(strValue)) {
    const computed = computeFormula(
      strValue,
      formulaVars ?? {},
      formulaChildren
    );
    const isError = computed === "#ERREUR";

    if (editingFormula && !isValueLocked) {
      return (
        <input
          ref={inputRef}
          // biome-ignore lint/a11y/noAutofocus: focus intentionnel à l'ouverture de l'édition formule
          autoFocus
          value={strValue}
          onChange={(e) => onTextChange(e.target.value)}
          onBlur={() => setEditingFormula(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") {
              setEditingFormula(false);
            }
          }}
          className="flex-1 mt-0.5 bg-transparent outline-none border-b border-gray-300 text-gray-600 focus:border-gray-300 transition-colors font-mono text-xs"
        />
      );
    }

    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
      <span
        className={`flex items-center gap-1 flex-1 mt-0.5 text-xs select-none ${
          isValueLocked ? "cursor-default" : "cursor-pointer"
        }`}
        title={isValueLocked ? strValue : "Cliquer pour éditer la formule"}
        onClick={() => !isValueLocked && setEditingFormula(true)}
      >
        {/* Badge formule */}
        <span className="text-gray-300 font-mono text-[10px] leading-none">
          ƒ
        </span>
        <span className={isError ? "text-red-400" : "text-gray-600"}>
          {computed || "—"}
        </span>
      </span>
    );
  }

  // ── Valeur texte standard ─────────────────────────────────────────────────
  return (
    <input
      value={strValue}
      onChange={(e) => !isValueLocked && onTextChange(e.target.value)}
      onBlur={onTextBlur}
      disabled={isValueLocked}
      placeholder={isValueLocked ? undefined : "valeur"}
      className={`flex-1 mt-0.5 bg-transparent outline-none border-b border-transparent
                ${isSystem ? "font-bold" : ""}
                ${
                  isValueLocked
                    ? "text-gray-300 select-none"
                    : "text-gray-600 focus:border-gray-300"
                }
                transition-colors`}
    />
  );
}
