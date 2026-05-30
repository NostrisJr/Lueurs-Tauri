import { useAtomValue } from "jotai";
import { useRef, useState } from "react";
import type { NoteFile } from "../../../../shared/hooks/useFileTree";
import type { useTable } from "../../../../shared/hooks/useTable";
import { notesByIdAtom } from "../../../../shared/lib/atoms";
import { MobileTableCell } from "./MobileTableCell";

const TITLE_WIDTH = 160;

interface Props {
  note: NoteFile;
  columns: ReturnType<typeof useTable>["columns"];
  onTitleCommit: (note: NoteFile, newName: string) => void;
  onCellCommit: (key: string, value: string) => void;
  onNavigate: () => void;
}

export function MobileTableRow({
  note,
  columns,
  onTitleCommit,
  onCellCommit,
  onNavigate,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(note.name);
  const titleRef = useRef<HTMLInputElement>(null);
  const notesById = useAtomValue(notesByIdAtom);
  const noteResolver = (path: string) => notesById.get(path);

  function startTitleEdit() {
    setTitleDraft(note.name);
    setEditingTitle(true);
    setTimeout(() => {
      titleRef.current?.select();
    }, 0);
  }

  function commitTitle() {
    setEditingTitle(false);
    onTitleCommit(note, titleDraft);
  }

  return (
    <div className="flex border-b border-gray-100 hover:bg-gray-50/50 min-h-[48px] items-center">
      <div
        className="shrink-0 sticky left-0 z-10 bg-white border-r border-gray-100 flex items-center gap-1"
        style={{ width: TITLE_WIDTH }}
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: édition inline */}
        <div className="flex-1 px-3 py-2 min-w-0" onClick={startTitleEdit}>
          {editingTitle ? (
            <input
              ref={titleRef}
              // biome-ignore lint/a11y/noAutofocus: focus intentionnel
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  setTitleDraft(note.name);
                  setEditingTitle(false);
                }
              }}
              style={{ fontSize: 16 }}
              className="w-full bg-transparent outline-none text-gray-800 font-medium"
            />
          ) : (
            <span className="text-sm font-medium text-gray-800 truncate block">
              {note.name || <span className="text-gray-300">Sans titre</span>}
            </span>
          )}
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate();
          }}
          className="shrink-0 pr-2 text-gray-300 active:text-blue-500 transition-colors"
          title="Ouvrir la note"
        >
          →
        </button>
      </div>

      {columns.map((col) => (
        <MobileTableCell
          key={col.key}
          value={(note.frontmatter[col.key] as string) ?? ""}
          isImposed={col.isImposed}
          enumConstraint={col.enumConstraint}
          frontmatter={note.frontmatter}
          noteResolver={noteResolver}
          onCommit={(val) => onCellCommit(col.key, val)}
        />
      ))}
    </div>
  );
}
