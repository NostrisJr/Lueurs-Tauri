import { MilkdownProvider } from "@milkdown/react";
import { platform } from "@tauri-apps/plugin-os";
import { useAtomValue, useSetAtom } from "jotai";
import type React from "react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { BaseView } from "../../../desktop/components/BaseView/BaseView";
import { DesktopDictaphone } from "../../../desktop/components/Dictaphone/DesktopDictaphone";
import { FrontmatterEditor } from "../../../desktop/components/Frontmatter/FrontmatterEditor";
import { MobileBaseView } from "../../../mobile/components/BaseView/MobileBaseView";
import type { Frontmatter } from "../../hooks/useFileTree";
import { useNote } from "../../hooks/useNote.ts";
import {
  type DisplayMode,
  activeNoteAtom,
  defaultDisplayModeAtom,
  displayModeAtom,
  documentMapAtom,
  folderPathAtom,
} from "../../lib/Atoms";
import { NoteType, SystemField } from "../../lib/noteTypes";
import { DocumentNavigator } from "./DocumentNavigator.tsx";
import { EditorToolbar } from "./EditorToolbar.tsx";
import { type EditorHandle, MarkdownEditor } from "./MarkdownEditor.tsx";
import { NoteHeader } from "./NoteHeader.tsx";

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
  const setDocumentMap = useSetAtom(documentMapAtom);
  const defaultDisplayMode = useAtomValue(defaultDisplayModeAtom);
  const internalRef = useRef<EditorHandle | null>(null);
  const [dictaphoneOpen, setDictaphoneOpen] = useState(false);
  const isDesktop = platform() !== "ios";
  const isBase = activeNote?.type === NoteType.BASE;

  // Vide la carte quand on passe sur une base (pas de MarkdownEditor → plugin jamais déclenché)
  useEffect(() => {
    if (isBase) setDocumentMap({ blocks: [], docSize: 0 });
  }, [isBase, setDocumentMap]);

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

  function handleDisplayModeChange(mode: DisplayMode) {
    if (!activeNote) return;
    handleChange(activeNote.body, {
      ...activeNote.frontmatter,
      [SystemField.DISPLAY_MODE]: mode,
    });
  }

  return (
    <div className="min-h-full w-full">
      {activeNote && folderPath && (
        <>
          <NoteHeader
            hideDisplayModeSelector={hideDisplayModeSelector}
            onRename={async (newName) => {
              await handleRename(activeNote.id, newName, false);
            }}
            onDisplayModeChange={handleDisplayModeChange}
            displayModeHandlerRef={displayModeHandlerRef}
          />

          {!isBase && isDesktop && (
            <div className="relative select-none">
              <EditorToolbar
                editorRef={internalRef}
                onRecord={() => setDictaphoneOpen(true)}
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

            {/* Ancre sticky — hauteur nulle, le navigateur sort en overflow-visible */}
            {!isBase && (
              <div className="sticky top-10 h-0 overflow-visible z-10">
                <DocumentNavigator />
              </div>
            )}

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
        </>
      )}
    </div>
  );
});
