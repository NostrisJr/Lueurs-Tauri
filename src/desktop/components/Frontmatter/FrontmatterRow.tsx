import {
  IconArrowRight,
  IconPlusCircle,
  IconXCircle,
} from "../../../shared/components/PlatformIcon";
import { platform } from "@tauri-apps/plugin-os";
import { useAtomValue, useSetAtom } from "jotai";
import { useRef } from "react";
import { flattenTree } from "../../../shared/hooks/useFileTree";
import type { NoteFile } from "../../../shared/hooks/useFileTree";
import { activeNoteAtom, treeAtom } from "../../../shared/lib/Atoms";
import { toArray } from "../../../shared/lib/fileTreeHelpers";
import { computeFormula, isFormula } from "../../../shared/lib/formulas";
import {
  NoteType,
  SystemField,
  getFieldDef,
} from "../../../shared/lib/noteTypes";
import { useTemplateConstraints } from "../../hooks/useTemplateConstraints";
import { FrontmatterValue } from "./FrontmatterValue";
import { NoteSelector } from "./NoteSelector";
import { PropertyEditModal } from "./PropertyEditModal";
import {
  editingKeyAtom,
  rowsAtom,
  selectorOpenAtom,
} from "./lib/frontMatterAtoms";
import type { Row } from "./lib/frontmatterUtils";

interface Props {
  row: Row;
  index: number;
  isTemplate: boolean;
  commit: (rows: Row[]) => void;
  onRenameTemplateKey?: (oldKey: string, newKey: string) => void;
}

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

export function FrontmatterRow({
  row,
  index,
  isTemplate,
  commit,
  onRenameTemplateKey,
}: Props) {
  const isMobile = platform() === "ios";
  const rowRef = useRef<HTMLDivElement>(null);
  const selectorAnchorRef = useRef<HTMLButtonElement>(null);

  const rows = useAtomValue(rowsAtom);
  const { lockedKeys, lockedValues } = useTemplateConstraints();
  const isKeyLocked = lockedKeys.has(row.key);
  const isValueLocked = lockedValues.has(row.key);

  const editingKey = useAtomValue(editingKeyAtom);
  const setEditingKey = useSetAtom(editingKeyAtom);
  const selectorOpen = useAtomValue(selectorOpenAtom);
  const setSelectorOpen = useSetAtom(selectorOpenAtom);

  const isEditing = editingKey === row.key;
  const isSelectorOpen = selectorOpen === row.key;

  const allNotes = flattenTree(useAtomValue(treeAtom));
  const activeNote = useAtomValue(activeNoteAtom);

  // Notes enfant de la base active — pour évaluer agg() dans les formules
  const formulaChildren: NoteFile[] | undefined =
    activeNote?.type === NoteType.BASE
      ? toArray(activeNote.frontmatter[SystemField.CHILDREN])
          .map((p) => allNotes.find((n) => n.id === p))
          .filter((n): n is NoteFile => !!n)
      : undefined;

  function noteName(path: string) {
    const note = allNotes.find((n) => n.id === path);
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

  function removeNote(notePath: string) {
    const current = row.value as string[];
    commit(
      rows.map((r, i) =>
        i === index ? { ...r, value: current.filter((p) => p !== notePath) } : r
      )
    );
  }

  function handleRename(oldKey: string, newKey: string) {
    setEditingKey(null);
    if (isTemplate && onRenameTemplateKey) {
      onRenameTemplateKey(oldKey, newKey);
    } else {
      commit(rows.map((r) => (r.key === oldKey ? { ...r, key: newKey } : r)));
    }
  }

  // Tout est supprimable sauf __Type__ et les props issues d'un template
  const canDelete = !(row.key === SystemField.TYPE) && !isKeyLocked;
  // Sur le template lui-même, les props sont toujours renommables.
  // Sur les enfants, isKeyLocked bloque le renommage.
  const canRename = !row.isSystem && (isTemplate || !isKeyLocked);

  const noteResolver = (path: string) => allNotes.find((n) => n.id === path);

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

  return (
    <div
      ref={rowRef}
      className={`flex items-center gap-2 group transition duration-300 select-none ${isMobile ? "text-sm min-h-10" : "text-xs min-h-5"}`}
    >
      {row.key !== SystemField.TYPE ? (
        <button
          type="button"
          onClick={canDelete ? removeRow : undefined}
          title={canDelete ? "Supprimer la propriété" : undefined}
          className={`shrink-0 transition-all p-0 bg-transparent border-0 ${isMobile ? "size-4" : "size-3"}
            ${
              canDelete
                ? "text-transparent hover:text-red-400 group-hover:text-gray-300 cursor-pointer"
                : "text-transparent cursor-default"
            }`}
        >
          <IconXCircle className="size-full" />
        </button>
      ) : (
        <span className={`shrink-0 ${isMobile ? "w-4" : "w-3"}`} />
      )}

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
      <span
        className={`shrink-0 mt-0.5 truncate ${isMobile ? "w-24 text-sm" : "w-28 text-xs"}
          ${row.isSystem ? "font-bold text-gray-500 select-none" : ""}
          ${!row.isSystem && canRename ? "text-gray-500 cursor-pointer hover:text-gray-700" : ""}
          ${isKeyLocked && !isTemplate ? "text-amber-500/70 select-none" : ""}`}
        onDoubleClick={() => !isMobile && canRename && setEditingKey(row.key)}
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

      <IconArrowRight
        className={`shrink-0 text-gray-300 select-none ${isMobile ? "size-4" : "size-3"}`}
        aria-hidden="true"
      />

      {hasNoteSelector(row.key) ? (
        <span ref={selectorAnchorRef}>
          <button
            type="button"
            title="Ajouter une note"
            onClick={() => setSelectorOpen(isSelectorOpen ? null : row.key)}
            className={`p-0 bg-transparent border-0 text-gray-400 hover:text-amber-500 transition-colors cursor-pointer ${isMobile ? "size-4" : "size-3"}`}
          >
            <IconPlusCircle className="size-full" />
          </button>
        </span>
      ) : (
        <span className={`shrink-0 ${isMobile ? "w-4" : "w-3"}`} />
      )}

      <FrontmatterValue
        fieldKey={row.key}
        value={row.value}
        isNoteArray={row.isNoteArray}
        isSystem={row.isSystem}
        isValueLocked={isValueLocked}
        formulaVars={formulaVars}
        formulaChildren={formulaChildren}
        noteResolver={noteResolver}
        allNotes={allNotes}
        onTextChange={updateText}
        onTextBlur={() => commit(rows)}
        onRemoveNote={removeNote}
        noteName={noteName}
      />

      {isEditing && (
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
    </div>
  );
}
