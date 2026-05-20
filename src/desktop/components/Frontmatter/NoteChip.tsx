import { useAtomValue } from "jotai";
import { IconXCircle } from "../../../shared/components/PlatformIcon";
import { useNote } from "../../../shared/hooks/useNote";
import { notesByIdAtom } from "../../../shared/lib/atoms";
import { useCmdHeld } from "../../hooks/useCmdHeld";

/**
 * NoteChip — carte compacte représentant une note liée dans un champ noteArray.
 * Affiche le nom court et une croix pour supprimer.
 * Cmd+clic ouvre la note dans un nouvel onglet (si noteId fourni).
 */
interface NoteChipProps {
  name: string;
  onRemove: () => void;
  readOnly?: boolean;
  noteId?: string;
}

export function NoteChip({
  name,
  onRemove,
  readOnly = false,
  noteId,
}: NoteChipProps) {
  const { handleSelectNote } = useNote();
  const notesById = useAtomValue(notesByIdAtom);
  const cmdHeld = useCmdHeld();

  function handleClick(e: React.MouseEvent) {
    if (!e.metaKey || !noteId) return;
    const note = notesById.get(noteId);
    if (note) handleSelectNote(note, true);
  }

  return (
    <span className="inline-flex items-center gap-2 px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-xs font-medium group/chip">
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
      <span
        className={`max-w-30 truncate ${cmdHeld && noteId ? "cursor-pointer" : "cursor-default"}`}
        onClick={handleClick}
      >
        {name}
      </span>
      {!readOnly && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title={`Retirer ${name}`}
          className="text-gray-400 hover:text-red-400 transition-all cursor-pointer bg-transparent border-0 p-0 flex items-center"
        >
          <IconXCircle className="size-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
