import { useAtomValue } from "jotai";
import { platform } from "@tauri-apps/plugin-os";
import { activeNoteAtom, type DisplayMode } from "../../lib/Atoms";
import { EditableText } from "../EditableText.tsx";
import { DisplayModeSelector } from "./DisplayModeSelector.tsx";
import { useNote } from "../../hooks/useNote.ts";
import { SystemField } from "../../lib/noteTypes.ts";
import { useEffect } from "react";
interface Props {
  onRename: (newName: string) => Promise<void>;
  hideDisplayModeSelector: boolean;
  displayModeHandlerRef?: React.MutableRefObject<
    ((mode: DisplayMode) => void) | null
  >;
}

const isMobile = platform() === "ios" || platform() === "android";

export function NoteHeader({
  onRename,
  hideDisplayModeSelector,
  displayModeHandlerRef,
}: Props) {
  const activeNote = useAtomValue(activeNoteAtom);
  const { handleChange } = useNote();
  if (!activeNote) return null;

  function handleDisplayModeChange(mode: DisplayMode) {
    if (!activeNote) return;
    handleChange(activeNote.body, {
      ...activeNote.frontmatter,
      [SystemField.DISPLAY_MODE]: mode,
    });
  }

  // Expose le handler au parent (mobile) via ref
  useEffect(() => {
    if (displayModeHandlerRef) {
      displayModeHandlerRef.current = handleDisplayModeChange;
    }
  });

  return (
    <div className="border-b border-gray-100 sticky top-0 z-20 bg-white w-full flex min-w-0 px-4 py-2 text-3xl h-12.75 font-header text-left items-center justify-between gap-2">
      <EditableText
        className=" hover:bg-gray-100"
        value={activeNote.name}
        onSave={async (newName: string) => onRename(newName)}
        clickToEdit={isMobile}
      />
      {!hideDisplayModeSelector && (
        <DisplayModeSelector onModeChange={handleDisplayModeChange} />
      )}{" "}
    </div>
  );
}
