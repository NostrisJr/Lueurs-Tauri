import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FolderNode, TreeNode } from "../../../shared/hooks/useFileTree";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import {
  dictaphoneModeAtom,
  folderStackAtom,
  mobileContextMenuAtom,
  treeAtom,
} from "../../../shared/lib/Atoms";
import { useMobileSelectNote } from "../../hooks/useMobileSelectNote";
import {
  DURATION,
  EASING,
  useMobileSwipeGesture,
} from "../../hooks/useMobileSwipeGesture";
import { hapticImpact } from "../../lib/haptics";
import { MobileContextMenu } from "../BottomSheet/MobileContextMenu";
import { FileTreeBottomBar } from "./FileTreeBottomBar";
import { FileRow } from "./FileRow";
import { FileTreeHeader } from "./FileTreeHeader";

function findFolderById(nodes: TreeNode[], id: string): FolderNode | null {
  for (const node of nodes) {
    if (node.kind !== "folder") continue;
    if (node.id === id) return node;
    const found = findFolderById(node.children, id);
    if (found) return found;
  }
  return null;
}

interface NodeListProps {
  nodes: TreeNode[];
  onDrillIn: (folder: FolderNode) => void;
}

function NodeList({ nodes, onDrillIn }: NodeListProps) {
  const setContextMenu = useSetAtom(mobileContextMenuAtom);

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-12">Dossier vide</p>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      {nodes.map((node) => (
        <div key={node.id} className="w-11/12 mx-auto">
          <FileRow
            node={node}
            onDrillIn={onDrillIn}
            onLongPress={() =>
              setContextMenu({
                id: node.id,
                name: node.name,
                isFolder: node.kind === "folder",
              })
            }
          />
        </div>
      ))}
    </div>
  );
}

const NOOP_DRILL = () => {};

export function MobileFileTree() {
  const tree = useAtomValue(treeAtom);
  const folderStack = useAtomValue(folderStackAtom);
  const setFolderStack = useSetAtom(folderStackAtom);
  const { createNote } = useFileTree();
  const selectNote = useMobileSelectNote();
  const setDictaphoneMode = useSetAtom(dictaphoneModeAtom);

  const currentFolder = folderStack[folderStack.length - 1] ?? null;
  const parentFolder =
    folderStack.length >= 2
      ? (folderStack[folderStack.length - 2] ?? null)
      : undefined;
  const canGoBack = folderStack.length > 1;

  // Sync les FolderNodes de la pile avec le treeAtom (renames, FS updates)
  useEffect(() => {
    if (!tree.length) return;
    setFolderStack((prev) =>
      prev.map((f) => {
        if (!f) return f;
        return findFolderById(tree, f.id) ?? f;
      })
    );
  }, [tree, setFolderStack]);

  async function handleCreateNote() {
    const path = currentFolder?.id ?? "";
    const note = await createNote(path);
    selectNote(note);
  }

  function handleCreateRecording() {
    setDictaphoneMode("new-note");
  }

  const currentNodes: TreeNode[] = currentFolder
    ? currentFolder.children
    : tree;

  const sortedNodes = useMemo(
    () =>
      [...currentNodes].sort((a, b) => {
        if (a.kind === b.kind)
          return a.name.localeCompare(b.name, "fr", { numeric: true });
        return a.kind === "folder" ? -1 : 1;
      }),
    [currentNodes]
  );

  const parentNodes: TreeNode[] = useMemo(() => {
    if (parentFolder === undefined) return [];
    const nodes = parentFolder ? parentFolder.children : tree;
    return [...nodes].sort((a, b) => {
      if (a.kind === b.kind)
        return a.name.localeCompare(b.name, "fr", { numeric: true });
      return a.kind === "folder" ? -1 : 1;
    });
  }, [parentFolder, tree]);

  // ── Animation drill-in (push vers sous-dossier) ──────────────
  // Les trois setters sont appelés dans le même handler d'événement React :
  // React 18 les batche en un seul render, donc drillFrom capture les anciens
  // nœuds pendant que sortedNodes reflète déjà le nouveau dossier.
  const isDrillingRef = useRef(false);
  const [drillFrom, setDrillFrom] = useState<TreeNode[] | null>(null);
  const [drillPhase, setDrillPhase] = useState<"initial" | "animating" | null>(
    null
  );
  const drillRafRef = useRef<number>(0);
  const drillTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  useEffect(() => {
    if (drillPhase !== "initial") return;
    drillRafRef.current = requestAnimationFrame(() => {
      setDrillPhase("animating");
      clearTimeout(drillTimeoutRef.current);
      drillTimeoutRef.current = setTimeout(() => {
        setDrillFrom(null);
        setDrillPhase(null);
        isDrillingRef.current = false;
      }, DURATION);
    });
    return () => cancelAnimationFrame(drillRafRef.current);
  }, [drillPhase]);

  function handleDrillIn(folder: FolderNode) {
    hapticImpact("light");
    if (!isDrillingRef.current) {
      isDrillingRef.current = true;
      setDrillFrom([...sortedNodes]);
      setDrillPhase("initial");
    }
    setFolderStack((prev) => [...prev, folder]);
  }

  function handleDrillOut() {
    setFolderStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  // ── Animation swipe retour (drill-out) ───────────────────────
  const isDrilling = drillPhase !== null && drillFrom !== null;

  const { swipeProgress, isAnimating, touchHandlers } = useMobileSwipeGesture(
    handleDrillOut,
    { enabled: canGoBack && !isDrilling }
  );
  const isSwipingBack = swipeProgress > 0 || isAnimating;

  // ── Styles ────────────────────────────────────────────────────
  const showBgContent = isDrilling || isSwipingBack;
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  const bgNodes = isDrilling ? drillFrom! : parentNodes;

  const bgContentStyle: React.CSSProperties = isDrilling
    ? drillPhase === "animating"
      ? {
          transform: "translateX(-30%)",
          transition: `transform ${DURATION}ms ${EASING}`,
          willChange: "transform",
        }
      : { transform: "translateX(0%)" }
    : {
        transform: `translateX(${(-30 + swipeProgress * 30).toFixed(1)}%)`,
        transition: isAnimating ? `transform ${DURATION}ms ${EASING}` : "none",
        willChange: "transform",
      };

  const contentStyle: React.CSSProperties = isDrilling
    ? drillPhase === "initial"
      ? { transform: "translateX(100%)" }
      : {
          transform: "translateX(0%)",
          transition: `transform ${DURATION}ms ${EASING}`,
          willChange: "transform",
          boxShadow: "-6px 0 20px rgba(0,0,0,0.10)",
        }
    : isSwipingBack
      ? {
          transform: `translateX(${(swipeProgress * 100).toFixed(1)}%)`,
          transition: isAnimating
            ? `transform ${DURATION}ms ${EASING}`
            : "none",
          boxShadow:
            swipeProgress > 0 ? "-6px 0 20px rgba(0,0,0,0.10)" : undefined,
          willChange: "transform",
        }
      : {};

  return (
    <div className="relative flex flex-col pt-24 w-full h-screen overflow-hidden select-none">
      <div className="absolute top-0 w-full h-fit pt-10 bg-white shadow-lg shadow-gray-500/5 z-10">
        <FileTreeHeader />
      </div>

      {/* Zone de contenu avec transitions push et swipe */}
      <div className="relative flex-1 overflow-hidden">
        {showBgContent && (
          <div
            className="absolute inset-0 overflow-y-scroll pointer-events-none bg-gray-100"
            style={bgContentStyle}
          >
            <div className="flex flex-col gap-2 p-4 pb-20">
              <NodeList nodes={bgNodes} onDrillIn={NOOP_DRILL} />
            </div>
          </div>
        )}

        <div
          className="absolute inset-0 flex flex-col gap-0 py-4 bg-gray-100 overflow-y-scroll pb-30"
          style={contentStyle}
          onTouchStart={touchHandlers.onTouchStart}
          onTouchMove={touchHandlers.onTouchMove}
          onTouchEnd={touchHandlers.onTouchEnd}
        >
          <NodeList nodes={sortedNodes} onDrillIn={handleDrillIn} />
        </div>
      </div>

      <MobileContextMenu />

      <FileTreeBottomBar
        onCreateNote={handleCreateNote}
        onCreateRecording={handleCreateRecording}
      />
    </div>
  );
}
