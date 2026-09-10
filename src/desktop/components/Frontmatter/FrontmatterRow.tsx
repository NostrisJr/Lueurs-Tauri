import { platform } from "@tauri-apps/plugin-os";
import { useAtomValue, useSetAtom } from "jotai";
import { useMemo, useRef, useState } from "react";
import {
  IconArrowRight,
  IconGearshape,
  IconPlusCircle,
  IconXCircle,
} from "../../../shared/components/PlatformIcon";
import { SegmentedControl } from "../../../shared/components/SegmentedControl";
import { type NoteFile, useFileTree } from "../../../shared/hooks/useFileTree";
import { usePropertyRenamePropagation } from "../../../shared/hooks/usePropertyRenamePropagation";
import { activeNoteAtom, notesByIdAtom } from "../../../shared/lib/atoms";
import { toArray } from "../../../shared/lib/fileTreeHelpers";
import { computeFormula, isFormula } from "../../../shared/lib/formulas";
import {
  NoteType,
  SystemField,
  getFieldDef,
} from "../../../shared/lib/noteTypes";
import { useTemplateConstraints } from "../../hooks/useTemplateConstraints";
import { ButtonOptionsFields } from "./ButtonOptionsFields";
import { FolderSelector } from "./FolderSelector";
import { FrontmatterValue } from "./FrontmatterValue";
import { NoteSelector } from "./NoteSelector";
import { NumberFormatFields } from "./NumberFormatFields";
import { PropertyEditModal } from "./PropertyEditModal";
import { SpaceSelector } from "./SpaceSelector";
import {
  editingKeyAtom,
  rowsAtom,
  selectorOpenAtom,
} from "./lib/frontMatterAtoms";
import type { Row } from "./lib/frontmatterUtils";
import { useAnimatedHeight } from "./lib/useAnimatedHeight";
import { useScrollCompensation } from "./lib/useScrollCompensation";
import { type PropertyType, useValueEditor } from "./lib/useValueEditor";

interface Props {
  row: Row;
  index: number;
  isTemplate: boolean;
  commit: (rows: Row[]) => void;
  onRenameTemplateKey?: (oldKey: string, newKey: string) => void;
  /** Note verrouillée en lecture seule : bloque tout sauf la case __ReadOnly__ elle-même. */
  locked?: boolean;
}

const TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: "text", label: "Texte" },
  { value: "number", label: "Nombre" },
  { value: "button", label: "Bouton" },
];

const SELECTOR_PLACEHOLDERS: Partial<Record<string, string>> = {
  [SystemField.BASE]: "Rechercher une base...",
  [SystemField.TEMPLATE]: "Rechercher un template...",
};

function hasNoteSelector(key: string) {
  return (
    key === SystemField.BASE ||
    key === SystemField.CHILDREN ||
    key === SystemField.TEMPLATE
  );
}

function hasSpaceSelector(key: string) {
  return key === SystemField.SPACE;
}

function hasFolderSelector(key: string) {
  return key === SystemField.DEFAULT_FOLDER;
}

export function FrontmatterRow({
  row,
  index,
  isTemplate,
  commit,
  onRenameTemplateKey,
  locked = false,
}: Props) {
  const isMobile = platform() === "ios";
  const rowRef = useRef<HTMLDivElement>(null);
  const selectorAnchorRef = useRef<HTMLButtonElement>(null);
  const switcherWrapperRef = useRef<HTMLDivElement>(null);

  const rows = useAtomValue(rowsAtom);
  const { lockedKeys, lockedValues, enumConstraints, numberFormatConstraints } =
    useTemplateConstraints();
  const isKeyLocked = lockedKeys.has(row.key);
  const isValueLocked = lockedValues.has(row.key);
  const enumConstraint = enumConstraints.get(row.key);
  const numberFormatConstraint = numberFormatConstraints.get(row.key);

  const editingKey = useAtomValue(editingKeyAtom);
  const setEditingKey = useSetAtom(editingKeyAtom);
  const selectorOpen = useAtomValue(selectorOpenAtom);
  const setSelectorOpen = useSetAtom(selectorOpenAtom);

  const isEditing = editingKey === row.key;
  const isSelectorOpen = selectorOpen === row.key;

  // Édition inline du nom de propriété (desktop uniquement — le mobile garde
  // la modale PropertyEditModal, cf. rendu plus bas).
  const [keyDraft, setKeyDraft] = useState(row.key);
  const trimmedKeyDraft = keyDraft.trim();
  const isKeyUnchanged = trimmedKeyDraft === row.key;
  const isKeyDuplicate =
    !isKeyUnchanged && rows.some((r) => r.key === trimmedKeyDraft);
  const canSaveKey =
    trimmedKeyDraft !== "" && !isKeyUnchanged && !isKeyDuplicate;

  function startKeyEdit() {
    setKeyDraft(row.key);
    setEditingKey(row.key);
  }

  function commitKeyEdit() {
    if (canSaveKey) handleRename(row.key, trimmedKeyDraft);
    else setEditingKey(null);
  }

  const notesById = useAtomValue(notesByIdAtom);
  const allNotes = useMemo(() => [...notesById.values()], [notesById]);
  const activeNote = useAtomValue(activeNoteAtom);
  const { flushPendingWrite } = useFileTree();
  const { propagatePropertyRename } = usePropertyRenamePropagation();

  // Notes enfant de la base active — pour évaluer agg() dans les formules
  const formulaChildren: NoteFile[] | undefined =
    activeNote?.type === NoteType.BASE
      ? toArray(activeNote.frontmatter[SystemField.CHILDREN])
          .map((p) => notesById.get(p))
          .filter((n): n is NoteFile => !!n)
      : undefined;

  function noteName(path: string) {
    const note = notesById.get(path);
    return note
      ? note.name
      : (path.split("/").pop()?.replace(/\.md$/, "") ?? path);
  }

  function getCandidates() {
    const def = getFieldDef(row.key);
    if (!def || def.kind !== "noteArray") return [];

    let candidates = allNotes;

    if (def.noteFilter) {
      candidates = candidates.filter((n) =>
        def.noteFilter?.includes(n.type as any)
      );
    }

    // Exclure les dossiers du sélecteur d'enfants
    if (row.key === SystemField.CHILDREN) {
      const current = new Set(row.value as string[]);
      candidates = candidates.filter(
        (n) => n.type !== NoteType.FOLDER && !current.has(n.id)
      );
    }

    return candidates;
  }

  function updateText(value: string) {
    commit(rows.map((r, i) => (i === index ? { ...r, value } : r)));
  }

  function handleTextBlur() {
    // Flush immédiat : pour un template, déclenche onTemplateChange tout de
    // suite au lieu d'attendre les 1000ms du debounce.
    if (activeNote) flushPendingWrite(activeNote.id);
  }

  function removeRow() {
    commit(rows.filter((_, i) => i !== index));
  }

  function addNote(notePath: string) {
    const current = row.value as string[];
    if (current.includes(notePath)) return;
    commit(
      rows.map((r, i) =>
        i === index ? { ...r, value: [...current, notePath] } : r
      )
    );
    setSelectorOpen(null);
  }

  function selectFolder(absolutePath: string) {
    commit(
      rows.map((r, i) => (i === index ? { ...r, value: absolutePath } : r))
    );
    setSelectorOpen(null);
  }

  function removeNote(notePath: string) {
    const current = row.value as string[];
    commit(
      rows.map((r, i) =>
        i === index ? { ...r, value: current.filter((p) => p !== notePath) } : r
      )
    );
  }

  async function handleRename(oldKey: string, newKey: string) {
    setEditingKey(null);
    if (isTemplate && onRenameTemplateKey) {
      // Le template propage lui-même (Rust + formules), cf. useTemplateSync.
      onRenameTemplateKey(oldKey, newKey);
      return;
    }
    commit(rows.map((r) => (r.key === oldKey ? { ...r, key: newKey } : r)));
    if (!activeNote) return;
    // Vider le debounce avant de patcher : sinon l'écriture en attente (qui
    // porte l'ancien frontmatter figé) écrase les formules réécrites.
    await flushPendingWrite(activeNote.id);
    await propagatePropertyRename([activeNote.id], oldKey, newKey);
  }

  // Tout est supprimable sauf __Type__ et les props issues d'un template
  const canDelete = !locked && !(row.key === SystemField.TYPE) && !isKeyLocked;
  // Sur le template lui-même, les props sont toujours renommables.
  // Sur les enfants, isKeyLocked bloque le renommage.
  const canRename = !locked && !row.isSystem && (isTemplate || !isKeyLocked);
  // Réglages (type/décimales/unité/options Bouton) : propriétés personnalisées
  // non verrouillées. Un héritier contraint par un BUTTON (enumConstraint)
  // n'a rien à régler ici — choix et couleurs imposés par le template, valeur
  // choisie directement sur la ligne via EnumValueSelector (jamais ce panneau).
  const canConfigure =
    !locked && !row.isSystem && !isValueLocked && !enumConstraint;

  const noteResolver = (path: string) => notesById.get(path);

  const formulaVars = Object.fromEntries(
    rows.map((r) => {
      if (isFormula(r.value)) {
        return [
          r.key,
          computeFormula(
            r.value as string,
            Object.fromEntries(rows.map((r2) => [r2.key, r2.value])),
            formulaChildren,
            noteResolver
          ),
        ];
      }
      return [r.key, r.value];
    })
  );

  const strValue = typeof row.value === "string" ? row.value : "";
  const editor = useValueEditor(
    row.key,
    strValue,
    updateText,
    handleTextBlur,
    numberFormatConstraint,
    enumConstraint
  );

  // Texte/Bouton désactivés quand le template impose un format NUMBER, et
  // Texte/Nombre désactivés quand il impose un BUTTON — cf.
  // useValueEditor.handleTypeChange. En pratique ce switcher n'est jamais
  // affiché pour un héritier BUTTON (canConfigure l'exclut, cf. plus bas) ;
  // gardé par cohérence avec le cas NUMBER si ce panneau devait s'ouvrir.
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
    : enumConstraint
      ? TYPE_OPTIONS.map((o) =>
          o.value !== "button"
            ? {
                ...o,
                disabled: true,
                title:
                  "Options imposées par le template : doit rester un bouton",
              }
            : o
        )
      : TYPE_OPTIONS;

  // Tab switcher au-dessus / décimales+unité (ou options Bouton) en dessous
  // de la ligne icônes+champ (jamais dans la même cellule qu'elle) : le champ
  // ne bouge jamais de place à l'écran, qu'on soit déplié ou non — cf.
  // useValueEditor.
  const showTypePanel = editor.visible && !isValueLocked && !locked;
  const showDecimals = showTypePanel && editor.draft.type === "number";
  const showButtonOptions = showTypePanel && editor.draft.type === "button";

  const { contentRef: switcherContentRef, height: switcherHeight } =
    useAnimatedHeight(showTypePanel);
  const { contentRef: decimalsContentRef, height: decimalsHeight } =
    useAnimatedHeight(showDecimals);
  const { contentRef: buttonOptionsContentRef, height: buttonOptionsHeight } =
    useAnimatedHeight(
      showButtonOptions,
      editor.draft.type === "button" ? editor.draft.buttonDef.options.length : 0
    );

  // Le switcher grandit au-dessus de la ligne icônes+champ : sans ça le champ
  // (et la suite du frontmatter) est repoussé vers le bas à l'ouverture.
  // Déclenché par `editor.mounted` (pas `showTypePanel`) : c'est ce flag qui
  // pilote réellement la transition CSS (height, cf. useAnimatedHeight) dans
  // les deux sens — `showTypePanel`/`editor.visible` ne repasse à false qu'après
  // coup (CLOSE_TRANSITION_MS plus tard, une fois le repli déjà terminé), ce
  // qui démarrait la compensation de fermeture bien après le fait, en
  // aller-retour.
  useScrollCompensation(
    switcherWrapperRef,
    showTypePanel,
    switcherHeight,
    editor.mounted
  );

  const keyEditMessage =
    !isMobile && isEditing
      ? isKeyDuplicate
        ? { text: "Ce nom est déjà utilisé.", className: "text-red-400" }
        : isTemplate && canSaveKey
          ? {
              text: "Sera propagé à toutes les notes héritières.",
              className: "text-amber-500",
            }
          : null
      : null;

  let rowCursor = 1;
  const switcherRow = showTypePanel ? rowCursor++ : null;
  const mainRow = rowCursor++;
  const decimalsRow = showDecimals ? rowCursor++ : null;
  const buttonOptionsRow = showButtonOptions ? rowCursor++ : null;
  const keyMessageRow = keyEditMessage ? rowCursor++ : null;

  // Transition `height` (0 ↔ hauteur mesurée par useAnimatedHeight) plutôt que
  // grid-template-rows 0fr↔1fr : sous WebKit (webview Tauri), cette dernière
  // ne s'anime pas de façon fiable à l'ouverture (saute directement à la
  // taille finale) alors que la fermeture s'anime bien — une transition
  // `height` vers une valeur en px connue n'a pas ce problème, dans les deux
  // sens.
  const nestedTransitionClass =
    "overflow-hidden transition-[height] duration-200 ease-out";

  const { ref: panelRefSetter, ...containerHandlers } = editor.containerProps;

  return (
    <div
      ref={(node) => {
        rowRef.current = node;
        panelRefSetter.current = node;
      }}
      className={`grid gap-x-2 gap-y-1 group transition duration-300 select-none ${isMobile ? "text-sm min-h-10" : "text-xs min-h-5"}`}
      style={{ gridTemplateColumns: "auto 1fr" }}
      {...(showTypePanel ? containerHandlers : {})}
    >
      {showTypePanel && (
        <div
          ref={switcherWrapperRef}
          className={nestedTransitionClass}
          style={{
            height: editor.mounted ? switcherHeight : 0,
            gridRow: switcherRow ?? undefined,
            gridColumn: 2,
          }}
        >
          <div ref={switcherContentRef}>
            <SegmentedControl
              options={typeOptions}
              value={editor.draft.type}
              onChange={editor.handleTypeChange}
              variant="pill"
            />
          </div>
        </div>
      )}

      <div
        className="flex items-start gap-2"
        style={{ gridRow: mainRow, gridColumn: 1 }}
      >
        {row.key !== SystemField.TYPE ? (
          <button
            type="button"
            onClick={canDelete ? removeRow : undefined}
            title={canDelete ? "Supprimer la propriété" : undefined}
            className={`shrink-0 mt-0.5 transition-all p-0 bg-transparent border-0 ${isMobile ? "size-4" : "size-3"}
              ${
                canDelete
                  ? "text-transparent hover:text-red-400 group-hover:text-gray-300 cursor-pointer"
                  : "text-transparent cursor-default"
              }`}
          >
            <IconXCircle className="size-full" />
          </button>
        ) : (
          <span className={`shrink-0 mt-0.5 ${isMobile ? "w-4" : "w-3"}`} />
        )}

        {!isMobile && isEditing ? (
          <input
            // biome-ignore lint/a11y/noAutofocus: on ouvre l'édition inline directement en tapant, pas en cliquant deux fois
            autoFocus
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commitKeyEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setKeyDraft(row.key);
                setEditingKey(null);
              }
            }}
            className={`shrink-0 mt-0.5 w-28 text-xs bg-transparent border-b outline-none
              ${isKeyDuplicate ? "border-red-400 text-red-500" : "border-gray-300 focus:border-gray-500"}`}
          />
        ) : (
          // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
          <span
            className={`shrink-0 mt-0.5 truncate ${isMobile ? "w-24 text-sm" : "w-28 text-xs"}
              ${row.isSystem ? "font-bold text-gray-500 select-none" : ""}
              ${!row.isSystem && canRename ? "text-gray-500 cursor-pointer hover:text-gray-700" : ""}
              ${isKeyLocked && !isTemplate ? "text-amber-500/70 select-none" : ""}`}
            onDoubleClick={() => !isMobile && canRename && startKeyEdit()}
            onClick={() => isMobile && canRename && setEditingKey(row.key)}
            title={
              isKeyLocked && !isTemplate
                ? isValueLocked
                  ? "Propriété imposée par le template"
                  : "Propriété contraignante — valeur éditable"
                : undefined
            }
          >
            {row.key.replace(/^__|__$/g, "")}
          </span>
        )}

        {canConfigure ? (
          <button
            type="button"
            // Bascule déterministe (toggleOpen) : ferme immédiatement (avec
            // commit) si déjà ouvert, sinon ouvre — cf. commentaire dans
            // useValueEditor.toggleOpen sur la course avec le blur différé.
            onClick={editor.toggleOpen}
            // Empêche de voler le focus au champ actif du panneau (même
            // pattern que SegmentedControl) : sans ça, cliquer la roue blur
            // d'abord le champ, ce qui programme une fermeture différée qui
            // vient courser avec toggleOpen ci-dessus.
            onMouseDown={(e) => e.preventDefault()}
            title="Réglages de la propriété"
            className={`shrink-0 mt-0.5 transition-all p-0 bg-transparent border-0 cursor-pointer
              ${isMobile ? "size-4" : "size-3"}
              ${editor.visible ? "text-gray-500" : "text-transparent group-hover:text-gray-300 hover:text-gray-500"}`}
          >
            <IconGearshape className="size-full" />
          </button>
        ) : (
          <span className={`shrink-0 mt-0.5 ${isMobile ? "w-4" : "w-3"}`} />
        )}

        <IconArrowRight
          className={`shrink-0 mt-0.5 text-gray-300 select-none ${isMobile ? "size-4" : "size-3"}`}
          aria-hidden="true"
        />

        {!locked &&
        (hasNoteSelector(row.key) ||
          hasSpaceSelector(row.key) ||
          hasFolderSelector(row.key)) ? (
          <span ref={selectorAnchorRef} className="mt-0.5">
            <button
              type="button"
              title={
                hasSpaceSelector(row.key)
                  ? "Ajouter un espace"
                  : hasFolderSelector(row.key)
                    ? "Choisir un dossier"
                    : "Ajouter une note"
              }
              onClick={() => setSelectorOpen(isSelectorOpen ? null : row.key)}
              className={`p-0 bg-transparent border-0 text-gray-400 hover:text-amber-500 transition-colors cursor-pointer ${isMobile ? "size-4" : "size-3"}`}
            >
              <IconPlusCircle className="size-full" />
            </button>
          </span>
        ) : (
          <span className={`shrink-0 mt-0.5 ${isMobile ? "w-4" : "w-3"}`} />
        )}
      </div>

      <div
        className="flex items-start min-w-0"
        style={{ gridRow: mainRow, gridColumn: 2 }}
      >
        <FrontmatterValue
          fieldKey={row.key}
          value={row.value}
          isNoteArray={row.isNoteArray}
          isSystem={row.isSystem}
          isValueLocked={isValueLocked || locked}
          enumConstraint={enumConstraint}
          formulaVars={formulaVars}
          formulaChildren={formulaChildren}
          noteResolver={noteResolver}
          allNotes={allNotes}
          onTextChange={updateText}
          onTextBlur={handleTextBlur}
          onRemoveNote={removeNote}
          noteName={noteName}
          editor={editor}
        />
      </div>

      {showDecimals && (
        <div
          className={nestedTransitionClass}
          style={{
            height: editor.mounted ? decimalsHeight : 0,
            gridRow: decimalsRow ?? undefined,
            gridColumn: 2,
          }}
        >
          <div ref={decimalsContentRef}>
            <NumberFormatFields
              numberDef={editor.draft.numberDef}
              onChange={(next) =>
                editor.setDraft({ ...editor.draft, numberDef: next })
              }
              disabled={editor.numberFormatLocked}
            />
          </div>
        </div>
      )}

      {showButtonOptions && (
        <div
          className={nestedTransitionClass}
          style={{
            height: editor.mounted ? buttonOptionsHeight : 0,
            gridRow: buttonOptionsRow ?? undefined,
            gridColumn: 2,
          }}
        >
          <div ref={buttonOptionsContentRef}>
            <ButtonOptionsFields
              buttonDef={editor.draft.buttonDef}
              onChange={(next) =>
                editor.setDraft({ ...editor.draft, buttonDef: next })
              }
            />
          </div>
        </div>
      )}

      {keyEditMessage && (
        <p
          className={`text-[10px] ${keyEditMessage.className}`}
          style={{ gridRow: keyMessageRow ?? undefined, gridColumn: 2 }}
        >
          {keyEditMessage.text}
        </p>
      )}

      {isMobile && isEditing && (
        <PropertyEditModal
          propKey={row.key}
          isTemplate={isTemplate}
          existingKeys={rows.map((r) => r.key)}
          anchorRef={rowRef}
          onClose={() => setEditingKey(null)}
          onRename={handleRename}
        />
      )}

      {isSelectorOpen && hasNoteSelector(row.key) && (
        <NoteSelector
          notes={getCandidates()}
          onSelect={(note) => addNote(note.id)}
          onClose={() => setSelectorOpen(null)}
          anchorRef={selectorAnchorRef}
          placeholder={
            SELECTOR_PLACEHOLDERS[row.key] ?? "Rechercher une note..."
          }
        />
      )}

      {isSelectorOpen && hasSpaceSelector(row.key) && (
        <SpaceSelector
          currentSpaces={row.value as string[]}
          onSelect={(spaceName) => addNote(spaceName)}
          onClose={() => setSelectorOpen(null)}
          anchorRef={selectorAnchorRef}
        />
      )}

      {isSelectorOpen && hasFolderSelector(row.key) && (
        <FolderSelector
          onSelect={selectFolder}
          onClose={() => setSelectorOpen(null)}
          anchorRef={selectorAnchorRef}
        />
      )}
    </div>
  );
}
