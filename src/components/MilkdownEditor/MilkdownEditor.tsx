import { forwardRef } from "react";
import { MilkdownProvider } from "@milkdown/react";
import { useAtomValue } from "jotai";
import { platform } from "@tauri-apps/plugin-os";
import { useNote } from "../../hooks/useNote";
import { activeNoteAtom, folderPathAtom } from "../../lib/atoms.ts";
import { NoteType } from "../../lib/noteTypes";
import { BaseView } from "../BaseView/BaseView";
import { MobileBaseView } from "../Mobile/MobileBaseView";
import type { Frontmatter } from "../FileTree/hooks/useFileTree";
import { FrontmatterEditor } from "../Frontmatter/FrontmatterEditor";
import { CrepeEditor, type CrepeHandle } from "./CrepeEditor";
import { NoteHeader } from "./NoteHeader";

export type { CrepeHandle };

interface Props {
  defaultCollapsedFrontmatter?: boolean;
}

export const MilkdownEditor = forwardRef<CrepeHandle, Props>(
  function MilkdownEditor({ defaultCollapsedFrontmatter = false }, ref) {
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
          <div className="">
            <NoteHeader
              onRename={async (newName) => {
                await handleRename(activeNote.id, newName, false);
              }}
            />
            <div className="relative pb-10">
              <FrontmatterEditor onChange={handleFrontmatterChange} defaultCollapsed={defaultCollapsedFrontmatter} />

              {isBase ? (
                platform() === "ios" ? (
                  <MobileBaseView base={activeNote} onBaseChange={handleFrontmatterChange} />
                ) : (
                  <BaseView base={activeNote} onBaseChange={handleFrontmatterChange} />
                )
              ) : (
                <MilkdownProvider key={activeNote.id}>
                  <CrepeEditor
                    ref={ref}
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
);
