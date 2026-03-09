import { sfXCircle } from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";

/**
 * NoteChip — carte compacte représentant une note liée dans un champ noteArray.
 * Affiche le nom court et une croix pour supprimer.
 */
interface NoteChipProps {
  name: string;
  onRemove: () => void;
  readOnly?: boolean;
}

export function NoteChip({ name, onRemove, readOnly = false }: NoteChipProps) {
  return (
    <span className="inline-flex items-center gap-2 px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-xs font-medium group/chip">
      <span className="max-w-30 truncate">{name}</span>
      {!readOnly && (
        <SFIcon
          icon={sfXCircle}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="size-3 text-gray-400 hover:text-red-400 transition-all cursor-pointer"
          aria-hidden="true"
          title={`Retirer ${name}`}
        />
      )}
    </span>
  );
}
