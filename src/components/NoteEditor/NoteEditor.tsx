import { forwardRef, useRef, useCallback } from "react";
import { MilkdownProvider } from "@milkdown/react";
import { useAtomValue } from "jotai";
import { platform } from "@tauri-apps/plugin-os";
import { useNote } from "../../hooks/useNote.ts";
import { activeNoteAtom, folderPathAtom } from "../../lib/atoms.ts";
import { NoteType } from "../../lib/noteTypes.ts";
import { BaseView } from "../BaseView/BaseView.tsx";
import { MobileBaseView } from "../Mobile/MobileBaseView.tsx";
import type { Frontmatter } from "../FileTree/hooks/useFileTree.ts";
import { FrontmatterEditor } from "../Frontmatter/FrontmatterEditor.tsx";
import { MarkdownEditor, type EditorHandle } from "./MarkdownEditor.tsx";
import { NoteHeader } from "./NoteHeader.tsx";
import { EditorToolbar } from "./EditorToolbar.tsx";

export type { EditorHandle };

interface Props {
  defaultCollapsedFrontmatter?: boolean;
}

export const NoteEditor = forwardRef<EditorHandle, Props>(function NoteEditor(
  { defaultCollapsedFrontmatter = false },
  ref
) {
  const { handleRename, handleChange } = useNote();
  const activeNote = useAtomValue(activeNoteAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const internalRef = useRef<EditorHandle | null>(null);

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
    <div className="h-full">
      {activeNote && folderPath && (
        <div className="">
          <NoteHeader
            onRename={async (newName) => {
              await handleRename(activeNote.id, newName, false);
            }}
          />

          {!isBase && <EditorToolbar editorRef={internalRef} />}

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
