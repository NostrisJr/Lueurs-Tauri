import { useAtomValue } from "jotai";
import { activeNoteAtom } from "../../lib/atoms.ts";
import { EditableText } from "../EditableText";
interface Props {
  onRename: (newName: string) => Promise<void>;
}

export function NoteHeader({ onRename }: Props) {
  const activeNote = useAtomValue(activeNoteAtom);
  if (!activeNote) return null;

  return (
    <div className="border-b border-gray-100 sticky top-0 z-20 bg-white w-full flex min-w-0 px-4 py-2 text-3xl h-12.75 font-body  font-title text-left items-center">
      <EditableText
        className=""
        value={activeNote.name}
        onSave={async (newName: string) => onRename(newName)}
      />
    </div>
  );
}
