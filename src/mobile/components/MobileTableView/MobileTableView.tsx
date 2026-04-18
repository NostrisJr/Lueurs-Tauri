import { useSetAtom } from "jotai";
import { navigateToNoteAtom } from "../../../shared/lib/Atoms";
import type { NoteFile, Frontmatter } from "../../../shared/hooks/useFileTree";
import { useTable } from "../../../shared/hooks/useTable";
import { useNote } from "../../../shared/hooks/useNote";
import { MobileTableRow } from "./MobileTableRow";

const TITLE_WIDTH = 160;
const CELL_WIDTH = 140;

interface Props {
  base: NoteFile;
  onBaseChange: (frontmatter: Frontmatter) => void;
}

export function MobileTableView({ base, onBaseChange }: Props) {
  const { handleRename } = useNote();
  const navigateToNote = useSetAtom(navigateToNoteAtom);
  const { columns, childNotes, editCell } = useTable({ base, onBaseChange });

  async function renameNote(note: NoteFile, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === note.name) return;
    await handleRename(note.id, trimmed, false);
  }

  if (childNotes.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 px-4">
        <p className="text-sm text-gray-400 text-center">
          Aucune note dans cette base.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto w-full">
      <div className="inline-block min-w-full">
        {/* Header */}
        <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
          <div
            className="shrink-0 sticky left-0 z-20 bg-gray-50 px-3 py-2.5 border-r border-gray-200"
            style={{ width: TITLE_WIDTH }}
          >
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Titre
            </span>
          </div>
          {columns.map((col) => (
            <div
              key={col.key}
              className="shrink-0 px-3 py-2.5 border-r border-gray-200 last:border-none"
              style={{ width: CELL_WIDTH }}
            >
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate block">
                {col.key}
              </span>
            </div>
          ))}
        </div>

        {/* Rows */}
        {childNotes.map((note) => (
          <MobileTableRow
            key={note.id}
            note={note}
            columns={columns}
            onTitleCommit={renameNote}
            onCellCommit={(key, value) => editCell(note, key, value)}
            onNavigate={() => navigateToNote(note.id)}
          />
        ))}
      </div>
    </div>
  );
}
