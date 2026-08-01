import clsx from "clsx";
import { useMemo } from "react";
import { NodeIconProvider } from "../../../shared/components/NodeIconProvider";
import { IconFolder } from "../../../shared/components/PlatformIcon";
import type { TreeNode } from "../../../shared/hooks/useFileTree";
import { MEDIA_LABEL, getPreviewLines } from "../FileTree/helpers";

// Nombre de lignes du corps affichées dans l'aperçu soulevé. Volontairement
// généreux (l'aperçu iOS montre le début du document) : la carte est ensuite
// écrêtée par la hauteur disponible, calculée par RowContextMenu.
const PREVIEW_LINES = 14;

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
  const lines = useMemo(
    () =>
      node.kind === "file" ? getPreviewLines(node.body, PREVIEW_LINES) : [],
    [node]
  );

  const titleClass = clsx(
    "text-lg font-semibold truncate",
    muted ? "text-gray-500" : "text-gray-900"
  );

  if (node.kind === "folder") {
    const count = node.children.length;
    return (
      <div className="flex items-center gap-3 px-5 py-4">
        <IconFolder className="text-yellow-500 shrink-0 size-6" />
        <div className="min-w-0">
          <p className={titleClass}>{node.name}</p>
          <p className="text-sm text-gray-400">
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
        <NodeIconProvider
          node={node}
          className="text-gray-400 shrink-0 size-6"
        />
        <div className="min-w-0">
          <p className={titleClass}>{node.name}</p>
          <p className="text-sm text-gray-400">
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
      {lines.length > 0 ? (
        <div className="space-y-1">
          {lines.map((line, i) => (
            <p
              // biome-ignore lint/suspicious/noArrayIndexKey: lignes statiques
              key={i}
              className="text-base text-gray-500 truncate leading-snug"
            >
              {line}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-base text-gray-400 italic">Note vide</p>
      )}
    </div>
  );
}
