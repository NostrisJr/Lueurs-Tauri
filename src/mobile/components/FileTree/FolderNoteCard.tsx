import { useMemo } from "react";
import { IconTextRectanglePage } from "../../../shared/components/PlatformIcon";
import { Squircle } from "../../../shared/components/Squircle";
import type { NoteFile } from "../../../shared/hooks/useFileTree";
import { iconAccentClass } from "../../../shared/lib/platform";
import { useMobileSelectNote } from "../../hooks/useMobileSelectNote";
import { MarkdownPreview } from "./MarkdownPreview";
import { parsePreviewBlocks } from "./parseMarkdownPreview";

export function FolderNoteCard({ note }: { note: NoteFile }) {
  const selectNote = useMobileSelectNote();
  const blocks = useMemo(() => parsePreviewBlocks(note.body, 8), [note.body]);

  return (
    <div className="w-11/12 mx-auto">
      <Squircle
        radius={20}
        className="w-full bg-white active:scale-[0.98] transition-transform"
        onClick={() => selectNote(note)}
      >
        <div className="px-4 py-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <IconTextRectanglePage
              className={`size-3.5 ${iconAccentClass} shrink-0`}
            />
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
              Note de dossier
            </p>
          </div>
          {blocks.length > 0 ? (
            <MarkdownPreview
              blocks={blocks}
              className="text-sm text-gray-700 leading-relaxed line-clamp-3"
            />
          ) : (
            <p className="text-sm text-gray-400 italic">Note vide</p>
          )}
        </div>
      </Squircle>
    </div>
  );
}
