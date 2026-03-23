import { useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { treeAtom } from "../../lib/atoms";
import { flattenTree } from "../FileTree/hooks/useFileTree";
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
import { useTemplateConstraints } from "../../hooks/useTemplateConstraints";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import {
  sfPlusCircle,
  sfXCircle,
  sfArrowRight,
} from "@bradleyhodges/sfsymbols";

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

  return (
    <div
      ref={rowRef}
      className="flex items-center gap-2 text-xs min-h-5 group transition duration-300"
    >
      {row.key !== SystemField.TYPE ? (
        <SFIcon
          icon={sfXCircle}
          onClick={canDelete ? removeRow : undefined}
          className={`size-3 transition-all
            ${
              canDelete
                ? "text-transparent hover:text-red-400 group-hover:text-gray-300 cursor-pointer"
                : "text-transparent cursor-default"
            }`}
          title={canDelete ? "Supprimer la propriété" : undefined}
        />
      ) : (
        <span className="shrink-0 w-3" />
      )}

      <span
        className={`shrink-0 w-28 mt-0.5 truncate text-xs
          ${row.isSystem ? "font-bold text-gray-500 select-none" : ""}
          ${!row.isSystem && canRename ? "text-gray-500 cursor-pointer hover:text-gray-700" : ""}
          ${isKeyLocked && !isTemplate ? "text-amber-500/70 select-none" : ""}`}
        onDoubleClick={() => canRename && setEditingKey(row.key)}
        title={
          isKeyLocked && !isTemplate
            ? isValueLocked
              ? "Propriété imposée par le template"
              : "Propriété contraignante — valeur éditable"
            : "Double-cliquer pour renommer"
        }
      >
        {row.key.replace(/^__|__$/g, "")}
      </span>

      <SFIcon
        icon={sfArrowRight}
        className="size-3 text-gray-300 select-none"
        aria-hidden="true"
      />

      {hasNoteSelector(row.key) ? (
        <span ref={selectorAnchorRef}>
          <SFIcon
            icon={sfPlusCircle}
            className="size-3 text-gray-400 hover:text-amber-500 transition-colors cursor-pointer"
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
        isValueLocked={isValueLocked}
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
