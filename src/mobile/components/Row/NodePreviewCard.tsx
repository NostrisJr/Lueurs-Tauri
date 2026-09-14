import clsx from "clsx";
import { useMemo } from "react";
import { NodeIconProvider } from "../../../shared/components/NodeIconProvider";
import { IconFolder } from "../../../shared/components/PlatformIcon";
import type { TreeNode } from "../../../shared/hooks/useFileTree";
import { MarkdownPreview } from "../FileTree/MarkdownPreview";
import { MEDIA_LABEL } from "../FileTree/helpers";
import { parsePreviewBlocks } from "../FileTree/parseMarkdownPreview";

// Plafond de blocs du corps affichés dans l'aperçu soulevé. Volontairement
// généreux (l'aperçu iOS montre le début du document) : la carte est ensuite
// écrêtée par la hauteur disponible, calculée par RowContextMenu.
const PREVIEW_MAX_BLOCKS = 20;

interface Props {
  node: TreeNode;
  /** Palette éteinte (corbeille). */
  muted?: boolean;
}

/**
 * Carte d'aperçu affichée au long press. Note : titre + premières lignes du
 * corps (jamais le rendu markdown complet — c'est un aperçu, pas une lecture).
 * Dossier/média : carte compacte, il n'y a rien de pertinent à agrandir.
 */
export function NodePreviewCard({ node, muted }: Props) {
  const blocks = useMemo(
    () =>
      node.kind === "file"
        ? parsePreviewBlocks(node.body, PREVIEW_MAX_BLOCKS)
        : [],
    [node]
  );

  const titleClass = clsx(
    "text-lg font-semibold truncate",
    muted ? "text-ink-3" : "text-ink"
  );

  if (node.kind === "folder") {
    const count = node.children.length;
    return (
      <div className="flex items-center gap-3 px-5 py-4">
        <IconFolder className="text-accent shrink-0 size-6" />
        <div className="min-w-0">
          <p className={titleClass}>{node.name}</p>
          <p className="text-sm text-ink-4">
            {count === 0
              ? "Dossier vide"
              : `${count} élément${count > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>
    );
  }

  if (node.kind === "media") {
    return (
      <div className="flex items-center gap-3 px-5 py-4">
        <NodeIconProvider node={node} className="text-ink-4 shrink-0 size-6" />
        <div className="min-w-0">
          <p className={titleClass}>{node.name}</p>
          <p className="text-sm text-ink-4">
            {MEDIA_LABEL[node.mediaType] ?? node.mediaType} ·{" "}
            {node.fileName.split(".").pop()?.toUpperCase()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <p className={clsx(titleClass, "mb-1.5")}>{node.name}</p>
      {blocks.length > 0 ? (
        <MarkdownPreview
          blocks={blocks}
          spaced
          respectLineBreaks
          className="text-base text-ink-3 leading-snug"
        />
      ) : (
        <p className="text-base text-ink-4 italic">Note vide</p>
      )}
    </div>
  );
}
