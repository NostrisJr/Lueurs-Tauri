import { createContext, useContext } from "react";
import type { FileDrop } from "../../hooks/useFileDrop";

export const FileDragCtx = createContext<FileDrop | null>(null);

export function useFileDragCtx(): FileDrop {
    const ctx = useContext(FileDragCtx);
    if (!ctx) throw new Error("useFileDragCtx doit être utilisé dans FileTree");
    return ctx;
}
