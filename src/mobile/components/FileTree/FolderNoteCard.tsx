import clsx from "clsx";
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
        className={clsx(
          "w-full active:scale-[0.98] transition-transform",
          "bg-surface"
        )}
        onClick={() => selectNote(note)}
      >
        <div className="px-4 py-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <IconTextRectanglePage
              className={clsx("size-3.5", iconAccentClass, "shrink-0")}
            />
            <p
              className={clsx(
                "text-xs font-semibold uppercase tracking-wide",
                "text-accent-strong"
              )}
            >
              Note de dossier
            </p>
          </div>
          {blocks.length > 0 ? (
            <MarkdownPreview
              blocks={blocks}
              className={clsx(
                "text-sm leading-relaxed line-clamp-3",
                "text-ink-2"
              )}
            />
          ) : (
            <p className="text-sm text-ink-4 italic">Note vide</p>
          )}
        </div>
      </Squircle>
    </div>
  );
}
