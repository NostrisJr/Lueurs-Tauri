import { ask } from "@tauri-apps/plugin-dialog";
import { useAtomValue, useSetAtom } from "jotai";
import type { Frontmatter } from "../../../shared/hooks/useFileTree";
import { activeNoteAtom, skipPropagationAtom } from "../../../shared/lib/atoms";
import { isSystemField } from "../../../shared/lib/fileTreeHelpers";
import {
  NoteType,
  type NoteTypeValue,
  SystemField,
  getAddableFields,
  getFieldDef,
  isFunctionalBaseField,
  isNoteReadOnly,
} from "../../../shared/lib/noteTypes";
import { isMobile } from "../../../shared/lib/platform";
import { useTemplateSync } from "../../hooks/useTemplateSync";
import { AddPropertyDropdown } from "./AddPropertyDropdown";
import { FrontmatterRow } from "./FrontmatterRow";
import {
  editingKeyAtom,
  rowsAtom,
  selectorOpenAtom,
} from "./lib/frontMatterAtoms";
import { type Row, toFrontmatter } from "./lib/frontmatterUtils";

interface Props {
  onChange: (updated: Frontmatter) => void;
  /** Contrôlé par le parent (mobile : chevron du titre) — toujours déplié si absent (desktop). */
  collapsed?: boolean;
}

export function FrontmatterEditor({ onChange, collapsed = false }: Props) {
  const rows = useAtomValue(rowsAtom);
  const setRows = useSetAtom(rowsAtom);
  const setEditingKey = useSetAtom(editingKeyAtom);
  const setSelectorOpen = useSetAtom(selectorOpenAtom);
  const setSkipPropagation = useSetAtom(skipPropagationAtom);
  const activeNote = useAtomValue(activeNoteAtom);
  const { renameTemplateProperty, checkKanbanKeyUsage } = useTemplateSync();

  const noteType = (activeNote?.type as NoteTypeValue | null) ?? null;
  const isTemplate = activeNote?.type === NoteType.TEMPLATE;
  const readOnly = isNoteReadOnly(activeNote?.frontmatter);

  async function commit(updatedRows: Row[]) {
    if (isTemplate && activeNote) {
      const prevKeys = rows
        .filter((r) => !isSystemField(r.key))
        .map((r) => r.key);
      const nextKeys = updatedRows
        .filter((r) => !isSystemField(r.key))
        .map((r) => r.key);
      const removed = prevKeys.filter((k) => !nextKeys.includes(k));
      const skipKeys = new Set<string>();

      for (const key of removed) {
        // Garde KanbanKey — annule tout si l'utilisateur refuse de supprimer le Kanban
        const kanbanOk = await checkKanbanKeyUsage(activeNote.id, key);
        if (!kanbanOk) return;

        const propagate = await ask(
          `Supprimer la propriété "${key}" de toutes les notes utilisant ce template ?`,
          { title: "Propagation du template", kind: "warning" }
        );
        if (!propagate) skipKeys.add(key);
      }

      // Renseigner l'atom avant onChange — onTemplateChange le lira au moment de la propagation
      if (skipKeys.size > 0) setSkipPropagation(skipKeys);
    }

    setRows(updatedRows);
    onChange(toFrontmatter(updatedRows));
  }

  async function handleRenameTemplateKey(oldKey: string, newKey: string) {
    if (!activeNote) return;
    await renameTemplateProperty(activeNote.id, oldKey, newKey);
  }

  function addUserRow() {
    const newKey = `propriété ${rows.length + 1}`;
    commit([
      ...rows,
      { key: newKey, value: "", isSystem: false, isNoteArray: false },
    ]);
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

  const addableFields = getAddableFields(
    noteType,
    rows.map((r) => r.key)
  );

  return (
    <div
      className={
        isMobile
          ? "border-b border-gray-100"
          : "border-b border-gray-100 bg-gray-50/50"
      }
    >
      {!collapsed && (
        <div
          className={`px-4 flex flex-col gap-1.5 ${isMobile ? "pt-0.5 pb-3" : "py-2"}`}
        >
          {rows
            .map((row, realIndex) => ({ row, realIndex }))
            .filter(({ row }) => !isFunctionalBaseField(row.key))
            .map(({ row, realIndex }) => (
              <FrontmatterRow
                key={row.key}
                row={row}
                index={realIndex}
                isTemplate={isTemplate}
                commit={commit}
                onRenameTemplateKey={
                  isTemplate ? handleRenameTemplateKey : undefined
                }
                locked={readOnly && row.key !== SystemField.READ_ONLY}
              />
            ))}
          {!readOnly && (
            <AddPropertyDropdown
              addableFields={addableFields}
              onAddSystem={addSystemRow}
              onAddUser={addUserRow}
            />
          )}
        </div>
      )}
    </div>
  );
}
