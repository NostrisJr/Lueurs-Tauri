import { useMemo } from "react";
import { Squircle } from "../../../shared/components/Squircle";
import { IconTextRectanglePage } from "../../../shared/components/PlatformIcon";
import type { NoteFile } from "../../../shared/hooks/useFileTree";
import { useMobileSelectNote } from "../../hooks/useMobileSelectNote";

function getFolderNotePreview(body: string): string[] {
  const withoutFrontmatter = body.replace(/^---[\s\S]*?---\n?/, "");
  return withoutFrontmatter
    .split("\n")
    .map((l) =>
      l
        .replace(/^#{1,6}\s+/, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/~~(.+?)~~/g, "$1")
        .replace(/`(.+?)`/g, "$1")
        .trim()
    )
    .filter((l) => l.length > 1)
    .slice(0, 3);
}

export function FolderNoteCard({ note }: { note: NoteFile }) {
  const selectNote = useMobileSelectNote();
  const previewLines = useMemo(
    () => getFolderNotePreview(note.body),
    [note.body]
  );

  return (
    <div className="w-11/12 mx-auto">
      <Squircle
        radius={20}
        className="w-full bg-white active:scale-[0.98] transition-transform"
        onClick={() => selectNote(note)}
      >
        <div className="px-4 py-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <IconTextRectanglePage className="size-3.5 text-amber-500 shrink-0" />
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
              Note de dossier
            </p>
          </div>
          {previewLines.length > 0 ? (
            <div className="space-y-0.5">
              {previewLines.map((line, i) => (
                <p
                  // biome-ignore lint/suspicious/noArrayIndexKey: lignes statiques
                  key={i}
                  className="text-sm text-gray-700 truncate leading-relaxed"
                >
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Note vide</p>
          )}
        </div>
      </Squircle>
    </div>
  );
}
