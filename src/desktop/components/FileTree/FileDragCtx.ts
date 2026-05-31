import { createContext, useContext } from "react";
import type { FileDrop } from "../../hooks/useFileDrop";
import type { NodeKind } from "../../hooks/useNodeContextMenu";

export interface FileActions extends FileDrop {
  onContextMenu: (
    e: React.MouseEvent,
    nodeId: string,
    nodeKind: NodeKind
  ) => void;
}

export const FileDragCtx = createContext<FileActions | null>(null);

export function useFileDragCtx(): FileActions {
  const ctx = useContext(FileDragCtx);
  if (!ctx) throw new Error("useFileDragCtx doit être utilisé dans FileTree");
  return ctx;
}
