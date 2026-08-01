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
import { MEDIA_LABEL, getPreviewLines, rowContainerClass } from "./helpers";

interface Props {
  node: FolderNode | NoteFile | MediaFile;
  onDrillIn: (folder: FolderNode) => void;
  onClick?: () => void;
}

function NoteContent({ note }: { note: NoteFile }) {
  const previewLines = useMemo(() => getPreviewLines(note.body), [note.body]);

  return (
    <div>
      <div className="flex items-center gap-2.5 min-w-0">
        <NodeIconProvider
          node={note}
          className={clsx(
            "text-gray-400 shrink-0",
            isIOS ? "size-4" : "size-5"
          )}
        />
        <p className="text-base font-semibold text-gray-900 truncate">
          {note.name}
        </p>
        {isNoteReadOnly(note.frontmatter) && (
          <IconLock className="text-gray-400 shrink-0 size-3.5" />
        )}
      </div>
      {previewLines.length > 0 ? (
        <div className="mt-0.5 space-y-0.5">
          {previewLines.map((line, i) => (
            <p
              // biome-ignore lint/suspicious/noArrayIndexKey: lignes statiques
              key={i}
              className="text-sm text-gray-400 truncate leading-relaxed"
            >
              {line}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 truncate mt-0.5 italic">
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
        className={clsx(
          "text-yellow-500 shrink-0",
          isIOS ? "size-4" : "size-5"
        )}
      />
      <span className="flex-1 text-base font-semibold text-gray-900 truncate">
        {folder.name}
      </span>
      <IconChevronRight
        className={clsx(
          "text-gray-300 shrink-0",
          isIOS ? "size-3.5" : "size-5.5"
        )}
      />
    </>
  );
}

function MediaContent({ media }: { media: MediaFile }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <NodeIconProvider
        node={media}
        className={clsx("text-gray-400 shrink-0", isIOS ? "size-4" : "size-5")}
      />
      <div className="min-w-0">
        <p className="text-base font-semibold text-gray-900 truncate">
          {media.name}
        </p>
        <p className="text-sm text-gray-400">
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
      className="w-full bg-white active:scale-[0.98] transition-transform"
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
