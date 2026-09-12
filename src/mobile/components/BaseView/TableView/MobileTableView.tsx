import { useSetAtom } from "jotai";
import type { NoteFile } from "../../../../shared/hooks/useFileTree";
import { useNote } from "../../../../shared/hooks/useNote";
import type { useTable } from "../../../../shared/hooks/useTable";
import { navigateToNoteAtom } from "../../../../shared/lib/atoms";
import { MobileTableFooter } from "./MobileTableFooter";
import { MobileTableRow } from "./MobileTableRow";

interface Props {
  /** État du tableau, remonté dans MobileBaseView qui rend aussi l'en-tête. */
  table: ReturnType<typeof useTable>;
  /** Recopie le scrollLeft des lignes vers l'en-tête (cf. MobileTableHeader). */
  onBodyScroll: (scrollLeft: number) => void;
}

export function MobileTableView({ table, onBodyScroll }: Props) {
  const { handleRename } = useNote();
  const navigateToNote = useSetAtom(navigateToNoteAtom);
  const { columns, childNotes, aggregations, setAggregation, editCell } = table;

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
    <div
      className="overflow-x-auto w-full scrollbar-none"
      onScroll={(e) => onBodyScroll(e.currentTarget.scrollLeft)}
    >
      <div className="w-max min-w-full">
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

        <MobileTableFooter
          columns={columns}
          childNotes={childNotes}
          aggregations={aggregations}
          onAggregationChange={setAggregation}
        />
      </div>
    </div>
  );
}
