import { useAtomValue, useSetAtom } from "jotai";
import { activeNoteAtom } from "../../lib/atoms";
import type { Frontmatter } from "../FileTree/useFileTree";
import { getAddableFields, getFieldDef, NoteType } from "../../lib/noteTypes";
import { toFrontmatter, type Row } from "./lib/frontmatterUtils";
import {
  rowsAtom,
  editingKeyAtom,
  selectorOpenAtom,
} from "./lib/frontMatterAtoms";
import { FrontmatterRow } from "./FrontmatterRow";
import { AddPropertyDropdown } from "./AddPropertyDropdown";

interface Props {
  onChange: (updated: Frontmatter) => void;
}

export function FrontmatterEditor({ onChange }: Props) {
  const rows = useAtomValue(rowsAtom);
  const setRows = useSetAtom(rowsAtom);
  const setEditingKey = useSetAtom(editingKeyAtom);
  const setSelectorOpen = useSetAtom(selectorOpenAtom);
  const activeNote = useAtomValue(activeNoteAtom);

  function commit(updatedRows: Row[]) {
    setRows(updatedRows);
    onChange(toFrontmatter(updatedRows));
  }

  function addUserRow() {
    const newKey = `propriété ${rows.length + 1}`;
    commit([
      ...rows,
      { key: newKey, value: "", isSystem: false, isNoteArray: false },
    ]);
    // Attendre le re-render pour que la ref de la ligne soit disponible
    setTimeout(() => setEditingKey(newKey), 0);
  }

  function addSystemRow(key: string) {
    if (rows.find((r) => r.key === key)) return;
    const def = getFieldDef(key);
    const isNoteArray = def?.kind === "noteArray";
    commit([
      ...rows,
      { key, value: isNoteArray ? [] : "", isSystem: true, isNoteArray },
    ]);
    if (isNoteArray) setSelectorOpen(key);
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const noteType = (activeNote?.type as any) ?? null;
  const isTemplate = activeNote?.type === NoteType.TEMPLATE;
  const addableFields = getAddableFields(
    noteType,
    rows.map((r) => r.key)
  );

  return (
    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-1.5">
      {rows.map((row, index) => (
        <FrontmatterRow
          key={row.key}
          row={row}
          index={index}
          isTemplate={isTemplate}
          commit={commit}
        />
      ))}
      <AddPropertyDropdown
        addableFields={addableFields}
        onAddSystem={addSystemRow}
        onAddUser={addUserRow}
      />
    </div>
  );
}
