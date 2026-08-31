import { MilkdownProvider } from "@milkdown/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { BaseView } from "../../../desktop/components/BaseView/BaseView";
import { FrontmatterEditor } from "../../../desktop/components/Frontmatter/FrontmatterEditor";
import { MobileBaseView } from "../../../mobile/components/BaseView/MobileBaseView";
import { useMobileSelectNote } from "../../../mobile/hooks/useMobileSelectNote";
import type { Frontmatter } from "../../hooks/useFileTree";
import { useNote } from "../../hooks/useNote.ts";
import {
  type DisplayMode,
  activeNoteAtom,
  dictaphoneOpenAtom,
  folderPathAtom,
  notesByIdAtom,
  pendingAudioInsertAtom,
  pendingDisplayModeAtom,
} from "../../lib/atoms";
import { NoteType, SystemField } from "../../lib/noteTypes";
import { isDesktop, isMobile } from "../../lib/platform";
import { DocumentNavigator } from "./DocumentNavigator.tsx";
import { InlineFormulaPopup } from "./InlineFormulaPopup.tsx";
import type { Editor } from "./MarkdownEditor";
import { MarkdownEditor } from "./MarkdownEditor.tsx";
import { NoteHeader } from "./NoteHeader.tsx";
import { SearchBar } from "./SearchBar.tsx";
import { WikilinkEditPopup } from "./WikilinkEditPopup.tsx";
import { WikilinkSuggest } from "./WikilinkSuggest.tsx";
import { editorInsertAudioBlock } from "./lib/editorCommands.ts";

interface Props {
  defaultCollapsedFrontmatter?: boolean;
  /** Ref externe reçue depuis le parent (ex: MobileEditor). */
  editorRef?: React.MutableRefObject<Editor | null>;
}

export function NoteEditor({
  defaultCollapsedFrontmatter = false,
  editorRef: externalEditorRef,
}: Props) {
  const { handleRename, handleChange, handleSelectNote } = useNote();
  const activeNote = useAtomValue(activeNoteAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const notesById = useAtomValue(notesByIdAtom);
  const mobileSelectNote = useMobileSelectNote();
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
  }, [
    pendingAudioInsert,
    folderPath,
    resolvedEditorRef,
    setPendingAudioInsert,
  ]);

  const isBase = activeNote?.type === NoteType.BASE;
  const isNote = !isBase;

  function handleBodyChange(newBody: string) {
    if (!activeNote) return;
    handleChange(newBody, activeNote.frontmatter);
  }

  // Ouverture d'une note depuis un wikilink : onglets (desktop) / navigation (mobile)
  const handleOpenNote = useCallback(
    (noteId: string, newTab: boolean) => {
      const target = notesById.get(noteId);
      if (!target) return;
      if (isMobile) mobileSelectNote(target);
      else handleSelectNote(target, newTab);
    },
    [notesById, mobileSelectNote, handleSelectNote]
  );

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
            isNote={isNote}
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
            {/* Pas de rendu en mobile, UI trop compliquée/chargée sinon (pas assze de largeur pour le faire passer dans le padding) */}
            {!isBase && !isMobile && (
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
                  onOpenNote={handleOpenNote}
                />
                <WikilinkSuggest vaultPath={folderPath} />
                <WikilinkEditPopup vaultPath={folderPath} />
                <InlineFormulaPopup />
                <SearchBar />
              </MilkdownProvider>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
