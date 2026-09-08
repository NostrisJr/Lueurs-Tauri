import { platform } from "@tauri-apps/plugin-os";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { FormulaEditField } from "../../../shared/components/FormulaField/FormulaEditField";
import { ButtonOptionsEditor } from "../../../shared/components/FrontmatterPicker/ButtonOptionsEditor";
import { EnumValueSelector } from "../../../shared/components/FrontmatterPicker/EnumValueSelector";
import type { NoteFile } from "../../../shared/hooks/useFileTree";
import {
  type ButtonDef,
  isButtonFormula,
  parseButton,
} from "../../../shared/lib/FrontmatterPicker/buttonProperty";
import {
  allFoldersAtom,
  folderPathAtom,
  vaultConfigAtom,
} from "../../../shared/lib/atoms";
import {
  computeFormula,
  humanizeFormula,
  isFormula,
  isFormulaError,
} from "../../../shared/lib/formulas";
import { type NoteTypeValue, SystemField } from "../../../shared/lib/noteTypes";
import { NoteChip } from "./NoteChip";
import { NoteSelector } from "./NoteSelector";
import { TypeSelector } from "./TypeSelector";
import { toPropertyOptions } from "./lib/frontmatterUtils";

interface Props {
  fieldKey: string;
  value: string | string[];
  isNoteArray: boolean;
  isSystem: boolean;
  isValueLocked: boolean;
  enumConstraint?: ButtonDef;
  formulaVars?: Record<string, unknown>;
  formulaChildren?: NoteFile[];
  noteResolver?: (path: string) => NoteFile | undefined;
  allNotes?: NoteFile[];
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
  enumConstraint,
  formulaVars,
  formulaChildren,
  noteResolver,
  allNotes,
  onTextChange,
  onTextBlur,
  onRemoveNote,
  noteName,
}: Props) {
  const isMobile = platform() === "ios";
  const folderPath = useAtomValue(folderPathAtom);
  const allFolders = useAtomValue(allFoldersAtom);
  const vaultConfig = useAtomValue(vaultConfigAtom);
  const [editingFormula, setEditingFormula] = useState(false);
  // Brouillon local le temps de l'édition — même modèle que le popup inline.
  // Sans lui, chaque caractère tapé déclenche commit() : réécriture de toutes
  // les lignes, re-render de chacune et un computeFormula par formule (avec
  // agg() sur tous les enfants d'une base). Latence de saisie très visible.
  const [formulaDraft, setFormulaDraft] = useState<string | null>(null);
  const [refSelectorOpen, setRefSelectorOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectorOpenRef = useRef(false);
  const triggerCursorRef = useRef(0);

  // Filet du brouillon : les sorties d'édition normales (Entrée, Échap, clic
  // ailleurs) passent par onDone, mais un démontage direct — changement de note
  // au clavier, rechargement par le watcher — perdrait la saisie en cours.
  const draftRef = useRef<string | null>(null);
  draftRef.current = formulaDraft;
  const onTextChangeRef = useRef(onTextChange);
  onTextChangeRef.current = onTextChange;
  useEffect(
    () => () => {
      if (draftRef.current !== null) onTextChangeRef.current(draftRef.current);
    },
    []
  );

  function toDisplay(raw: string): string {
    return noteResolver ? humanizeFormula(raw, noteResolver) : raw;
  }

  function closeSelectors() {
    selectorOpenRef.current = false;
    setRefSelectorOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function resetSelectors() {
    // Ferme sans redonner le focus (l'input l'a déjà)
    selectorOpenRef.current = false;
    setRefSelectorOpen(false);
  }

  if (fieldKey === SystemField.TYPE) {
    return (
      <TypeSelector
        value={value as string}
        onChange={(type: NoteTypeValue) => onTextChange(type)}
      />
    );
  }

  if (fieldKey === SystemField.READ_ONLY) {
    const checked = (value as string) === "true";
    return (
      <label className="flex items-center gap-2 flex-1 mt-0.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => {
            // "" (plutôt que "false") : même convention que les autres champs
            // vidés dans ce panneau, cohérent avec toggleNoteReadOnly qui
            // retire la clé plutôt que d'y écrire une valeur explicite.
            onTextChange(checked ? "" : "true");
            onTextBlur();
          }}
          className="rounded accent-gray-800 cursor-pointer"
        />
        <span className="text-gray-500 text-xs">
          {checked ? "Verrouillée" : "Déverrouillée"}
        </span>
      </label>
    );
  }

  // ── Contrainte BUTTON (valeur choisie via dropdown) ───────────────────────
  if (enumConstraint) {
    return (
      <div className="flex-1 mt-0.5">
        <EnumValueSelector
          value={value as string}
          constraint={enumConstraint}
          onChange={(v) => {
            onTextChange(v);
            onTextBlur();
          }}
        />
      </div>
    );
  }

  // ── Dossier par défaut : choix unique via le sélecteur, jamais au clavier ──
  // Affiché comme un NoteChip même si c'est un dossier : clic → sa note
  // __folder__ (créée à la volée si besoin, cf. openFolderNote). Le chemin
  // absolu ne doit jamais être visible, seul le nom du dossier compte.
  if (fieldKey === SystemField.DEFAULT_FOLDER) {
    const path = value as string;
    if (!path) {
      return (
        <span className="flex-1 mt-0.5 text-gray-300 italic text-xs select-none">
          aucun dossier
        </span>
      );
    }
    const isRoot = !!folderPath && path === folderPath;
    const folderNode = isRoot
      ? undefined
      : allFolders.find((f) => f.id === path);
    return (
      <div className="flex-1 mt-0.5">
        <NoteChip
          name={
            isRoot ? "Racine du vault" : (folderNode?.name ?? noteName(path))
          }
          folderNode={folderNode}
          broken={!isRoot && !folderNode}
          openOnClick
          readOnly={isValueLocked}
          onRemove={() => {
            onTextChange("");
            onTextBlur();
          }}
        />
      </div>
    );
  }

  if (isNoteArray) {
    const paths = value as string[];
    const scrollable = fieldKey === SystemField.CHILDREN;
    const isSpaceField = fieldKey === SystemField.SPACE;
    const spaceNames = new Set((vaultConfig?.spaces ?? []).map((s) => s.name));
    return (
      <div
        className={`flex flex-wrap gap-1 flex-1 ${scrollable ? "max-h-18 overflow-y-auto" : ""}`}
      >
        {paths.map((path) =>
          isSpaceField ? (
            <NoteChip
              key={path}
              name={path}
              broken={!spaceNames.has(path)}
              readOnly={isValueLocked}
              onRemove={() => onRemoveNote(path)}
            />
          ) : (
            <NoteChip
              key={path}
              name={noteName(path)}
              noteId={path}
              readOnly={isValueLocked}
              onRemove={() => onRemoveNote(path)}
            />
          )
        )}
        {paths.length === 0 && (
          <span className="text-gray-300 italic text-xs mt-0.5">
            {isSpaceField ? "aucun espace" : "aucune note"}
          </span>
        )}
      </div>
    );
  }

  const strValue = value as string;

  // ── Propriété calculée ────────────────────────────────────────────────────
  // `editingFormula` est inclus dans la condition (pas seulement isFormula) :
  // pendant la frappe juste après l'auto-pair "$$", la valeur committée peut
  // transitoirement ne pas matcher isFormula (ex. "$$$$" vide) ; sans ce OR,
  // le composant retomberait sur l'input texte standard le temps d'un render.
  if (isFormula(strValue) || editingFormula) {
    if (editingFormula && !isValueLocked) {
      return (
        <FormulaEditField
          rawValue={formulaDraft ?? strValue}
          onChange={setFormulaDraft}
          onDone={() => {
            if (formulaDraft !== null && formulaDraft !== strValue) {
              onTextChange(formulaDraft);
            }
            setFormulaDraft(null);
            setEditingFormula(false);
          }}
          allNotes={allNotes ?? []}
          noteResolver={noteResolver ?? (() => undefined)}
          selfProperties={toPropertyOptions(
            Object.keys(formulaVars ?? {}),
            fieldKey
          )}
        />
      );
    }

    // Après la branche d'édition : inutile d'évaluer la formule à chaque frappe.
    const computed = computeFormula(
      strValue,
      formulaVars ?? {},
      formulaChildren,
      noteResolver
    );
    const isError = isFormulaError(computed);

    // Vue compactée d'un BUTTON : valeurs surlignées + dot pour rechoisir la couleur
    const buttonDef = isButtonFormula(strValue) ? parseButton(strValue) : null;
    if (buttonDef && !isValueLocked) {
      return (
        <ButtonOptionsEditor
          def={buttonDef}
          onChange={(formula) => {
            onTextChange(formula);
            onTextBlur();
          }}
          onEditRaw={() => setEditingFormula(true)}
        />
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

          // Auto-pair : $$ → $$|$$, bascule immédiate en édition de formule
          // (synchrone, pas via un effect) pour éviter tout render intermédiaire
          // où la valeur committée serait évaluée comme formule invalide.
          if (toCursor.endsWith("$$") && !afterCursor.startsWith("$$")) {
            const paired = `${toCursor}$$${afterCursor}`;
            onTextChange(paired);
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
        style={isMobile ? { fontSize: 14 } : undefined}
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
