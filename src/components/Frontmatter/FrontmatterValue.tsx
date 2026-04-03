import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeFormula,
  dehumanizeFormula,
  humanizeFormula,
  isFormula,
} from "../../lib/formulas";
import { type NoteTypeValue, SystemField } from "../../lib/noteTypes";
import type { NoteFile } from "../FileTree/hooks/useFileTree";
import { NoteChip } from "./NoteChip";
import { NoteSelector } from "./NoteSelector";
import { type PropertyOption, PropertySelector } from "./PropertySelector";
import { TypeSelector } from "./TypeSelector";

interface Props {
  fieldKey: string;
  value: string | string[];
  isNoteArray: boolean;
  isSystem: boolean;
  isValueLocked: boolean;
  formulaVars?: Record<string, unknown>;
  formulaChildren?: NoteFile[];
  noteResolver?: (path: string) => NoteFile | undefined;
  allNotes?: NoteFile[];
  onTextChange: (value: string) => void;
  onTextBlur: () => void;
  onRemoveNote: (path: string) => void;
  noteName: (path: string) => string;
}

// Détecte ref("NomNote"). juste avant la position curseur
const REF_PROP_TRIGGER_RE = /ref\("([^"]+)"\)\.$/;

function getNoteProperties(note: NoteFile): PropertyOption[] {
  return Object.keys(note.frontmatter)
    .filter((k) => k !== SystemField.TYPE && k !== SystemField.CHILDREN)
    .map((key) => ({ key, displayName: key.replace(/^__|__$/g, "") }));
}

export function FrontmatterValue({
  fieldKey,
  value,
  isNoteArray,
  isSystem,
  isValueLocked,
  formulaVars,
  formulaChildren,
  noteResolver,
  allNotes,
  onTextChange,
  onTextBlur,
  onRemoveNote,
  noteName,
}: Props) {
  const [editingFormula, setEditingFormula] = useState(false);
  const [refSelectorOpen, setRefSelectorOpen] = useState(false);
  const [propSelectorNote, setPropSelectorNote] = useState<NoteFile | null>(
    null
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const selectorOpenRef = useRef(false);
  const triggerCursorRef = useRef(0);
  // Suivi pour l'auto-pair $$ → transition automatique en mode édition
  const autoPairedRef = useRef(false);
  const wasFormulaRef = useRef(isFormula(value as string));

  // Quand une valeur texte devient une formule valide après auto-pair, entrer en mode édition
  useEffect(() => {
    const nowFormula = isFormula(value as string);
    if (!wasFormulaRef.current && nowFormula && autoPairedRef.current) {
      setEditingFormula(true);
      autoPairedRef.current = false;
    }
    wasFormulaRef.current = nowFormula;
  });

  const notesByName = useMemo(
    () => new Map(allNotes?.map((n) => [n.name, n.id]) ?? []),
    [allNotes]
  );

  function toRaw(displayed: string): string {
    return dehumanizeFormula(displayed, notesByName);
  }

  function toDisplay(raw: string): string {
    return noteResolver ? humanizeFormula(raw, noteResolver) : raw;
  }

  function openRefSelector(cursorPos: number) {
    triggerCursorRef.current = cursorPos;
    selectorOpenRef.current = true;
    setRefSelectorOpen(true);
    setPropSelectorNote(null);
  }

  function openPropSelector(note: NoteFile, cursorPos: number) {
    triggerCursorRef.current = cursorPos;
    selectorOpenRef.current = true;
    setPropSelectorNote(note);
    setRefSelectorOpen(false);
  }

  function closeSelectors() {
    selectorOpenRef.current = false;
    setRefSelectorOpen(false);
    setPropSelectorNote(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function resetSelectors() {
    // Ferme sans redonner le focus (l'input l'a déjà)
    selectorOpenRef.current = false;
    setRefSelectorOpen(false);
    setPropSelectorNote(null);
  }

  /** Vérifie les triggers sur le texte jusqu'au curseur. */
  function checkTriggers(displayed: string, cursorPos: number) {
    const toCursor = displayed.slice(0, cursorPos);

    if (toCursor.endsWith("ref(")) {
      openRefSelector(cursorPos);
      return;
    }

    const propMatch = REF_PROP_TRIGGER_RE.exec(toCursor);
    if (propMatch && allNotes) {
      const nameOrPath = propMatch[1];
      const note = allNotes.find(
        (n) => n.name === nameOrPath || n.id === nameOrPath
      );
      if (note) {
        openPropSelector(note, cursorPos);
        return;
      }
    }

    resetSelectors();
  }

  /** Insère du texte en remplaçant `charsToRemoveBefore` caractères avant le curseur. */
  function insertAtCursor(
    displayed: string,
    cursorPos: number,
    inserted: string,
    charsToRemoveBefore: number
  ): { newDisplayed: string; newCursor: number } {
    const before = displayed.slice(0, cursorPos - charsToRemoveBefore);
    const after = displayed.slice(cursorPos);
    return {
      newDisplayed: `${before}${inserted}${after}`,
      newCursor: before.length + inserted.length,
    };
  }

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
    const scrollable = fieldKey === SystemField.CHILDREN;
    return (
      <div
        className={`flex flex-wrap gap-1 flex-1 ${scrollable ? "max-h-[4.5rem] overflow-y-auto" : ""}`}
      >
        {paths.map((path) => (
          <NoteChip
            key={path}
            name={noteName(path)}
            noteId={path}
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
      formulaChildren,
      noteResolver
    );
    const isError = computed === "#ERREUR";

    if (editingFormula && !isValueLocked) {
      const displayValue = toDisplay(strValue);

      return (
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            // biome-ignore lint/a11y/noAutofocus: focus intentionnel à l'ouverture de l'édition formule
            autoFocus
            value={displayValue}
            onChange={(e) => {
              const displayed = e.target.value;
              const cursorPos = e.target.selectionStart ?? displayed.length;
              checkTriggers(displayed, cursorPos);
              onTextChange(toRaw(displayed));
            }}
            onBlur={() => {
              if (!selectorOpenRef.current) setEditingFormula(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (selectorOpenRef.current) closeSelectors();
                else setEditingFormula(false);
              }
              if (e.key === "Enter" && !selectorOpenRef.current)
                setEditingFormula(false);
            }}
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full mt-0.5 bg-transparent outline-none border-b border-gray-300 text-gray-600 focus:border-gray-300 transition-colors font-mono text-xs"
          />

          {refSelectorOpen && allNotes && (
            <NoteSelector
              notes={allNotes}
              onSelect={(note) => {
                const cursor = triggerCursorRef.current;
                const current = inputRef.current?.value ?? displayValue;
                const { newDisplayed, newCursor } = insertAtCursor(
                  current,
                  cursor,
                  `ref("${note.name}")`,
                  4 /* "ref(" */
                );
                onTextChange(toRaw(newDisplayed));
                closeSelectors();
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

          {propSelectorNote && (
            <PropertySelector
              options={getNoteProperties(propSelectorNote)}
              onSelect={(key) => {
                const cursor = triggerCursorRef.current;
                const current = inputRef.current?.value ?? displayValue;
                const { newDisplayed, newCursor } = insertAtCursor(
                  current,
                  cursor,
                  key,
                  0 /* après le "." déjà là */
                );
                onTextChange(toRaw(newDisplayed));
                closeSelectors();
                setTimeout(
                  () =>
                    inputRef.current?.setSelectionRange(newCursor, newCursor),
                  0
                );
              }}
              onClose={closeSelectors}
              anchorRef={inputRef}
            />
          )}
        </div>
      );
    }

    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
      <span
        className={`flex items-center gap-1 flex-1 mt-0.5 text-xs select-none ${
          isValueLocked ? "cursor-default" : "cursor-pointer"
        }`}
        title={
          isValueLocked
            ? toDisplay(strValue)
            : `${toDisplay(strValue)} — Cliquer pour éditer`
        }
        onClick={() => !isValueLocked && setEditingFormula(true)}
      >
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
    <div className="flex-1 relative">
      <input
        ref={inputRef}
        value={strValue}
        onChange={(e) => {
          if (isValueLocked) return;
          const newVal = e.target.value;
          const cursorPos = e.target.selectionStart ?? newVal.length;
          const toCursor = newVal.slice(0, cursorPos);
          const afterCursor = newVal.slice(cursorPos);

          // Auto-pair : $$ → $$|$$
          if (toCursor.endsWith("$$") && !afterCursor.startsWith("$$")) {
            autoPairedRef.current = true;
            const paired = `${toCursor}$$${afterCursor}`;
            onTextChange(paired);
            setTimeout(
              () => inputRef.current?.setSelectionRange(cursorPos, cursorPos),
              0
            );
            return;
          }

          if (toCursor.endsWith("ref(")) {
            triggerCursorRef.current = cursorPos;
            selectorOpenRef.current = true;
            setRefSelectorOpen(true);
          } else {
            resetSelectors();
          }
          onTextChange(newVal);
        }}
        onBlur={() => {
          if (!selectorOpenRef.current) onTextBlur();
        }}
        disabled={isValueLocked}
        placeholder={isValueLocked ? undefined : "valeur"}
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        className={`w-full mt-0.5 bg-transparent outline-none border-b border-transparent
                  ${isSystem ? "font-bold" : ""}
                  ${isValueLocked ? "text-gray-300 select-none" : "text-gray-600 focus:border-gray-300"}
                  transition-colors`}
      />
      {refSelectorOpen && allNotes && (
        <NoteSelector
          notes={allNotes}
          onSelect={(note) => {
            const cursor = triggerCursorRef.current;
            const current = inputRef.current?.value ?? strValue;
            const before = current.slice(0, cursor - 4);
            const after = current.slice(cursor);
            const inserted = `ref("${note.id}")`;
            onTextChange(`${before}${inserted}${after}`);
            closeSelectors();
            const newCursor = before.length + inserted.length;
            setTimeout(
              () => inputRef.current?.setSelectionRange(newCursor, newCursor),
              0
            );
          }}
          onClose={closeSelectors}
          anchorRef={inputRef}
          placeholder="Référencer une note..."
        />
      )}
    </div>
  );
}
