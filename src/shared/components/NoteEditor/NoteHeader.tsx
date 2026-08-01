import { useAtomValue } from "jotai";
import { type DisplayMode, activeNoteAtom } from "../../lib/atoms";
import { isMobile } from "../../lib/platform";
import { EditableText } from "../EditableText.tsx";
import { IconRecordAudio } from "../PlatformIcon.tsx";
import { DisplayModeSelector } from "./DisplayModeSelector.tsx";

interface Props {
  onRename: (newName: string) => Promise<void>;
  onDisplayModeChange?: (mode: DisplayMode) => void;
  isNote: boolean;
  onRecord?: () => void;
  /** Override du nom affiché — utilisé pour les médias où activeNoteAtom est null. */
  name?: string;
}

export function NoteHeader({
  onRename,
  onDisplayModeChange,
  isNote,
  onRecord,
  name: nameProp,
}: Props) {
  const activeNote = useAtomValue(activeNoteAtom);

  const displayName = nameProp ?? activeNote?.name;
  if (!displayName) return null;

  return (
    // Mobile : pas de sticky. La barre de MobileEditor est fixed/z-30 et couvre
    // top-0 — un header sticky viendrait se cacher dessous au moindre scroll,
    // titre devenu intappable. Il défile donc avec le contenu.
    <div
      className={`border-b border-gray-100 bg-white w-full flex min-w-0 px-4 py-2 text-3xl h-13 font-header text-left items-center justify-between gap-2 ${
        isMobile ? "" : "sticky top-0 z-20"
      }`}
    >
      <EditableText
        className=" hover:bg-gray-100"
        value={displayName}
        onSave={async (newName: string) => onRename(newName)}
      />
      <div className="flex items-center gap-3">
        {isNote && !isMobile && onRecord && (
          <button
            type="button"
            onClick={onRecord}
            title="Enregistrement vocal"
            className="p-0.5 text-gray-500 hover:text-red-500 transition-colors bg-transparent rounded-full size-10 flex items-center justify-center hover:bg-gray-100"
          >
            <IconRecordAudio className="size-4.5" aria-hidden="true" />
          </button>
        )}
        {isNote && !isMobile && onDisplayModeChange && (
          <DisplayModeSelector onModeChange={onDisplayModeChange} />
        )}
      </div>
    </div>
  );
}
