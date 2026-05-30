import { MilkdownProvider } from "@milkdown/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import type React from "react";
import { useEffect, useRef } from "react";
import { BaseView } from "../../../desktop/components/BaseView/BaseView";
import { FrontmatterEditor } from "../../../desktop/components/Frontmatter/FrontmatterEditor";
import { MobileBaseView } from "../../../mobile/components/BaseView/MobileBaseView";
import type { Frontmatter } from "../../hooks/useFileTree";
import { useNote } from "../../hooks/useNote.ts";
import {
  type DisplayMode,
  activeNoteAtom,
  dictaphoneOpenAtom,
  folderPathAtom,
  pendingAudioInsertAtom,
  pendingDisplayModeAtom,
} from "../../lib/atoms";
import { NoteType, SystemField } from "../../lib/noteTypes";
import { isDesktop, isMobile } from "../../lib/platform";
import type { Editor } from "./MarkdownEditor";
import { DocumentNavigator } from "./DocumentNavigator.tsx";
import { MarkdownEditor } from "./MarkdownEditor.tsx";
import { NoteHeader } from "./NoteHeader.tsx";
import { editorInsertAudioBlock } from "./editorCommands";

interface Props {
  defaultCollapsedFrontmatter?: boolean;
  hideDisplayModeSelector?: boolean;
  /** Ref externe reçue depuis le parent (ex: MobileEditor). */
  editorRef?: React.MutableRefObject<Editor | null>;
}

export function NoteEditor({
  defaultCollapsedFrontmatter = false,
  hideDisplayModeSelector = false,
  editorRef: externalEditorRef,
}: Props) {
  const { handleRename, handleChange } = useNote();
  const activeNote = useAtomValue(activeNoteAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const pendingDisplayMode = useAtomValue(pendingDisplayModeAtom);
  const setPendingDisplayMode = useSetAtom(pendingDisplayModeAtom);
  const setDictaphoneOpen = useSetAtom(dictaphoneOpenAtom);
  const [pendingAudioInsert, setPendingAudioInsert] = useAtom(
    pendingAudioInsertAtom
  );

  // Ref interne pour la toolbar desktop
  const internalEditorRef = useRef<Editor | null>(null);
  // La ref externe prime si fournie (MobileEditor), sinon on utilise l'interne
  const resolvedEditorRef = externalEditorRef ?? internalEditorRef;

  // Insertion audio venue du dictaphone desktop (overlay rendu dans DesktopApp).
  // Sur mobile, c'est MobileEditor qui consomme pendingAudioInsertAtom.
  useEffect(() => {
    if (!isDesktop || !pendingAudioInsert) return;
    editorInsertAudioBlock(
      resolvedEditorRef,
      folderPath ?? "",
      pendingAudioInsert.path,
      pendingAudioInsert.title
    );
    setPendingAudioInsert(null);
  }, [pendingAudioInsert, folderPath, resolvedEditorRef, setPendingAudioInsert]);

  const isBase = activeNote?.type === NoteType.BASE;

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

  // Consomme les changements de mode initiés depuis MobileEditor via atom.
  // Flush synchrone au render — évite un useEffect qui ajouterait un cycle.
  if (pendingDisplayMode !== null) {
    setPendingDisplayMode(null);
    if (activeNote) {
      handleChange(activeNote.body, {
        ...activeNote.frontmatter,
        [SystemField.DISPLAY_MODE]: pendingDisplayMode,
      });
    }
  }

  return (
    <div className="min-h-full w-full">
      {activeNote && folderPath && (
        <div className="flex flex-col h-full justify-center">
          <NoteHeader
            hideDisplayModeSelector={hideDisplayModeSelector}
            onRename={async (newName) => {
              await handleRename(activeNote.id, newName, false);
            }}
            onDisplayModeChange={handleDisplayModeChange}
            onRecord={() => setDictaphoneOpen(true)}
          />

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
              isMobile ? (
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
                  editorRef={resolvedEditorRef}
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
}
