import clsx from "clsx";
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
import { isMobile } from "../../../shared/lib/platform";
import { useTemplateConstraints } from "../../hooks/useTemplateConstraints";
import { EnumOptionsFields } from "./EnumOptionsFields";
import { FolderSelector } from "./FolderSelector";
import { FrontmatterValue } from "./FrontmatterValue";
import { MobilePropertySheet } from "./MobilePropertySheet";
import { MobileRelationSheet } from "./MobileRelationSheet";
import { NoteSelector } from "./NoteSelector";
import { NumberFormatFields } from "./NumberFormatFields";
import { SpaceSelector } from "./SpaceSelector";
import {
  editingKeyAtom,
  rowsAtom,
  selectorOpenAtom,
} from "./lib/frontMatterAtoms";
import {
  type Row,
  SELECTOR_PLACEHOLDERS,
  hasFolderSelector,
  hasNoteSelector,
  hasSpaceSelector,
} from "./lib/frontmatterUtils";
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
  { value: "enum", label: "Bouton" },
];

export function FrontmatterRow({
  row,
  index,
  isTemplate,
  commit,
  onRenameTemplateKey,
  locked = false,
}: Props) {
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

  // Édition inline du nom de propriété (desktop uniquement — le mobile passe
  // par MobilePropertySheet, cf. rendu plus bas).
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
  // non verrouillées. Un héritier contraint par un ENUM (enumConstraint)
  // n'a rien à régler ici — choix et couleurs imposés par le template, valeur
  // choisie directement sur la ligne via EnumValueSelector (jamais ce panneau).
  const canConfigure =
    !locked && !row.isSystem && !isValueLocked && !enumConstraint;
  // Propriété de relation (choix parmi des notes/espaces/un dossier) : sur
  // mobile, tap sur la ligne ouvre MobileRelationSheet plutôt que le panneau
  // Texte/Nombre/Bouton — jamais renommable (clé système), cf. plus bas.
  const isRelationRow =
    hasNoteSelector(row.key) ||
    hasSpaceSelector(row.key) ||
    hasFolderSelector(row.key);
  const [relationSheetOpen, setRelationSheetOpen] = useState(false);

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
  // Texte/Nombre désactivés quand il impose un ENUM — cf.
  // useValueEditor.handleTypeChange. En pratique ce switcher n'est jamais
  // affiché pour un héritier ENUM (canConfigure l'exclut, cf. plus bas) ;
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
          o.value !== "enum"
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
  // useValueEditor. Desktop uniquement : sur mobile ce panneau est remplacé
  // par MobilePropertySheet (bottom sheet), cf. plus bas — un panneau qui se
  // déplie en place dans la grille est le genre de mécanisme identifié fragile
  // sous WebKit (cf. mémoire projet sur les quirks d'animation).
  const showTypePanel =
    !isMobile && editor.visible && !isValueLocked && !locked;
  const showDecimals = showTypePanel && editor.draft.type === "number";
  const showEnumOptions = showTypePanel && editor.draft.type === "enum";

  const { contentRef: switcherContentRef, height: switcherHeight } =
    useAnimatedHeight(showTypePanel);
  const { contentRef: decimalsContentRef, height: decimalsHeight } =
    useAnimatedHeight(showDecimals);
  const { contentRef: enumOptionsContentRef, height: enumOptionsHeight } =
    useAnimatedHeight(
      showEnumOptions,
      editor.draft.type === "enum" ? editor.draft.enumDef.options.length : 0
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
        ? { text: "Ce nom est déjà utilisé.", className: "text-danger-2" }
        : isTemplate && canSaveKey
          ? {
              text: "Sera propagé à toutes les notes héritières.",
              className: "text-accent",
            }
          : null
      : null;

  let rowCursor = 1;
  const switcherRow = showTypePanel ? rowCursor++ : null;
  const mainRow = rowCursor++;
  const decimalsRow = showDecimals ? rowCursor++ : null;
  const enumOptionsRow = showEnumOptions ? rowCursor++ : null;
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
      ref={panelRefSetter}
      className={clsx(
        "grid gap-x-2 gap-y-1 group transition duration-300 select-none",
        isMobile ? "text-sm min-h-10" : "text-xs min-h-5"
      )}
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
        {/* Suppression : sur mobile, ni icône ni espaceur — repliée dans le
            bouton "Supprimer" de MobilePropertySheet, cf. plus bas. */}
        {!isMobile &&
          (row.key !== SystemField.TYPE ? (
            <button
              type="button"
              onClick={canDelete ? removeRow : undefined}
              title={canDelete ? "Supprimer la propriété" : undefined}
              className={clsx(
                "shrink-0 mt-0.5 transition-all p-0 bg-transparent border-0 size-3",
                canDelete
                  ? "text-transparent hover:text-danger-2 group-hover:text-ink-5 cursor-pointer"
                  : "text-transparent cursor-default"
              )}
            >
              <IconXCircle className="size-full" />
            </button>
          ) : (
            <span className="shrink-0 mt-0.5 w-3" />
          ))}

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
            className={clsx(
              "shrink-0 mt-0.5 w-28 text-xs bg-transparent border-b outline-none",
              isKeyDuplicate
                ? "border-danger-2 text-danger"
                : "border-line-3 focus:border-ink-3"
            )}
          />
        ) : (
          // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
          <span
            className={clsx(
              "shrink-0 mt-0.5 truncate",
              isMobile ? "w-24 text-sm" : "w-28 text-xs",
              row.isSystem ? "font-bold text-ink-3 select-none" : "",
              !row.isSystem && canRename
                ? "text-ink-3 cursor-pointer hover:text-ink-2"
                : "",
              isKeyLocked && !isTemplate ? "text-accent/70 select-none" : ""
            )}
            onDoubleClick={() => !isMobile && canRename && startKeyEdit()}
            onClick={() => {
              if (!isMobile) return;
              if (isRelationRow) {
                if (!locked) setRelationSheetOpen(true);
                return;
              }
              if (canRename || canConfigure || canDelete) editor.open();
            }}
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

        {/* Réglages : sur mobile, ni icône ni espaceur — la ligne entière
            (tap sur le libellé) ouvre MobilePropertySheet, cf. plus bas. */}
        {!isMobile &&
          (canConfigure ? (
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
              className={clsx(
                "shrink-0 mt-0.5 transition-all p-0 bg-transparent border-0 cursor-pointer size-3",
                editor.visible
                  ? "text-ink-3"
                  : "text-transparent group-hover:text-ink-5 hover:text-ink-3"
              )}
            >
              <IconGearshape className="size-full" />
            </button>
          ) : (
            <span className="shrink-0 mt-0.5 w-3" />
          ))}

        <IconArrowRight
          // mt-1.5 (pas mt-0.5 comme les autres icônes) : le glyphe SF Symbol
          // "arrow.right" n'est pas centré verticalement dans son propre
          // viewBox comme xmark.circle/gearshape (métriques SF Symbols par
          // glyphe) — décalage compensé empiriquement ici.
          className={clsx(
            "shrink-0 mt-[0.3rem] text-ink-5 select-none",
            isMobile ? "size-4" : "size-3"
          )}
          aria-hidden="true"
        />

        {/* Sur mobile, ni bouton ni espaceur — MobileRelationSheet (tap sur le
            libellé de la clé) remplace ce déclencheur, cf. plus bas. */}
        {!isMobile &&
          (!locked &&
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
                className={clsx(
                  "p-0 bg-transparent border-0 transition-colors cursor-pointer size-3",
                  "text-ink-4",
                  "hover:text-accent"
                )}
              >
                <IconPlusCircle className="size-full" />
              </button>
            </span>
          ) : (
            <span className="shrink-0 mt-0.5 w-3" />
          ))}
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
          canOpenSheet={canRename || canConfigure || canDelete}
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

      {showEnumOptions && (
        <div
          className={nestedTransitionClass}
          style={{
            height: editor.mounted ? enumOptionsHeight : 0,
            gridRow: enumOptionsRow ?? undefined,
            gridColumn: 2,
          }}
        >
          <div ref={enumOptionsContentRef}>
            <EnumOptionsFields
              enumDef={editor.draft.enumDef}
              onChange={(next) =>
                editor.setDraft({ ...editor.draft, enumDef: next })
              }
            />
          </div>
        </div>
      )}

      {keyEditMessage && (
        <p
          className={clsx("text-[10px]", keyEditMessage.className)}
          style={{ gridRow: keyMessageRow ?? undefined, gridColumn: 2 }}
        >
          {keyEditMessage.text}
        </p>
      )}

      {isMobile && editor.expanded && (
        <MobilePropertySheet
          row={row}
          rows={rows}
          isTemplate={isTemplate}
          canRename={canRename}
          canConfigure={canConfigure}
          canDelete={canDelete}
          typeOptions={typeOptions}
          editor={editor}
          allNotes={allNotes}
          noteResolver={noteResolver}
          formulaVars={formulaVars}
          onRename={handleRename}
          onDelete={removeRow}
        />
      )}

      {!isMobile && isSelectorOpen && hasNoteSelector(row.key) && (
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

      {!isMobile && isSelectorOpen && hasSpaceSelector(row.key) && (
        <SpaceSelector
          currentSpaces={row.value as string[]}
          onSelect={(spaceName) => addNote(spaceName)}
          onClose={() => setSelectorOpen(null)}
          anchorRef={selectorAnchorRef}
        />
      )}

      {!isMobile && isSelectorOpen && hasFolderSelector(row.key) && (
        <FolderSelector
          onSelect={selectFolder}
          onClose={() => setSelectorOpen(null)}
          anchorRef={selectorAnchorRef}
        />
      )}

      {isMobile && relationSheetOpen && (
        <MobileRelationSheet
          row={row}
          canDelete={canDelete}
          noteName={noteName}
          getCandidates={getCandidates}
          addNote={addNote}
          removeNote={removeNote}
          selectFolder={selectFolder}
          onDelete={removeRow}
          onClose={() => setRelationSheetOpen(false)}
        />
      )}
    </div>
  );
}
