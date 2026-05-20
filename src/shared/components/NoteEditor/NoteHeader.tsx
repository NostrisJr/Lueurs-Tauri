import { platform } from "@tauri-apps/plugin-os";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { BottomSheet } from "../../../mobile/components/BottomSheet/BottomSheet";
import { type DisplayMode, activeNoteAtom } from "../../lib/atoms";
import { EditableText } from "../EditableText.tsx";
import { DisplayModeSelector } from "./DisplayModeSelector.tsx";

interface Props {
  onRename: (newName: string) => Promise<void>;
  onDisplayModeChange: (mode: DisplayMode) => void;
  hideDisplayModeSelector: boolean;
  displayModeHandlerRef?: React.MutableRefObject<
    ((mode: DisplayMode) => void) | null
  >;
}

const isMobile = platform() === "ios" || platform() === "android";

export function NoteHeader({
  onRename,
  onDisplayModeChange,
  hideDisplayModeSelector,
  displayModeHandlerRef,
}: Props) {
  const activeNote = useAtomValue(activeNoteAtom);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Expose le handler au parent (mobile) via ref
  useEffect(() => {
    if (displayModeHandlerRef) {
      displayModeHandlerRef.current = onDisplayModeChange;
    }
  });

  if (!activeNote) return null;

  async function handleRenameConfirm() {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === activeNote?.name) {
      setRenameOpen(false);
      return;
    }
    await onRename(trimmed);
    setRenameOpen(false);
  }

  return (
    <div className="border-b border-gray-100 sticky top-0 z-20 bg-white w-full flex min-w-0 px-4 py-2 text-3xl h-12.75 font-header text-left items-center justify-between gap-2">
      {isMobile ? (
        <>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: tap mobile */}
          <span
            onClick={() => {
              setRenameValue(activeNote.name);
              setRenameOpen(true);
            }}
            className="cursor-pointer truncate hover:bg-gray-100 items-baseline px-1"
          >
            {activeNote.name}
          </span>
          {renameOpen && (
            <BottomSheet
              onClose={() => setRenameOpen(false)}
              title="Renommer la note"
            >
              <div className="px-2 pt-2 flex flex-col gap-4">
                <input
                  // biome-ignore lint/a11y/noAutofocus: focus intentionnel à l'ouverture
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameConfirm();
                    if (e.key === "Escape") setRenameOpen(false);
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base text-gray-900 bg-gray-50 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleRenameConfirm}
                  className="w-full py-3.5 rounded-xl bg-amber-500 text-white font-semibold text-base active:bg-amber-600 transition-colors"
                >
                  Renommer
                </button>
              </div>
            </BottomSheet>
          )}
        </>
      ) : (
        <EditableText
          className=" hover:bg-gray-100"
          value={activeNote.name}
          onSave={async (newName: string) => onRename(newName)}
        />
      )}
      {!hideDisplayModeSelector && (
        <DisplayModeSelector onModeChange={onDisplayModeChange} />
      )}
    </div>
  );
}
