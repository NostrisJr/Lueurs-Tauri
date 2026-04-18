import { useState, useEffect } from "react";
import { platform } from "@tauri-apps/plugin-os";
import { useAtomValue, useSetAtom } from "jotai";
import { activeNoteAtom, skipPropagationAtom } from "../../../shared/lib/Atoms";
import type { Frontmatter } from "../../../shared/hooks/useFileTree";
import {
  getAddableFields,
  getFieldDef,
  isFunctionalBaseField,
  NoteType,
} from "../../../shared/lib/noteTypes";
import { toFrontmatter, type Row } from "./lib/frontmatterUtils";
import {
  rowsAtom,
  editingKeyAtom,
  selectorOpenAtom,
} from "./lib/frontMatterAtoms";
import { FrontmatterRow } from "./FrontmatterRow";
import { AddPropertyDropdown } from "./AddPropertyDropdown";
import { ask } from "@tauri-apps/plugin-dialog";
import { useTemplateSync } from "../../hooks/useTemplateSync";
import { isSystemField } from "../../../shared/lib/fileTreeHelpers";

interface Props {
  onChange: (updated: Frontmatter) => void;
  defaultCollapsed?: boolean;
}

export function FrontmatterEditor({ onChange, defaultCollapsed = false }: Props) {
  const isMobile = platform() === "ios";
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const rows = useAtomValue(rowsAtom);
  const setRows = useSetAtom(rowsAtom);
  const setEditingKey = useSetAtom(editingKeyAtom);
  const setSelectorOpen = useSetAtom(selectorOpenAtom);
  const setSkipPropagation = useSetAtom(skipPropagationAtom);
  const activeNote = useAtomValue(activeNoteAtom);
  const { renameTemplateProperty, checkKanbanKeyUsage } = useTemplateSync();

  // Reset au changement de note — sinon l'état déplié persiste entre les notes
  useEffect(() => {
    if (defaultCollapsed) setCollapsed(true);
  }, [activeNote?.id, defaultCollapsed]);

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const noteType = (activeNote?.type as any) ?? null;
  const isTemplate = activeNote?.type === NoteType.TEMPLATE;

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
    <div className="border-b border-gray-100 bg-gray-50/50">
      {defaultCollapsed && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={`w-full flex items-center justify-between px-4 transition-colors text-gray-400 hover:text-gray-600 ${isMobile ? "py-3 text-sm" : "py-2 text-xs"}`}
        >
          <span>Propriétés</span>
          <span>{collapsed ? "▸" : "▾"}</span>
        </button>
      )}

      {!collapsed && (
        <div className="px-4 py-2 flex flex-col gap-1.5">
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
              />
            ))}
          <AddPropertyDropdown
            addableFields={addableFields}
            onAddSystem={addSystemRow}
            onAddUser={addUserRow}
          />
        </div>
      )}
    </div>
  );
}
