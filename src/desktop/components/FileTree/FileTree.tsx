import { useAtomValue } from "jotai";
import { dragOverAtom, folderPathAtom } from "../../../shared/lib/atoms";
import { useFileDrop } from "../../hooks/useFileDrop";
import { FileDragCtx } from "./FileDragCtx";
import { TreeNodes } from "./FileNode";

// ── Props ─────────────────────────────────────────────────────────────────────

interface FileTreeProps {
  nodes: import("../../../shared/hooks/useFileTree").TreeNode[];
  activeId: string | null;
}

// ── Export ────────────────────────────────────────────────────────────────────

export function FileTree({ nodes, activeId }: FileTreeProps) {
  const dnd = useFileDrop();
  const folderPath = useAtomValue(folderPathAtom);
  const dragOver = useAtomValue(dragOverAtom);
  const isRootOver = folderPath ? dragOver === folderPath : false;

  return (
    <FileDragCtx.Provider value={dnd}>
      <div
        data-dropzone={folderPath ?? undefined}
        className={`px-2 py-1 min-h-full transition-colors ${isRootOver ? "bg-amber-100/30" : ""}`}
      >
        <TreeNodes nodes={nodes} activeId={activeId} depth={0} />
      </div>
    </FileDragCtx.Provider>
  );
}
