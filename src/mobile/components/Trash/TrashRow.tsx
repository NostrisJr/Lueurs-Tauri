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
import { getPreviewLines, rowContainerClass } from "../FileTree/helpers";

interface Props {
  node: FolderNode | MediaFile | NoteFile;
  onDrillIn: (folder: FolderNode) => void;
  onOpenNote: (note: NoteFile) => void;
}

function TrashNoteContent({ note }: { note: NoteFile }) {
  const previewLines = useMemo(() => getPreviewLines(note.body), [note.body]);

  return (
    <div>
      <div className="flex items-center gap-2.5 min-w-0">
        <NodeIconProvider
          node={note}
          className="text-gray-300 shrink-0 size-4"
        />
        <p className="text-base font-semibold text-gray-500 truncate">
          {note.name}
        </p>
      </div>
      {previewLines.length > 0 && (
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
      )}
    </div>
  );
}

function TrashFolderContent({ folder }: { folder: FolderNode }) {
  return (
    <>
      <IconFolder className="text-gray-300 shrink-0 size-4" />
      <span className="flex-1 text-base font-semibold text-gray-500 truncate">
        {folder.name}
      </span>
      <IconChevronRight className="text-gray-300 shrink-0 size-3.5" />
    </>
  );
}

function TrashMediaContent({ media }: { media: MediaFile }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <NodeIconProvider
        node={media}
        className="text-gray-300 shrink-0 size-4"
      />
      <p className="text-base font-semibold text-gray-500 truncate">
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
      className="w-full bg-gray-50 active:scale-[0.98] transition-transform"
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
