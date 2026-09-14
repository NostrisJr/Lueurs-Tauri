import clsx from "clsx";
import { useMemo } from "react";
import { NodeIconProvider } from "../../../shared/components/NodeIconProvider";
import {
  IconChevronRight,
  IconFolder,
} from "../../../shared/components/PlatformIcon";
import { Squircle } from "../../../shared/components/Squircle";
import type {
  FolderNode,
  MediaFile,
  NoteFile,
} from "../../../shared/hooks/useFileTree";
import { MarkdownPreview } from "../FileTree/MarkdownPreview";
import { rowContainerClass } from "../FileTree/helpers";
import { parsePreviewBlocks } from "../FileTree/parseMarkdownPreview";

interface Props {
  node: FolderNode | MediaFile | NoteFile;
  onDrillIn: (folder: FolderNode) => void;
  onOpenNote: (note: NoteFile) => void;
}

function TrashNoteContent({ note }: { note: NoteFile }) {
  const blocks = useMemo(() => parsePreviewBlocks(note.body, 6), [note.body]);

  return (
    <div>
      <div className="flex items-center gap-2.5 min-w-0">
        <NodeIconProvider node={note} className="text-ink-5 shrink-0 size-4" />
        <p className={clsx("text-base font-semibold truncate", "text-ink-3")}>
          {note.name}
        </p>
      </div>
      {blocks.length > 0 && (
        <MarkdownPreview
          blocks={blocks}
          className={clsx(
            "mt-0.5 text-sm leading-relaxed line-clamp-2",
            "text-ink-4"
          )}
        />
      )}
    </div>
  );
}

function TrashFolderContent({ folder }: { folder: FolderNode }) {
  return (
    <>
      <IconFolder className="text-ink-5 shrink-0 size-4" />
      <span
        className={clsx(
          "flex-1 text-base font-semibold truncate",
          "text-ink-3"
        )}
      >
        {folder.name}
      </span>
      <IconChevronRight className="text-ink-5 shrink-0 size-3.5" />
    </>
  );
}

function TrashMediaContent({ media }: { media: MediaFile }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <NodeIconProvider node={media} className="text-ink-5 shrink-0 size-4" />
      <p className={clsx("text-base font-semibold truncate", "text-ink-3")}>
        {media.name}
      </p>
    </div>
  );
}

// Rendu grisé (corbeille) — même structure visuelle que FileRow, palette éteinte
// pour signaler qu'on n'est plus dans l'arbre de notes actif. Appui long et
// swipe sont gérés par MobileRowGestures, qui enveloppe cette rangée.
export function TrashRow({ node, onDrillIn, onOpenNote }: Props) {
  function handleClick() {
    if (node.kind === "folder") onDrillIn(node);
    else if (node.kind === "file") onOpenNote(node);
  }

  return (
    <Squircle
      radius={20}
      className={clsx(
        "w-full active:scale-[0.98] transition-transform",
        "bg-surface-2"
      )}
      onClick={handleClick}
    >
      <div className={rowContainerClass(node.kind)}>
        {node.kind === "folder" ? (
          <TrashFolderContent folder={node} />
        ) : node.kind === "media" ? (
          <TrashMediaContent media={node} />
        ) : (
          <TrashNoteContent note={node} />
        )}
      </div>
    </Squircle>
  );
}
