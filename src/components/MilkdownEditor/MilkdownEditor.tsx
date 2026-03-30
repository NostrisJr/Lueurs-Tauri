import { MilkdownProvider } from "@milkdown/react";
import { useAtomValue } from "jotai";
import { activeNoteAtom, folderPathAtom } from "../../lib/atoms";
import type { Frontmatter } from "../FileTree/hooks/useFileTree";
import { NoteType } from "../../lib/noteTypes";
import { useNote } from "../../hooks/useNote";
import { NoteHeader } from "./NoteHeader";
import { FrontmatterEditor } from "../Frontmatter/FrontmatterEditor";
import { CrepeEditor } from "./CrepeEditor";
import { BaseView } from "../BaseView/BaseView";

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
        <div className="overflow-x-clip">
          <div className="fixed bg-white z-10 w-full">
            <NoteHeader
              onRename={async (newName) => {
                await handleRename(activeNote.id, newName, false);
              }}
            />
          </div>
          <div className="pt-16">
            <FrontmatterEditor onChange={handleFrontmatterChange} />
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
