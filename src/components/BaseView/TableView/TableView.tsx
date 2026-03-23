import { useNote } from "../../../hooks/useNote";
import { useTemplateSync } from "../../../hooks/useTemplateSync";
import type { NoteFile } from "../../FileTree/hooks/useFileTree";
import type { Frontmatter } from "../../FileTree/hooks/useFileTree";
import { useTable } from "../hooks/useTable";
import { TableHeader } from "./TableHeader";
import { TableRow } from "./TableRow";
import { createLogger } from "../../../lib/logger";

const log = createLogger("TableView");

interface Props {
  base: NoteFile;
  onBaseChange: (frontmatter: Frontmatter) => void;
}

export function TableView({ base, onBaseChange }: Props) {
  const { handleRename } = useNote();
  const { renameTemplateProperty } = useTemplateSync();

  const {
    columns,
    childNotes,
    titleColWidth,
    onResizeStart,
    onResizeMove,
    onResizeEnd,
    editCell,
  } = useTable({ base, onBaseChange });

  async function renameNote(note: NoteFile, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === note.name) return;
    await handleRename(note.id, trimmed, false);
  }

  async function handleRenameColumn(
    oldKey: string,
    newKey: string,
    templatePaths: string[]
  ) {
    log.info("renommage colonne tableau", { oldKey, newKey, templatePaths });
    // Propager le renommage dans tous les templates qui définissent cette propriété
    for (const templateId of templatePaths) {
      await renameTemplateProperty(templateId, oldKey, newKey);
    }
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      onPointerMove={onResizeMove}
      onPointerUp={onResizeEnd}
    >
      <div className="flex-1 overflow-auto px-4">
        <div className="inline-block min-w-full">
          <TableHeader
            columns={columns}
            titleColWidth={titleColWidth}
            existingKeys={columns.map((c) => c.key)}
            onResizeStart={onResizeStart}
            onRenameColumn={handleRenameColumn}
          />

          {childNotes.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="font-body text-sm text-gray-400">
                Aucune note dans cette base.
              </p>
            </div>
          ) : (
            childNotes.map((note) => (
              <TableRow
                key={note.id}
                note={note}
                columns={columns}
                titleColWidth={titleColWidth}
                onCellCommit={editCell}
                onTitleCommit={renameNote}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
