import clsx from "clsx";
import { useAtomValue } from "jotai";
import { useRef, useState } from "react";
import { EnumValueSelector } from "../../../shared/components/FrontmatterPicker/EnumValueSelector";
import type { NoteFile } from "../../../shared/hooks/useFileTree";
import {
  type EnumDef,
  parseEnum,
  serializeEnum,
} from "../../../shared/lib/FrontmatterPicker/enumProperty";
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
import { isMobile } from "../../../shared/lib/platform";
import { NoteChip } from "./NoteChip";
import { NoteSelector } from "./NoteSelector";
import { NumberExprField } from "./NumberExprField";
import { TypeSelector } from "./TypeSelector";
import { toPropertyOptions } from "./lib/frontmatterUtils";
import type { useValueEditor } from "./lib/useValueEditor";

interface Props {
  fieldKey: string;
  value: string | string[];
  isNoteArray: boolean;
  isSystem: boolean;
  isValueLocked: boolean;
  enumConstraint?: EnumDef;
  formulaVars?: Record<string, unknown>;
  formulaChildren?: NoteFile[];
  noteResolver?: (path: string) => NoteFile | undefined;
  allNotes?: NoteFile[];
  onTextChange: (value: string) => void;
  onTextBlur: () => void;
  onRemoveNote: (path: string) => void;
  noteName: (path: string) => string;
  /** État/logique du panneau (type, brouillon, ouverture) — possédé par FrontmatterRow. */
  editor: ReturnType<typeof useValueEditor>;
  /**
   * Mobile uniquement : la valeur texte simple n'est plus éditable en ligne
   * (cf. commentaire plus bas) — tap pour ouvrir MobilePropertySheet, mais
   * seulement s'il y a quelque chose à y faire (renommer/configurer/supprimer).
   */
  canOpenSheet?: boolean;
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
  editor,
  canOpenSheet,
}: Props) {
  const folderPath = useAtomValue(folderPathAtom);
  const allFolders = useAtomValue(allFoldersAtom);
  const vaultConfig = useAtomValue(vaultConfigAtom);
  const [refSelectorOpen, setRefSelectorOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectorOpenRef = useRef(false);
  const triggerCursorRef = useRef(0);

  const strValue = typeof value === "string" ? value : "";

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
          className="rounded accent-ink cursor-pointer"
        />
        <span className="text-ink-3 text-xs">
          {checked ? "Verrouillée" : "Déverrouillée"}
        </span>
      </label>
    );
  }

  // ── Contrainte ENUM (valeur choisie via dropdown) ───────────────────────
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

  // ── Propriété ENUM non contrainte (template définissant ou note normale) ─
  // Toujours le même pill + dropdown que pour un héritier contraint : le clic
  // choisit la valeur "courante" (= default) parmi les options — que le
  // panneau de réglages soit ouvert (options en cours d'édition, brouillon) ou
  // fermé (valeur committée). Éditer la LISTE d'options/couleurs passe
  // exclusivement par les réglages (roue crantée) — jamais par ce dropdown.
  const isEditingEnum = editor.visible && editor.draft.type === "enum";
  const committedEnumDef = isEditingEnum ? null : parseEnum(strValue);
  if (isEditingEnum || committedEnumDef) {
    const def = isEditingEnum ? editor.draft.enumDef : committedEnumDef;
    if (def) {
      return (
        <div className="flex-1 mt-0.5">
          <EnumValueSelector
            value={def.default}
            constraint={def}
            disabled={isValueLocked}
            onChange={(v) => {
              if (isEditingEnum) {
                editor.setDraft({
                  ...editor.draft,
                  enumDef: { ...def, default: v },
                });
              } else {
                onTextChange(serializeEnum({ ...def, default: v }));
                onTextBlur();
              }
            }}
          />
        </div>
      );
    }
  }

  // ── Dossier par défaut : choix unique via le sélecteur, jamais au clavier ──
  // Affiché comme un NoteChip même si c'est un dossier : clic → sa note
  // __folder__ (créée à la volée si besoin, cf. openFolderNote). Le chemin
  // absolu ne doit jamais être visible, seul le nom du dossier compte.
  if (fieldKey === SystemField.DEFAULT_FOLDER) {
    const path = value as string;
    if (!path) {
      return (
        <span
          className={clsx(
            "flex-1 mt-0.5 italic text-xs select-none",
            "text-ink-5"
          )}
        >
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
          hideRemoveButton={isMobile}
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
        className={clsx(
          "flex flex-wrap gap-1 flex-1 mt-0.5",
          scrollable ? "max-h-18 overflow-y-auto" : ""
        )}
      >
        {paths.map((path) =>
          isSpaceField ? (
            <NoteChip
              key={path}
              name={path}
              broken={!spaceNames.has(path)}
              readOnly={isValueLocked}
              hideRemoveButton={isMobile}
              onRemove={() => onRemoveNote(path)}
            />
          ) : (
            <NoteChip
              key={path}
              name={noteName(path)}
              noteId={path}
              readOnly={isValueLocked}
              hideRemoveButton={isMobile}
              onRemove={() => onRemoveNote(path)}
            />
          )
        )}
        {paths.length === 0 && (
          <span className={clsx("italic text-xs mt-0.5", "text-ink-5")}>
            {isSpaceField ? "aucun espace" : "aucune note"}
          </span>
        )}
      </div>
    );
  }

  // ── Champ déroulé (type/formule) ──────────────────────────────────────────
  // Le tab switcher et décimales/unité sont rendus par FrontmatterRow, au-dessus
  // et en dessous de la ligne icônes+champ : le champ ne bouge jamais de place
  // visuellement, qu'on soit déplié ou non (cf. useValueEditor). Desktop
  // uniquement : sur mobile, la VALEUR s'édite dans MobilePropertySheet (la
  // ligne peut se retrouver masquée sous cette sheet une fois ouverte), donc
  // cette branche n'est jamais atteinte — les branches suivantes (aperçu
  // formule compacte, texte) affichent déjà la frappe en cours grâce au
  // commit live de useValueEditor.
  if (!isMobile && editor.visible && !isValueLocked) {
    const inputClassName =
      "w-full mt-0.5 bg-transparent outline-none border-b border-line-3 text-ink-2 focus:border-line-3 transition-colors";

    const { draft } = editor;
    if (draft.type === "text") {
      return (
        <input
          type="text"
          value={draft.text}
          // biome-ignore lint/a11y/noAutofocus: ouverture intentionnelle du champ en édition
          autoFocus
          onChange={(e) => editor.setDraft({ ...draft, text: e.target.value })}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="valeur"
          style={isMobile ? { fontSize: 14 } : undefined}
          className={clsx("flex-1", inputClassName)}
        />
      );
    }

    return (
      <NumberExprField
        expr={draft.numberDef.expr}
        onChange={(expr) =>
          editor.setDraft({
            ...draft,
            numberDef: { ...draft.numberDef, expr },
          })
        }
        allNotes={allNotes ?? []}
        noteResolver={noteResolver ?? (() => undefined)}
        selfProperties={toPropertyOptions(
          Object.keys(formulaVars ?? {}),
          fieldKey
        )}
        inputClassName={`flex-1 ${inputClassName}`}
        autoFocus
        onFieldDone={editor.handleFieldDone}
      />
    );
  }

  // ── Propriété calculée (affichage compact) ────────────────────────────────
  if (isFormula(strValue)) {
    const computed = computeFormula(
      strValue,
      formulaVars ?? {},
      formulaChildren,
      noteResolver
    );
    const isError = isFormulaError(computed);

    // ENUM n'arrive jamais ici : intercepté plus haut (pill + dropdown),
    // qu'il soit committé ou en cours d'édition — cf. bloc ci-dessus.
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
      <span
        className={clsx(
          "flex items-baseline gap-1 flex-1 mt-0.5 text-xs select-none",
          isValueLocked ? "cursor-default" : "cursor-pointer"
        )}
        title={
          isValueLocked
            ? toDisplay(strValue)
            : `${toDisplay(strValue)} — Cliquer pour éditer`
        }
        onClick={() => !isValueLocked && editor.open()}
      >
        <span
          className={clsx("font-mono text-[10px] leading-none", "text-ink-5")}
        >
          ƒ
        </span>
        <span className={isError ? "text-danger-2" : "text-ink-2"}>
          {computed || "—"}
        </span>
      </span>
    );
  }

  // ── Valeur texte standard, mobile ─────────────────────────────────────────
  // Aperçu non interactif (pas d'input) : la saisie se fait dans
  // MobilePropertySheet, cf. commentaire sur la branche "champ déroulé" plus
  // haut — un input ici serait soit redondant avec la sheet quand elle est
  // ouverte, soit masqué sous elle et donc inatteignable au clavier virtuel
  // (zoom iOS en prime, en dessous de 16px).
  if (isMobile) {
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
      <span
        className={clsx(
          "flex-1 mt-0.5 truncate text-sm",
          isSystem ? "font-bold" : "",
          isValueLocked ? "text-ink-5" : strValue ? "text-ink-2" : "text-ink-5"
        )}
        onClick={() => canOpenSheet && !isValueLocked && editor.open()}
      >
        {strValue || "valeur"}
      </span>
    );
  }

  // ── Valeur texte standard, desktop ────────────────────────────────────────
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

          // Auto-pair : $$ → déroule le champ en place, préréglé sur Nombre
          // + formule vierge (au lieu de committer un "$$$$" transitoire dans
          // la valeur, ou d'entourer de $$ le texte déjà tapé).
          if (toCursor.endsWith("$$") && !afterCursor.startsWith("$$")) {
            editor.openFormulaEditor();
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
        className={clsx(
          "w-full mt-0.5 bg-transparent outline-none border-b border-transparent",
          isSystem ? "font-bold" : "",
          isValueLocked
            ? "text-ink-5 select-none"
            : "text-ink-2 focus:border-line-3",
          "transition-colors"
        )}
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
