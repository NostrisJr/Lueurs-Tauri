import { useAtomValue } from "jotai";
import { activeNoteAtom } from "../../lib/atoms";
import { EditableText } from "../EditableText";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { sfArrowClockwise } from "@bradleyhodges/sfsymbols";
import { NoteType } from "../../lib/noteTypes";

interface Props {
  onRename: (newName: string) => Promise<void>;
  onRefresh: () => void;
}

export function NoteHeader({ onRename, onRefresh }: Props) {
  const activeNote = useAtomValue(activeNoteAtom);
  if (!activeNote) return null;

  const isBase = activeNote.type === NoteType.BASE;

  return (
    <div className="border-gray-100 border-b px-4 py-2 flex items-center justify-between gap-2">
      <EditableText
        className="text-3xl h-12 font-body border-gray-100 font-title text-left flex items-center w-full"
        value={activeNote.name}
        onSave={async (newName: string) => onRename(newName)}
      />
      {isBase && (
        <button
          type="button"
          onClick={onRefresh}
          title="Reconstruire les enfants de cette base"
          className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <SFIcon
            icon={sfArrowClockwise}
            className="size-3"
            aria-hidden="true"
          />
          Refresh
        </button>
      )}
    </div>
  );
}
