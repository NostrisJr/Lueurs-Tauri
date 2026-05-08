import type React from "react";
import { forwardRef, useRef, useCallback, useState, useEffect } from "react";
import { MilkdownProvider } from "@milkdown/react";
import { useAtomValue, useSetAtom } from "jotai";
import { platform } from "@tauri-apps/plugin-os";
import { useNote } from "../../hooks/useNote.ts";
import {
  activeNoteAtom,
  displayModeAtom,
  defaultDisplayModeAtom,
  folderPathAtom,
  type DisplayMode,
} from "../../lib/Atoms";
import { NoteType, SystemField } from "../../lib/noteTypes";
import { BaseView } from "../../../desktop/components/BaseView/BaseView";
import { MobileBaseView } from "../../../mobile/components/MobileBaseView";
import type { Frontmatter } from "../../hooks/useFileTree";
import { FrontmatterEditor } from "../../../desktop/components/Frontmatter/FrontmatterEditor";
import { MarkdownEditor, type EditorHandle } from "./MarkdownEditor.tsx";
import { NoteHeader } from "./NoteHeader.tsx";
import { EditorToolbar } from "./EditorToolbar.tsx";
import { DesktopDictaphone } from "../../../desktop/components/Dictaphone/DesktopDictaphone";

export type { EditorHandle };

interface Props {
  defaultCollapsedFrontmatter?: boolean;
  hideDisplayModeSelector?: boolean;
  displayModeHandlerRef?: React.MutableRefObject<
    ((mode: DisplayMode) => void) | null
  >;
}

export const NoteEditor = forwardRef<EditorHandle, Props>(function NoteEditor(
  {
    defaultCollapsedFrontmatter = false,
    hideDisplayModeSelector = false,
    displayModeHandlerRef,
  },
  ref
) {
  const { handleRename, handleChange } = useNote();
  const activeNote = useAtomValue(activeNoteAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const setDisplayMode = useSetAtom(displayModeAtom);
  const defaultDisplayMode = useAtomValue(defaultDisplayModeAtom);
  const internalRef = useRef<EditorHandle | null>(null);
  const [dictaphoneOpen, setDictaphoneOpen] = useState(false);
  const isDesktop = platform() !== "ios";

  // Sync atom depuis le frontmatter à chaque changement de note ; repli sur le défaut utilisateur
  useEffect(() => {
    const saved = activeNote?.frontmatter[SystemField.DISPLAY_MODE] as
      | DisplayMode
      | undefined;
    setDisplayMode(
      saved === "livre" || saved === "normal" ? saved : defaultDisplayMode
    );
  }, [
    setDisplayMode,
    defaultDisplayMode,
    activeNote?.frontmatter[SystemField.DISPLAY_MODE],
  ]);

  // Connecte à la fois le ref interne (pour la toolbar) et le ref externe (pour le parent)
  const setRef = useCallback(
    (instance: EditorHandle | null) => {
      internalRef.current = instance;
      if (typeof ref === "function") ref(instance);
      else if (ref) ref.current = instance;
    },
    [ref]
  );

  function handleBodyChange(newBody: string) {
    if (!activeNote) return;
    handleChange(newBody, activeNote.frontmatter);
  }

  function handleFrontmatterChange(updated: Frontmatter) {
    if (!activeNote) return;
    handleChange(activeNote.body, updated);
  }

  const isBase = activeNote?.type === NoteType.BASE;

  return (
    <div className="h-full w-full">
      {activeNote && folderPath && (
        <div className="">
          <NoteHeader
            hideDisplayModeSelector={hideDisplayModeSelector}
            onRename={async (newName) => {
              await handleRename(activeNote.id, newName, false);
            }}
            displayModeHandlerRef={displayModeHandlerRef}
          />

          {!isBase && (
            <div className="relative select-none">
              <EditorToolbar
                editorRef={internalRef}
                onRecord={isDesktop ? () => setDictaphoneOpen(true) : undefined}
              />
              {dictaphoneOpen && (
                <DesktopDictaphone
                  onInsert={(path, title) => {
                    internalRef.current?.insertAudioBlock(path, title);
                    setDictaphoneOpen(false);
                  }}
                  onClose={() => setDictaphoneOpen(false)}
                />
              )}
            </div>
          )}

          <div className="relative pb-10">
            <FrontmatterEditor
              onChange={handleFrontmatterChange}
              defaultCollapsed={defaultCollapsedFrontmatter}
            />

            {isBase ? (
              platform() === "ios" ? (
                <MobileBaseView
                  base={activeNote}
                  onBaseChange={handleFrontmatterChange}
                />
              ) : (
                <BaseView
                  base={activeNote}
                  onBaseChange={handleFrontmatterChange}
                />
              )
            ) : (
              <MilkdownProvider key={activeNote.id}>
                <MarkdownEditor
                  ref={setRef}
                  node={activeNote}
                  vaultPath={folderPath}
                  onChange={handleBodyChange}
                />
              </MilkdownProvider>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
