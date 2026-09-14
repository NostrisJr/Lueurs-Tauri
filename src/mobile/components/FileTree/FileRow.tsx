import clsx from "clsx";
import { useMemo } from "react";
import { NodeIconProvider } from "../../../shared/components/NodeIconProvider";
import {
  IconChevronRight,
  IconFolder,
  IconLock,
} from "../../../shared/components/PlatformIcon";
import { Squircle } from "../../../shared/components/Squircle";
import type {
  FolderNode,
  MediaFile,
  NoteFile,
} from "../../../shared/hooks/useFileTree";
import { isNoteReadOnly } from "../../../shared/lib/noteTypes";
import { isIOS } from "../../../shared/lib/platform";
import { useMobileSelectNote } from "../../hooks/useMobileSelectNote";
import { MarkdownPreview } from "./MarkdownPreview";
import { MEDIA_LABEL, rowContainerClass } from "./helpers";
import { parsePreviewBlocks } from "./parseMarkdownPreview";

interface Props {
  node: FolderNode | NoteFile | MediaFile;
  onDrillIn: (folder: FolderNode) => void;
  onClick?: () => void;
}

function NoteContent({ note }: { note: NoteFile }) {
  const blocks = useMemo(() => parsePreviewBlocks(note.body, 6), [note.body]);

  return (
    <div>
      <div className="flex items-center gap-2.5 min-w-0">
        <NodeIconProvider
          node={note}
          className={clsx("text-ink-4 shrink-0", isIOS ? "size-4" : "size-5")}
        />
        <p className={clsx("text-base font-semibold truncate", "text-ink")}>
          {note.name}
        </p>
        {isNoteReadOnly(note.frontmatter) && (
          <IconLock className="text-ink-4 shrink-0 size-3.5" />
        )}
      </div>
      {blocks.length > 0 ? (
        <MarkdownPreview
          blocks={blocks}
          className={clsx(
            "mt-0.5 text-sm leading-relaxed line-clamp-2",
            "text-ink-4"
          )}
        />
      ) : (
        <p className={clsx("text-sm truncate mt-0.5 italic", "text-ink-4")}>
          Note vide
        </p>
      )}
    </div>
  );
}

function FolderContent({ folder }: { folder: FolderNode }) {
  return (
    <>
      <IconFolder
        className={clsx("text-accent shrink-0", isIOS ? "size-4" : "size-5")}
      />
      <span
        className={clsx("flex-1 text-base font-semibold truncate", "text-ink")}
      >
        {folder.name}
      </span>
      <IconChevronRight
        className={clsx("text-ink-5 shrink-0", isIOS ? "size-3.5" : "size-5.5")}
      />
    </>
  );
}

function MediaContent({ media }: { media: MediaFile }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <NodeIconProvider
        node={media}
        className={clsx("text-ink-4 shrink-0", isIOS ? "size-4" : "size-5")}
      />
      <div className="min-w-0">
        <p className={clsx("text-base font-semibold truncate", "text-ink")}>
          {media.name}
        </p>
        <p className="text-sm text-ink-4">
          {MEDIA_LABEL[media.mediaType] ?? media.mediaType} ·{" "}
          {media.fileName.split(".").pop()?.toUpperCase()}
        </p>
      </div>
    </div>
  );
}

// L'appui long (menu contextuel) et le swipe sont gérés par MobileRowGestures,
// qui enveloppe cette rangée : ici, seul le tap simple.
export function FileRow({ node, onDrillIn, onClick }: Props) {
  const selectNote = useMobileSelectNote();

  function handleClick() {
    if (onClick) {
      onClick();
      return;
    }
    if (node.kind === "folder") {
      onDrillIn(node);
    } else {
      selectNote(node);
    }
  }

  return (
    <Squircle
      radius={20}
      className={clsx(
        "w-full active:scale-[0.98] transition-transform",
        "bg-surface"
      )}
      onClick={handleClick}
    >
      <div className={rowContainerClass(node.kind)}>
        {node.kind === "folder" ? (
          <FolderContent folder={node} />
        ) : node.kind === "media" ? (
          <MediaContent media={node} />
        ) : (
          <NoteContent note={node} />
        )}
      </div>
    </Squircle>
  );
}
