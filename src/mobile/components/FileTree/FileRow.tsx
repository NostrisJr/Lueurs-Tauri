import clsx from "clsx";
import { useSetAtom } from "jotai";
import { useMemo } from "react";
import { NodeIconProvider } from "../../../shared/components/NodeIconProvider";
import {
  IconChevronRight,
  IconFolder,
} from "../../../shared/components/PlatformIcon";
import type { FolderNode, NoteFile } from "../../../shared/hooks/useFileTree";
import { mobileContextMenuAtom } from "../../../shared/lib/atoms";
import { isIOS } from "../../../shared/lib/platform";
import { useLongPress } from "../../hooks/useLongPress";
import { useMobileSelectNote } from "../../hooks/useMobileSelectNote";
import { Squircle } from "../../../shared/components/Squircle";
import { getPreviewLines } from "./helpers";

interface Props {
  node: FolderNode | NoteFile;
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

export function FileRow({ node, onDrillIn, onClick }: Props) {
  const selectNote = useMobileSelectNote();
  const setContextMenu = useSetAtom(mobileContextMenuAtom);

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

  function handleLongPress() {
    setContextMenu({
      id: node.id,
      name: node.name,
      isFolder: node.kind === "folder",
    });
  }

  const longPress = useLongPress(handleLongPress, handleClick);

  const isFolder = node.kind === "folder";

  return (
    <Squircle
      radius={20}
      className="w-full bg-white active:scale-[0.98] transition-transform"
      {...longPress}
    >
      <div
        className={`px-4 py-2 flex ${
          isFolder
            ? "items-center gap-3 h-12"
            : "flex-col justify-center min-h-20 h-fit"
        }`}
      >
        {isFolder ? (
          <FolderContent folder={node} />
        ) : (
          <NoteContent note={node} />
        )}
      </div>
    </Squircle>
  );
}
