import { useMemo } from "react";
/* import { useAtomValue } from "jotai";
import { activeNoteAtom } from "../../../lib/atoms.ts";
 */ import type { NoteFile } from "../../FileTree/hooks/useFileTree";
import { NodeIconProvider } from "../../FileTree/NodeIconProvider";
import { useLongPress } from "../../../hooks/mobile/useLongPress";
import { getPreviewLines } from "./helpers";

interface Props {
  note: NoteFile;
  onSelect: (note: NoteFile) => void;
  onLongPress: () => void;
}

export function NoteRow({ note, onSelect, onLongPress }: Props) {
  /*   const activeNote = useAtomValue(activeNoteAtom);
  const isActive = activeNote?.id === note.id; */
  const previewLines = useMemo(() => getPreviewLines(note.body), [note.body]);
  const longPress = useLongPress(onLongPress);

  return (
    <button
      type="button"
      onClick={() => onSelect(note)}
      {...longPress}
      className="w-full text-left rounded-2xl px-4 shadow-xs bg-white  py-3.5 active:scale-[0.98] transition-all"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <NodeIconProvider
          node={note}
          className="size-4 text-gray-400 shrink-0"
        />
        <p className="text-base font-semibold text-gray-900 truncate">
          {note.name}
        </p>
      </div>
      {previewLines.length > 0 && (
        <div className="mt-0.5 space-y-0.5">
          {previewLines.map((line, i) => (
            <p
              // biome-ignore lint/suspicious/noArrayIndexKey: lignes statiques
              key={i}
              className="text-sm text-gray-400 truncate leading-relaxed"
            >
              {line}
            </p>
          ))}
        </div>
      )}
    </button>
  );
}
