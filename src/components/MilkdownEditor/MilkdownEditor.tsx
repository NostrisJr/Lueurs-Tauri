import { MilkdownProvider } from "@milkdown/react";
import { useAtomValue } from "jotai";
import { activeNoteAtom, folderPathAtom } from "../../lib/atoms";
import type { Frontmatter } from "../FileTree/useFileTree";
import { useNote } from "../../hooks/useNote";
import { NoteHeader } from "./NoteHeader";
import { FrontmatterEditor } from "../Frontmatter/FrontmatterEditor";
import { CrepeEditor } from "./CrepeEditor";

interface Props {
  className?: string;
}

export function MilkdownEditor({ className }: Props) {
  const { handleRename, handleChange, refreshBaseChildren } = useNote();
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

  return (
    <div className={className}>
      {activeNote && folderPath && (
        <>
          <NoteHeader
            onRename={async (newName) => {
              await handleRename(activeNote.id, newName, false);
            }}
            onRefresh={() => refreshBaseChildren(activeNote)}
          />
          <FrontmatterEditor onChange={handleFrontmatterChange} />
          <MilkdownProvider key={activeNote.id}>
            <CrepeEditor
              node={activeNote}
              vaultPath={folderPath}
              onChange={handleBodyChange}
            />
          </MilkdownProvider>
        </>
      )}
    </div>
  );
}
