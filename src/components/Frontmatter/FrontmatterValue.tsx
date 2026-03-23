import { NoteChip } from "./NoteChip";

interface Props {
  value: string | string[];
  isNoteArray: boolean;
  isSystem: boolean;
  isValueLocked: boolean;
  onTextChange: (value: string) => void;
  onTextBlur: () => void;
  onRemoveNote: (path: string) => void;
  noteName: (path: string) => string;
}

export function FrontmatterValue({
  value,
  isNoteArray,
  isSystem,
  isValueLocked,
  onTextChange,
  onTextBlur,
  onRemoveNote,
  noteName,
}: Props) {
  if (isNoteArray) {
    const paths = value as string[];
    return (
      <div className="flex flex-wrap gap-1 flex-1">
        {paths.map((path) => (
          <NoteChip
            key={path}
            name={noteName(path)}
            onRemove={() => onRemoveNote(path)}
          />
        ))}
        {paths.length === 0 && (
          <span className="text-gray-300 italic text-xs mt-0.5">
            aucune note
          </span>
        )}
      </div>
    );
  }

  return (
    <input
      value={value as string}
      onChange={(e) => !isValueLocked && onTextChange(e.target.value)}
      onBlur={onTextBlur}
      disabled={isValueLocked}
      placeholder={isValueLocked ? undefined : "valeur"}
      className={`flex-1 mt-0.5 bg-transparent outline-none border-b border-transparent
                ${isSystem ? "font-bold" : ""}
                ${
                  isValueLocked
                    ? "text-gray-300 select-none"
                    : "text-gray-600 focus:border-gray-300"
                }
                transition-colors`}
    />
  );
}
