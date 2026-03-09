import type { TreeNode } from "./useFileTree";
import { FolderNodeComponent, FileNodeComponent } from "./FileNode";

// ── Props ─────────────────────────────────────────────────────────────────────

interface FileTreeProps {
  nodes: TreeNode[];
  activeId: string | null;
}

// ── Rendu récursif des nœuds ──────────────────────────────────────────────────

export function TreeNodes({
  nodes,
  activeId,
  depth,
}: {
  nodes: TreeNode[];
  activeId: string | null;
  depth: number;
}) {
  return (
    <div className="overflow-hidden">
      {nodes.map((node) =>
        node.kind === "folder" ? (
          <FolderNodeComponent
            key={node.id}
            node={node}
            activeId={activeId}
            depth={depth}
          />
        ) : (
          <FileNodeComponent
            key={node.id}
            node={node}
            activeId={activeId}
            depth={depth}
          />
        )
      )}
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export function FileTree({ nodes, activeId }: FileTreeProps) {
  return (
    <div className="px-2 py-1 overflow-scroll">
      <TreeNodes nodes={nodes} activeId={activeId} depth={0} />
    </div>
  );
}
