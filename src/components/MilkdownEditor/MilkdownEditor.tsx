import { MilkdownProvider } from "@milkdown/react";
import { useAtomValue } from "jotai";
import { useNote } from "../../hooks/useNote";
import { activeNoteAtom, folderPathAtom } from "../../lib/atoms";
import { NoteType } from "../../lib/noteTypes";
import { BaseView } from "../BaseView/BaseView";
import type { Frontmatter } from "../FileTree/hooks/useFileTree";
import { FrontmatterEditor } from "../Frontmatter/FrontmatterEditor";
import { CrepeEditor } from "./CrepeEditor";
import { NoteHeader } from "./NoteHeader";

export function MilkdownEditor() {
  const { handleRename, handleChange } = useNote();
  const activeNote = useAtomValue(activeNoteAtom);
  const folderPath = useAtomValue(folderPathAtom);

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
        <div>
          <div className="fixed bg-white z-20 w-full">
            <NoteHeader
              onRename={async (newName) => {
                await handleRename(activeNote.id, newName, false);
              }}
            />
          </div>
          <div className="pt-16 relative">
            <FrontmatterEditor onChange={handleFrontmatterChange} />
            <div className="bg-white h-2 w-full" />

            {isBase ? (
              <BaseView
                base={activeNote}
                onBaseChange={handleFrontmatterChange}
              />
            ) : (
              <MilkdownProvider key={activeNote.id}>
                <CrepeEditor
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
