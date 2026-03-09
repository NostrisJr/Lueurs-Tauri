import { useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { treeAtom } from "../../lib/atoms";
import { flattenTree } from "../FileTree/useFileTree";
import { getFieldDef, SystemField } from "../../lib/noteTypes";
import type { Row } from "./lib/frontmatterUtils";
import {
  rowsAtom,
  editingKeyAtom,
  selectorOpenAtom,
} from "./lib/frontMatterAtoms";
import { FrontmatterValue } from "./FrontmatterValue";
import { NoteSelector } from "./NoteSelector";
import { PropertyEditModal } from "./PropertyEditModal";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import {
  sfPlusCircle,
  sfXCircle,
  sfArrowRight,
} from "@bradleyhodges/sfsymbols";
import { constraintViolationsAtom } from "../../lib/atoms";

interface Props {
  row: Row;
  index: number;
  isTemplate: boolean;
  commit: (rows: Row[]) => void;
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

export function FrontmatterRow({ row, index, isTemplate, commit }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const selectorAnchorRef = useRef<HTMLButtonElement>(null);

  const rows = useAtomValue(rowsAtom);
  const constraintViolations = useAtomValue(constraintViolationsAtom);
  const isViolation = constraintViolations.includes(row.key);

  const editingKey = useAtomValue(editingKeyAtom);
  const setEditingKey = useSetAtom(editingKeyAtom);
  const selectorOpen = useAtomValue(selectorOpenAtom);
  const setSelectorOpen = useSetAtom(selectorOpenAtom);

  const isEditing = editingKey === row.key;
  const isSelectorOpen = selectorOpen === row.key;

  const allNotes = flattenTree(useAtomValue(treeAtom));

  function noteName(path: string) {
    const note = allNotes.find((n) => n.id === path);
    return note
      ? note.name
      : (path.split("/").pop()?.replace(/\.md$/, "") ?? path);
  }

  function getCandidates() {
    const def = getFieldDef(row.key);
    if (!def || def.kind !== "noteArray") return [];
    if (!def.noteFilter) return allNotes;
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    return allNotes.filter((n) => def.noteFilter?.includes(n.type as any));
  }

  function updateText(value: string) {
    commit(rows.map((r, i) => (i === index ? { ...r, value } : r)));
  }

  function removeRow() {
    if (row.isSystem) return;
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

  function renameKey(newKey: string) {
    setEditingKey(null);
    commit(rows.map((r) => (r.key === row.key ? { ...r, key: newKey } : r)));
  }

  return (
    <div
      ref={rowRef}
      className="flex items-center gap-2 text-xs min-h-5 group transition duration-300"
    >
      {row.key !== SystemField.TYPE ? (
        <SFIcon
          icon={sfXCircle}
          onClick={removeRow}
          className="size-3 text-transparent hover:text-red-400 group-hover:text-gray-300 transition-all cursor-pointer"
          title="Supprimer la propriété"
        />
      ) : (
        <span className="shrink-0 w-3" />
      )}

      <span
        className={`shrink-0 w-28 mt-0.5 truncate text-xs
          ${row.isSystem ? "font-bold text-gray-500" : "text-gray-400 cursor-pointer hover:text-gray-600"}`}
        onDoubleClick={() => setEditingKey(row.key)}
        title="Double-cliquer pour renommer"
      >
        {row.key.replace(/^__|__$/g, "")}
      </span>

      <SFIcon
        icon={sfArrowRight}
        className="size-3 text-gray-300"
        aria-hidden="true"
      />

      {hasNoteSelector(row.key) ? (
        <span ref={selectorAnchorRef}>
          <SFIcon
            icon={sfPlusCircle}
            className="size-3 text-gray-400 hover:text-amber-400 transition-colors cursor-pointer"
            title="Ajouter une note"
            onClick={() => setSelectorOpen(isSelectorOpen ? null : row.key)}
          />
        </span>
      ) : (
        <span className="shrink-0 w-3" />
      )}

      <FrontmatterValue
        value={row.value}
        isNoteArray={row.isNoteArray}
        isSystem={row.isSystem}
        isViolation={isViolation}
        onTextChange={updateText}
        onTextBlur={() => commit(rows)}
        onRemoveNote={removeNote}
        noteName={noteName}
      />

      {isEditing && (
        <PropertyEditModal
          propKey={row.key}
          isTemplate={isTemplate}
          anchorRef={rowRef}
          onClose={() => setEditingKey(null)}
          onRename={renameKey}
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
