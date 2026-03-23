import { useRef, useState } from "react";
import type { NoteFile } from "../../FileTree/hooks/useFileTree";
import type { TableColumn } from "../hooks/useTable";
import { TableCell } from "./TableCell";

interface Props {
  note: NoteFile;
  columns: TableColumn[];
  titleColWidth: number;
  onCellCommit: (note: NoteFile, key: string, value: string) => void;
  onTitleCommit: (note: NoteFile, newName: string) => void;
}

export function TableRow({
  note,
  columns,
  titleColWidth,
  onCellCommit,
  onTitleCommit,
}: Props) {
  const [titleDraft, setTitleDraft] = useState(note.name);
  const [editingTitle, setEditingTitle] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  function startTitleEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setTitleDraft(note.name);
    setEditingTitle(true);
    setTimeout(() => titleRef.current?.select(), 0);
  }

  function commitTitle() {
    setEditingTitle(false);
    onTitleCommit(note, titleDraft);
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitTitle();
    if (e.key === "Escape") {
      setTitleDraft(note.name);
      setEditingTitle(false);
    }
  }

  return (
    <div className="flex items-center border-b border-gray-100 hover:bg-gray-50/50 transition-colors group">
      {/* Colonne titre */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: édition inline */}
      <div
        style={{ width: titleColWidth }}
        className="shrink-0 border-r border-gray-100 px-3 py-1.5"
        onDoubleClick={startTitleEdit}
        onClick={(e) => e.stopPropagation()}
      >
        {editingTitle ? (
          <input
            ref={titleRef}
            // biome-ignore lint/a11y/noAutofocus: focus intentionnel à l'ouverture de l'édition
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={handleTitleKeyDown}
            className="w-full text-xs bg-transparent outline-none text-gray-700 font-body"
          />
        ) : (
          <span className="text-xs text-gray-700 truncate block font-body">
            {note.name || <span className="text-gray-300">Sans titre</span>}
          </span>
        )}
      </div>

      {/* Colonnes propriétés */}
      {columns.map((col) => (
        <TableCell
          key={col.key}
          value={(note.frontmatter[col.key] as string) ?? ""}
          isImposed={col.isImposed}
          width={col.width}
          onCommit={(val) => onCellCommit(note, col.key, val)}
        />
      ))}
    </div>
  );
}
