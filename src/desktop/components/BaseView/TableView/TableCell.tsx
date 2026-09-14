import clsx from "clsx";
import { useCallback, useRef, useState } from "react";
import { FormulaEditField } from "../../../../shared/components/FormulaField/FormulaEditField";
import { EnumValueSelector } from "../../../../shared/components/FrontmatterPicker/EnumValueSelector";
import { NumberCellSelector } from "../../../../shared/components/FrontmatterPicker/NumberCellSelector";
import { PropertyCellSettingsPopup } from "../../../../shared/components/FrontmatterPicker/PropertyCellSettingsPopup";
import { usePropertyCellSettings } from "../../../../shared/components/FrontmatterPicker/usePropertyCellSettings";
import type {
  Frontmatter,
  NoteFile,
} from "../../../../shared/hooks/useFileTree";
import {
  type EnumDef,
  parseEnum,
  serializeEnum,
} from "../../../../shared/lib/FrontmatterPicker/enumProperty";
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
  const [refSelectorOpen, setRefSelectorOpen] = useState(false);
  // Réglages Texte/Nombre/Bouton — instancié UNE fois pour toute la cellule
  // (partagé par NumberCellSelector et PropertyCellSettingsPopup ci-dessous,
  // seul l'un des deux est monté à la fois selon la branche courante).
  const cellSettings = usePropertyCellSettings(
    value,
    onCommit,
    numberFormatConstraint
  );
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
    setEditing(true);
  }

  function commit(rawValue: string) {
    setEditing(false);
    resetSelectors();
    onCommit(rawValue);
  }

  function cancel() {
    setDraft(value);
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
        className={clsx(
          "shrink-0 border-r px-3 flex items-center last:border-none",
          "border-line"
        )}
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
        className={clsx(
          "shrink-0 border-r px-3 flex items-center last:border-none",
          "border-line"
        )}
      >
        <NumberCellSelector
          fieldKey={fieldKey}
          value={value}
          numberFormatConstraint={numberFormatConstraint}
          frontmatter={frontmatter}
          noteResolver={noteResolver ?? (() => undefined)}
          allNotes={allNotes ?? []}
          settings={cellSettings}
        />
      </div>
    );
  }

  // ── Propriété ENUM non contrainte (définie directement sur la note, sans
  // template) : même pill + dropdown, plutôt que le texte brut de la formule.
  const committedEnumDef = !isImposed ? parseEnum(value) : null;
  if (committedEnumDef) {
    // Réglages ouverts en Bouton : le pill lit/écrit le brouillon en cours
    // plutôt que de committer directement — sinon un clic sur le pill pendant
    // que le popup de réglages est ouvert écrirait la nouvelle valeur, puis la
    // fermeture du popup écraserait ce choix avec son brouillon désormais
    // périmé (même risque que celui corrigé plus haut, via un autre chemin).
    const openEnumDraft =
      cellSettings.open && cellSettings.draft?.type === "enum"
        ? cellSettings.draft
        : null;
    const activeEnumDef = openEnumDraft?.enumDef ?? committedEnumDef;
    return (
      <div
        style={{ width }}
        className={clsx(
          "shrink-0 border-r px-3 flex items-center relative group last:border-none",
          "border-line"
        )}
      >
        <EnumValueSelector
          value={activeEnumDef.default}
          constraint={activeEnumDef}
          onChange={(v) => {
            if (openEnumDraft) {
              cellSettings.setDraft({
                ...openEnumDraft,
                enumDef: { ...activeEnumDef, default: v },
              });
            } else {
              onCommit(serializeEnum({ ...committedEnumDef, default: v }));
            }
          }}
        />
        <PropertyCellSettingsPopup
          settings={cellSettings}
          fieldKey={fieldKey}
          frontmatter={frontmatter}
          noteResolver={noteResolver ?? (() => undefined)}
          allNotes={allNotes ?? []}
        />
      </div>
    );
  }

  return (
    <div
      style={{ width }}
      className={clsx(
        "shrink-0 border-r border-line px-3 text-xs last:border-none relative flex items-center min-h-8",
        !isImposed ? "group" : "",
        isImposed
          ? "cursor-default text-ink-5"
          : value
            ? "text-ink-2 cursor-text"
            : "text-ink-5 cursor-text"
      )}
      onDoubleClick={startEdit}
    >
      {editing ? (
        isFormula(draft) ? (
          <div className="relative w-full min-w-0">
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
              inputClassName="w-full bg-transparent outline-none text-ink-2 font-mono rounded px-1 -mx-1"
            />
          </div>
        ) : (
          <div className="relative w-full min-w-0">
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

                // Auto-pair : $$ → ouvre les réglages Texte/Nombre/Bouton
                // (roue crantée) plutôt que de basculer directement en
                // édition de formule brute — même mécanique que
                // useValueEditor.openFormulaEditor côté frontmatter panel.
                if (toCursor.endsWith("$$") && !afterCursor.startsWith("$$")) {
                  setEditing(false);
                  cellSettings.openAsFormula();
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
              className={clsx(
                "w-full bg-transparent outline-none font-body rounded px-1 -mx-1",
                "text-ink-2"
              )}
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
          className="flex items-baseline gap-1 min-w-0 truncate"
          title={toDisplay(value)}
        >
          <span
            className={clsx(
              "font-mono text-[10px] leading-none shrink-0",
              "text-ink-5"
            )}
          >
            ƒ
          </span>
          <span
            className={clsx(
              "truncate",
              isError ? "text-danger-2" : "text-ink-2"
            )}
          >
            {displayValue || "—"}
          </span>
        </span>
      ) : (
        <span className="truncate block w-full">{value || "—"}</span>
      )}
      {!isImposed && !editing && (
        <PropertyCellSettingsPopup
          settings={cellSettings}
          fieldKey={fieldKey}
          frontmatter={frontmatter}
          noteResolver={noteResolver ?? (() => undefined)}
          allNotes={allNotes ?? []}
        />
      )}
    </div>
  );
}
