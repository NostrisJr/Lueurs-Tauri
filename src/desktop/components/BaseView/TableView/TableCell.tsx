import { useCallback, useRef, useState } from "react";
import { FormulaEditField } from "../../../../shared/components/FormulaField/FormulaEditField";
import { EnumValueSelector } from "../../../../shared/components/FrontmatterPicker/EnumValueSelector";
import { NumberCellSelector } from "../../../../shared/components/FrontmatterPicker/NumberCellSelector";
import type {
  Frontmatter,
  NoteFile,
} from "../../../../shared/hooks/useFileTree";
import type { EnumDef } from "../../../../shared/lib/FrontmatterPicker/enumProperty";
import {
  type NumberDef,
  isNumberFormula,
} from "../../../../shared/lib/FrontmatterPicker/numberProperty";
import {
  computeFormula,
  humanizeFormula,
  isFormula,
  isFormulaError,
} from "../../../../shared/lib/formulas";
import { NoteSelector } from "../../Frontmatter/NoteSelector";
import { toPropertyOptions } from "../../Frontmatter/lib/frontmatterUtils";

interface Props {
  fieldKey: string;
  value: string;
  isImposed: boolean;
  enumConstraint?: EnumDef;
  numberFormatConstraint?: NumberDef;
  width: number;
  frontmatter: Frontmatter;
  noteResolver?: (path: string) => NoteFile | undefined;
  allNotes?: NoteFile[];
  onCommit: (value: string) => void;
}

export function TableCell({
  fieldKey,
  value,
  isImposed,
  enumConstraint,
  numberFormatConstraint,
  width,
  frontmatter,
  noteResolver,
  allNotes,
  onCommit,
}: Props) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  // Sous-mode formule : bascule immédiate (synchrone) à l'auto-pair "$$", pas
  // via un effect — même correctif que FrontmatterValue, pour la même raison
  // (éviter un render où le draft "$$$$" serait évalué comme formule invalide).
  const [editingFormula, setEditingFormula] = useState(false);
  const [refSelectorOpen, setRefSelectorOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref stable → assigne inputRef et sélectionne le texte au montage de l'input d'édition uniquement
  const editInputRef = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
    el?.select();
  }, []);
  const selectorOpenRef = useRef(false);
  const triggerCursorRef = useRef(0);

  const formula = isFormula(value);

  function toDisplay(raw: string): string {
    return noteResolver ? humanizeFormula(raw, noteResolver) : raw;
  }

  function closeSelectors() {
    selectorOpenRef.current = false;
    setRefSelectorOpen(false);
    // rAF, pas setTimeout : cf. FormulaEditField.closeSelectors (même course
    // avec la vérification de focus du panneau englobant).
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function resetSelectors() {
    selectorOpenRef.current = false;
    setRefSelectorOpen(false);
  }

  function startEdit() {
    if (isImposed) return;
    setDraft(value);
    setEditingFormula(false);
    setEditing(true);
  }

  function commit(rawValue: string) {
    setEditing(false);
    setEditingFormula(false);
    resetSelectors();
    onCommit(rawValue);
  }

  function cancel() {
    setDraft(value);
    setEditingFormula(false);
    setEditing(false);
  }

  const displayValue = formula
    ? computeFormula(
        value,
        frontmatter as Record<string, unknown>,
        undefined,
        noteResolver
      )
    : value;
  const isError = isFormulaError(displayValue);

  // ── Contrainte ENUM : dropdown au lieu de l'édition texte ───────────────
  if (enumConstraint) {
    return (
      <div
        style={{ width }}
        className="shrink-0 border-r border-gray-100 px-3 flex items-center last:border-none"
      >
        <EnumValueSelector
          value={value}
          constraint={enumConstraint}
          onChange={onCommit}
        />
      </div>
    );
  }

  // ── Colonne NUMBER (format imposé par un template, ou valeur déjà NUMBER) :
  // popup expr + décimales/unité, plutôt que la formule brute éditée à la main.
  if (!isImposed && (numberFormatConstraint || isNumberFormula(value))) {
    return (
      <div
        style={{ width }}
        className="shrink-0 border-r border-gray-100 px-3 flex items-center last:border-none"
      >
        <NumberCellSelector
          fieldKey={fieldKey}
          value={value}
          numberFormatConstraint={numberFormatConstraint}
          frontmatter={frontmatter}
          noteResolver={noteResolver ?? (() => undefined)}
          allNotes={allNotes ?? []}
          onCommit={onCommit}
        />
      </div>
    );
  }

  return (
    <div
      style={{ width }}
      className={`shrink-0 border-r border-gray-100 px-3 text-xs truncate last:border-none ${
        isImposed
          ? "cursor-default text-gray-300"
          : value
            ? "text-gray-700 cursor-text"
            : "text-gray-300 cursor-text"
      }`}
      onDoubleClick={startEdit}
    >
      {editing ? (
        isFormula(draft) || editingFormula ? (
          <FormulaEditField
            rawValue={draft}
            onChange={setDraft}
            onDone={() => commit(draft)}
            allNotes={allNotes ?? []}
            noteResolver={noteResolver ?? (() => undefined)}
            selfProperties={toPropertyOptions(
              Object.keys(frontmatter),
              fieldKey
            )}
            inputClassName="w-full bg-transparent outline-none text-gray-700 font-mono rounded px-1 -mx-1"
          />
        ) : (
          <div className="relative">
            <input
              ref={editInputRef}
              // biome-ignore lint/a11y/noAutofocus: focus intentionnel à l'ouverture de l'édition
              autoFocus
              value={draft}
              onChange={(e) => {
                const newVal = e.target.value;
                const cursorPos = e.target.selectionStart ?? newVal.length;
                const toCursor = newVal.slice(0, cursorPos);
                const afterCursor = newVal.slice(cursorPos);

                // Auto-pair : $$ → $$|$$, bascule immédiate en édition de formule
                if (toCursor.endsWith("$$") && !afterCursor.startsWith("$$")) {
                  setDraft(`${toCursor}$$${afterCursor}`);
                  setEditingFormula(true);
                  return;
                }

                if (toCursor.endsWith("ref(")) {
                  triggerCursorRef.current = cursorPos;
                  selectorOpenRef.current = true;
                  setRefSelectorOpen(true);
                } else {
                  resetSelectors();
                }
                setDraft(newVal);
              }}
              onBlur={() => {
                if (!selectorOpenRef.current) commit(draft);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !selectorOpenRef.current)
                  commit(draft);
                if (e.key === "Escape") {
                  if (selectorOpenRef.current) closeSelectors();
                  else cancel();
                }
              }}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="w-full bg-transparent outline-none text-gray-700 font-body rounded px-1 -mx-1"
            />
            {refSelectorOpen && allNotes && (
              <NoteSelector
                notes={allNotes}
                onSelect={(note) => {
                  const cursor = triggerCursorRef.current;
                  const current = inputRef.current?.value ?? draft;
                  const before = current.slice(0, cursor - 4);
                  const after = current.slice(cursor);
                  const inserted = `ref("${note.id}")`;
                  const newVal = `${before}${inserted}${after}`;
                  setDraft(newVal);
                  closeSelectors();
                  const newCursor = before.length + inserted.length;
                  setTimeout(
                    () =>
                      inputRef.current?.setSelectionRange(newCursor, newCursor),
                    0
                  );
                }}
                onClose={closeSelectors}
                anchorRef={inputRef}
                placeholder="Référencer une note..."
              />
            )}
          </div>
        )
      ) : formula ? (
        <span
          className="flex items-center gap-1 text-gray-400"
          title={toDisplay(value)}
        >
          <span className="text-gray-300 font-mono text-[10px] leading-none">
            ƒ
          </span>
          <span className={isError ? "text-red-400" : undefined}>
            {displayValue || "—"}
          </span>
        </span>
      ) : (
        <span>{value || "—"}</span>
      )}
    </div>
  );
}
