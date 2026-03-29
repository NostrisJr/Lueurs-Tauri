import { useAtomValue } from "jotai";
import { activeNoteAtom } from "../../lib/atoms";
import { EditableText } from "../EditableText";
interface Props {
  onRename: (newName: string) => Promise<void>;
}

export function NoteHeader({ onRename }: Props) {
  const activeNote = useAtomValue(activeNoteAtom);
  if (!activeNote) return null;

  return (
    <div className="border-gray-100 border-b px-4 py-2 flex w-full overflow-hidden items-center justify-between gap-2">
      <EditableText
        className="text-3xl h-12 font-body border-gray-100 font-title text-left items-center min-w-0 flex-1"
        value={activeNote.name}
        onSave={async (newName: string) => onRename(newName)}
      />
    </div>
  );
}
