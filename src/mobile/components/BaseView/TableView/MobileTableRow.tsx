import clsx from "clsx";
import { useAtomValue } from "jotai";
import { useMemo, useRef, useState } from "react";
import type { NoteFile } from "../../../../shared/hooks/useFileTree";
import type { useTable } from "../../../../shared/hooks/useTable";
import { notesByIdAtom } from "../../../../shared/lib/atoms";
import { MobileTableCell } from "./MobileTableCell";
import { TITLE_WIDTH } from "./constants";

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
  // Nécessaire pour l'autocomplétion ref() dans NumberCellSelector (cf. TableRow desktop)
  const allNotes = useMemo(() => [...notesById.values()], [notesById]);

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
    <div
      className={clsx(
        "flex border-b min-h-[48px] items-center",
        "border-line",
        "hover:bg-surface-2/50"
      )}
    >
      <div
        className={clsx(
          "shrink-0 sticky left-0 z-10 border-r flex items-center gap-1",
          "bg-surface border-line"
        )}
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
              className={clsx(
                "w-full bg-transparent outline-none font-medium",
                "text-ink"
              )}
            />
          ) : (
            <span
              className={clsx("text-sm font-medium truncate block", "text-ink")}
            >
              {note.name || <span className="text-ink-5">Sans titre</span>}
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
          className={clsx(
            "shrink-0 pr-2 transition-colors",
            "text-ink-5",
            "active:text-info"
          )}
          title="Ouvrir la note"
        >
          →
        </button>
      </div>

      {columns.map((col) => (
        <MobileTableCell
          key={col.key}
          fieldKey={col.key}
          value={(note.frontmatter[col.key] as string) ?? ""}
          isImposed={col.isImposed}
          enumConstraint={col.enumConstraint}
          numberFormatConstraint={col.numberFormatConstraint}
          frontmatter={note.frontmatter}
          noteResolver={noteResolver}
          allNotes={allNotes}
          onCommit={(val) => onCellCommit(col.key, val)}
        />
      ))}
    </div>
  );
}
