import {
  Editor,
  defaultValueCtx,
  editorViewOptionsCtx,
  rootCtx,
} from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import clsx from "clsx";
import { IconXmark } from "../../../shared/components/PlatformIcon";
import type { NoteFile } from "../../../shared/hooks/useFileTree";
import { iconAccentClass } from "../../../shared/lib/platform";
import { hapticImpact } from "../../lib/haptics";

interface Props {
  note: NoteFile;
  onClose: () => void;
}

function ReadOnlyMilkdown({ body }: { body: string }) {
  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, body);
        ctx.set(editorViewOptionsCtx, { editable: () => false });
      })
      .use(commonmark)
      .use(gfm)
  );

  return <Milkdown />;
}

// Aperçu en lecture seule d'une note trashée — pas de plugins d'édition
// (wikilinks, formules, spellcheck…) : la note n'existe plus dans treeAtom/notesById,
// donc on ne peut pas résoudre ces liaisons vers le reste du vault.
export function TrashNotePreview({ note, onClose }: Props) {
  return (
    <div className={clsx("fixed inset-0 z-40 flex flex-col", "bg-surface-4")}>
      <div
        className={clsx(
          "flex items-center w-full justify-center px-2 py-2 border-b pt-14 shrink-0",
          "bg-surface-3 border-line-2"
        )}
      >
        <button
          type="button"
          onClick={() => {
            hapticImpact("light");
            onClose();
          }}
          className={clsx(
            "flex-1 justify-start fixed left-1 items-center gap-1 px-2 py-1.5 rounded-lg",
            iconAccentClass,
            "active:bg-surface-4 transition-colors"
          )}
        >
          <IconXmark className="size-5" />
        </button>
        <h1
          className={clsx(
            "justify-center text-lg font-semibold truncate px-16",
            "text-ink-3"
          )}
        >
          {note.name}
        </h1>
      </div>
      <div className={clsx("flex-1 overflow-y-auto px-4 py-4", "bg-surface-3")}>
        <MilkdownProvider key={note.id}>
          <div className="mode-normal">
            <ReadOnlyMilkdown body={note.body} />
          </div>
        </MilkdownProvider>
      </div>
    </div>
  );
}
