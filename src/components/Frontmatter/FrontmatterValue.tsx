import { NoteChip } from "./NoteChip";

interface Props {
    value: string | string[];
    isNoteArray: boolean;
    isSystem: boolean;
    isViolation: boolean;
    onTextChange: (value: string) => void;
    onTextBlur: () => void;
    onRemoveNote: (path: string) => void;
    noteName: (path: string) => string;
}

export function FrontmatterValue({ value, isNoteArray, isSystem, isViolation, onTextChange, onTextBlur, onRemoveNote, noteName }: Props) {
    if (isNoteArray) {
        const paths = value as string[];
        return (
            <div className="flex flex-wrap gap-1 flex-1">
                {paths.map((path) => (
                    <NoteChip key={path} name={noteName(path)} onRemove={() => onRemoveNote(path)} />
                ))}
                {paths.length === 0 && (
                    <span className="text-gray-300 italic text-xs mt-0.5">aucune note</span>
                )}
            </div>
        );
    }

    return (
        <input
            value={value as string}
            onChange={(e) => onTextChange(e.target.value)}
            onBlur={onTextBlur}
            placeholder="valeur"
            className={`flex-1 mt-0.5 bg-transparent outline-none border-b border-transparent focus:border-gray-300
                ${isSystem ? "font-bold" : ""}
                ${isViolation ? "text-red-500" : "text-gray-600"}
                transition-colors duration-[2500]`}
        />
    );
}