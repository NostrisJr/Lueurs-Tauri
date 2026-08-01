import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  FolderNode,
  NoteFile,
  TreeNode,
} from "../../../shared/hooks/useFileTree";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import { useNote } from "../../../shared/hooks/useNote";
import { usePathPropagation } from "../../../shared/hooks/usePathPropagation";
import {
  activeSpaceAtom,
  dictaphoneModeAtom,
  filteredTreeAtom,
  folderPathAtom,
  folderStackAtom,
  inboxAbsPathAtom,
  vaultConfigAtom,
} from "../../../shared/lib/atoms";
import { sortNodes } from "../../../shared/lib/fileTreeHelpers";
import { NoteType } from "../../../shared/lib/noteTypes";
import { isAndroid, isIOS } from "../../../shared/lib/platform";
import { findFolderById } from "../../../shared/lib/spaceAssignment";
import {
  ALL_SPACE_ID,
  type VaultSpace,
  buildOrderedSpaces,
} from "../../../shared/lib/vaultConfig";
import { useMobileSelectNote } from "../../hooks/useMobileSelectNote";
import {
  DURATION,
  EASING,
  useMobileSwipeGesture,
} from "../../hooks/useMobileSwipeGesture";
import { usePushAnimation } from "../../hooks/usePushAnimation";
import { startDragAutoscroll } from "../../lib/dragAutoscroll";
import { hapticImpact } from "../../lib/haptics";
import { stopMomentumScroll } from "../../lib/momentumScroll";
import { MobileContextMenu } from "../BottomSheet/MobileContextMenu";
import { MobileSpaceSwitcher } from "../Floating/MobileSpaceSwitcher";
import { MobileRowGestures, NodePreviewCard } from "../Row";
import { FileRow } from "./FileRow";
import { FileTreeBottomBar } from "./FileTreeBottomBar";
import { FileTreeHeader } from "./FileTreeHeader";
import { FolderNoteCard } from "./FolderNoteCard";
import { useNodeMenuActions } from "./useNodeMenuActions";

// Déplacement de notes/médias vers un dossier depuis l'aperçu du menu contextuel
// (cf. MobileRowGestures) : non supporté sur Android (moveNode y est un no-op,
// cf. fileTreeMutations.ts).
const DRAG_TO_MOVE_ENABLED = !isAndroid;

interface DragState {
  id: string;
  name: string;
}

// Cible de dépôt sous le doigt. "parent" est la flèche de retour du header, qui
// pendant un déplacement ne navigue plus mais représente le dossier parent :
// y déposer déplace l'élément d'un niveau vers le haut. Faire *naviguer* le drag
// serait contradictoire — remonter d'un niveau démonte la rangée source, donc
// l'overlay et l'élément qui détient le pointer capture, et tue le geste.
type DropTarget = { kind: "folder"; id: string } | { kind: "parent" } | null;

// Réserve en bas de la liste pour que le contenu scrolle sous la barre flottante
// (FileTreeBottomBar, h-28 = 7rem) sans jamais être totalement recouvert sans recours :
// doit toujours excéder sa hauteur réelle (safe area comprise), sinon la liste peut
// "tenir" entièrement dans le conteneur (donc ne rien avoir à scroller) alors que ses
// dernières lignes sont visuellement cachées sous la barre.
//
// Implémentée comme un enfant à hauteur explicite (et non un padding-bottom sur le
// conteneur scrollable) : WebKit (WKWebView iOS) ne prend pas fiablement en compte le
// padding-bottom d'un conteneur flex-col en overflow dans son scrollHeight, donc le
// scroll ne se déclenchait qu'une fois les notes déjà débordantes par elles-mêmes.
const BOTTOM_BAR_RESERVE = "calc(7rem + env(safe-area-inset-bottom) + 1.5rem)";

function BottomBarSpacer() {
  return (
    <div className="w-full shrink-0" style={{ height: BOTTOM_BAR_RESERVE }} />
  );
}

interface NodeListProps {
  nodes: TreeNode[];
  onDrillIn: (folder: FolderNode) => void;
  dragOverFolderId?: string | null;
  onNodeDragStart?: (id: string, name: string) => void;
  onNodeDragMove?: (x: number, y: number) => void;
  onNodeDragEnd?: (x: number, y: number) => void;
  onNodeDragCancel?: () => void;
}

function NodeList({
  nodes,
  onDrillIn,
  dragOverFolderId = null,
  onNodeDragStart,
  onNodeDragMove,
  onNodeDragEnd,
  onNodeDragCancel,
}: NodeListProps) {
  const {
    handleDeleteNote,
    handleDeleteMedia,
    confirmDeleteFolder,
    commitDeleteFolder,
  } = useNote();
  const selectNote = useMobileSelectNote();
  const buildMenuActions = useNodeMenuActions();

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-12">Dossier vide</p>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      {nodes.map((node) => {
        const isFolder = node.kind === "folder";
        const { primary, items } = buildMenuActions(node);
        // Comportement unifié notes/dossiers : swipe (suppression) et appui long
        // (menu + déplacement, avec toute l'arborescence pour un dossier —
        // moveNode déplace le dossier entier, cf. fileTreeMutations.ts) sont
        // identiques pour les deux. Un dossier reste en plus une cible de dépôt.
        const row = (
          <MobileRowGestures
            onDelete={() => {
              if (isFolder) commitDeleteFolder(node);
              else if (node.kind === "media") handleDeleteMedia(node.id);
              else handleDeleteNote(node.id);
            }}
            confirmDelete={
              isFolder ? () => confirmDeleteFolder(node) : undefined
            }
            menu={{
              preview: <NodePreviewCard node={node} />,
              primary,
              items,
            }}
            onActivate={() => {
              if (node.kind === "folder") onDrillIn(node);
              else selectNote(node);
            }}
            dragEnabled={DRAG_TO_MOVE_ENABLED && !!onNodeDragStart}
            onDragStart={() => onNodeDragStart?.(node.id, node.name)}
            onDragMove={onNodeDragMove}
            onDragEnd={onNodeDragEnd}
            onDragCancel={onNodeDragCancel}
          >
            <FileRow node={node} onDrillIn={onDrillIn} />
          </MobileRowGestures>
        );
        return (
          <div key={node.id} className="w-11/12 mx-auto">
            {isFolder ? (
              <div
                data-dropzone-folder={node.id}
                className={clsx(
                  "rounded-[20px] transition-colors",
                  dragOverFolderId === node.id &&
                    "ring-2 ring-amber-400 bg-amber-50"
                )}
              >
                {row}
              </div>
            ) : (
              row
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MobileFileTree() {
  const tree = useAtomValue(filteredTreeAtom);
  const folderStack = useAtomValue(folderStackAtom);
  const setFolderStack = useSetAtom(folderStackAtom);
  const { createNote, moveNode } = useFileTree();
  const { propagateNoteRename } = usePathPropagation();
  const selectNote = useMobileSelectNote();
  const setDictaphoneMode = useSetAtom(dictaphoneModeAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const inboxPath = useAtomValue(inboxAbsPathAtom);
  const activeSpace = useAtomValue(activeSpaceAtom);
  const vaultConfig = useAtomValue(vaultConfigAtom);

  // ── Animation de changement d'espace (slide horizontal directionnel) ──
  // Direction selon la position de l'espace dans la liste ordonnée.
  const orderedSpaces = useMemo(
    () =>
      vaultConfig ? buildOrderedSpaces(vaultConfig.spaces, vaultConfig) : [],
    [vaultConfig]
  );
  const spaceOrder = useMemo(() => {
    const idx =
      activeSpace !== null
        ? orderedSpaces.findIndex(
            (e) =>
              e.id !== ALL_SPACE_ID && (e as VaultSpace).name === activeSpace
          )
        : orderedSpaces.findIndex((e) => e.id === ALL_SPACE_ID);
    return Math.max(0, idx);
  }, [orderedSpaces, activeSpace]);
  const prevSpaceRef = useRef(activeSpace);
  const prevOrderRef = useRef(spaceOrder);
  const tokenRef = useRef(0);
  const [spaceAnim, setSpaceAnim] = useState<{
    token: number;
    dir: "left" | "right";
  } | null>(null);

  useEffect(() => {
    if (prevSpaceRef.current === activeSpace) return;
    const dir = spaceOrder >= prevOrderRef.current ? "right" : "left";
    prevSpaceRef.current = activeSpace;
    prevOrderRef.current = spaceOrder;
    tokenRef.current += 1;
    setSpaceAnim({ token: tokenRef.current, dir });
  }, [activeSpace, spaceOrder]);

  // ── Déplacement d'une note/dossier vers un dossier (appui long) ──────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const stopAutoscrollRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopAutoscrollRef.current?.(), []);

  function handleNodeDragStart(id: string, name: string) {
    setDragState({ id, name });
    stopAutoscrollRef.current?.();
    stopAutoscrollRef.current = startDragAutoscroll({
      container: () => scrollContainerRef.current,
      point: () => pointerRef.current,
      onScroll: (x, y) => setDropTarget(findDropTarget(x, y)),
    });
  }

  // `elementsFromPoint` (pluriel) et non `elementFromPoint` : l'aperçu qui suit
  // le doigt est au-dessus de la liste, on traverse donc toute la pile jusqu'à
  // la première cible plutôt que de compter sur un `pointer-events: none` du
  // ghost — fragile en plein geste (le pointer capture est sur cet élément).
  // Les éléments arrivent du plus haut au plus bas : le header (z-10) l'emporte
  // donc naturellement sur la liste là où ils se recouvrent.
  const findDropTarget = useCallback((x: number, y: number): DropTarget => {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.closest("[data-dropzone-parent]")) return { kind: "parent" };
      const id = el.closest<HTMLElement>("[data-dropzone-folder]")?.dataset
        .dropzoneFolder;
      if (id) return { kind: "folder", id };
    }
    return null;
  }, []);

  function handleNodeDragMove(x: number, y: number) {
    pointerRef.current = { x, y };
    setDropTarget(findDropTarget(x, y));
  }

  function resetDrag() {
    stopAutoscrollRef.current?.();
    stopAutoscrollRef.current = null;
    setDragState(null);
    setDropTarget(null);
  }

  async function handleNodeDragEnd(x: number, y: number) {
    const source = dragState;
    // Recalculé sur les coordonnées finales : le dernier `move` peut dater d'un
    // peu avant le lâcher (notamment pendant l'autoscroll, où le doigt est immobile).
    const target = findDropTarget(x, y);
    resetDrag();
    if (!source || !target) return;
    const targetPath = target.kind === "parent" ? parentDropPath : target.id;
    if (!targetPath) return;
    hapticImpact("medium");
    const newPath = await moveNode(source.id, targetPath);
    if (newPath && source.id.endsWith(".md")) {
      await propagateNoteRename(source.id, newPath);
    }
  }

  const currentFolder = folderStack[folderStack.length - 1] ?? null;
  const parentFolder =
    folderStack.length >= 2
      ? (folderStack[folderStack.length - 2] ?? null)
      : undefined;
  const canGoBack = folderStack.length > 1;

  // Destination du dépôt sur la flèche de retour. `parentFolder === null` (et
  // non `undefined`) signifie « le parent est la racine du vault » : les ids de
  // nœuds sont des chemins absolus, folderPath en est un aussi.
  const parentDropPath =
    parentFolder === undefined
      ? null
      : (parentFolder?.id ?? folderPath ?? null);

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
    hapticImpact("light");
    const path = currentFolder?.id ?? inboxPath ?? folderPath ?? "";
    const note = await createNote(path, activeSpace);
    selectNote(note);
  }

  function handleCreateRecording() {
    setDictaphoneMode("new-note");
  }

  const currentNodes: TreeNode[] = currentFolder
    ? currentFolder.children
    : tree;

  const folderNote = useMemo<NoteFile | undefined>(
    () =>
      currentFolder
        ? (currentFolder.children.find(
            (child) => child.kind === "file" && child.type === NoteType.FOLDER
          ) as NoteFile | undefined)
        : undefined,
    [currentFolder]
  );

  const sortedNodes = useMemo(
    () =>
      sortNodes(
        currentNodes.filter(
          (node) => !(node.kind === "file" && node.type === NoteType.FOLDER)
        )
      ),
    [currentNodes]
  );

  const parentNodes: TreeNode[] = useMemo(() => {
    if (parentFolder === undefined) return [];
    return sortNodes(parentFolder ? parentFolder.children : tree);
  }, [parentFolder, tree]);

  // ── Animation drill-in (push vers sous-dossier) ──────────────
  // Les setters sont appelés dans le même handler d'événement React :
  // React 18 les batche en un seul render, donc drillFrom capture les anciens
  // nœuds pendant que sortedNodes reflète déjà le nouveau dossier.
  const [drillFrom, setDrillFrom] = useState<TreeNode[] | null>(null);
  const {
    phase: drillPhase,
    isActive: isDrilling,
    trigger: triggerDrill,
  } = usePushAnimation(DURATION);

  function handleDrillIn(folder: FolderNode) {
    hapticImpact("light");
    setDrillFrom([...sortedNodes]);
    triggerDrill();
    setFolderStack((prev) => [...prev, folder]);
  }

  function handleDrillOut() {
    setFolderStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  // ── Animation swipe retour (drill-out) ───────────────────────
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
    <div
      className={clsx(
        "relative flex flex-col w-full h-screen overflow-hidden select-none",
        isIOS ? " pt-24 " : "pt-14"
      )}
    >
      <div
        className={clsx(
          "absolute top-0 w-full h-fit bg-white shadow-lg shadow-gray-500/5 z-10",
          isIOS ? "pt-10" : "pt-4"
        )}
      >
        <FileTreeHeader
          dragActive={!!dragState && parentDropPath !== null}
          dropOverParent={dropTarget?.kind === "parent"}
          parentName={parentFolder?.name}
        />
      </div>

      {/* Zone de contenu avec transitions push et swipe */}
      <div className="relative flex-1 overflow-hidden">
        {showBgContent && (
          <div
            className="absolute inset-0 overflow-y-scroll pointer-events-none bg-gray-100"
            style={bgContentStyle}
          >
            <div className="flex flex-col gap-2 p-4">
              <NodeList nodes={bgNodes} onDrillIn={() => {}} />
              <BottomBarSpacer />
            </div>
          </div>
        )}

        <div
          ref={scrollContainerRef}
          data-mobile-scroll-container=""
          className="absolute inset-0 flex flex-col gap-0 py-4 bg-gray-100 overflow-y-scroll"
          style={contentStyle}
          // Un nouveau toucher sur la liste coupe net une inertie en cours (cf.
          // momentumScroll.ts) — comme n'importe quelle scrollview native. En
          // capture pour agir avant les handlers de la rangée touchée.
          onPointerDownCapture={() => {
            if (scrollContainerRef.current)
              stopMomentumScroll(scrollContainerRef.current);
          }}
          onTouchStart={touchHandlers.onTouchStart}
          onTouchMove={touchHandlers.onTouchMove}
          onTouchEnd={touchHandlers.onTouchEnd}
        >
          <div
            key={spaceAnim?.token ?? "static"}
            className={clsx(
              "w-full flex flex-col gap-2",
              spaceAnim?.dir === "right" && "space-slide-right",
              spaceAnim?.dir === "left" && "space-slide-left"
            )}
          >
            {folderNote && <FolderNoteCard note={folderNote} />}
            <NodeList
              nodes={sortedNodes}
              onDrillIn={handleDrillIn}
              dragOverFolderId={
                dropTarget?.kind === "folder" ? dropTarget.id : null
              }
              onNodeDragStart={handleNodeDragStart}
              onNodeDragMove={handleNodeDragMove}
              onNodeDragEnd={handleNodeDragEnd}
              onNodeDragCancel={resetDrag}
            />
          </div>
          <BottomBarSpacer />
        </div>
      </div>

      {/* Pas de ghost ici : c'est la carte d'aperçu du menu contextuel qui suit
          le doigt pendant le déplacement (cf. RowContextMenu). */}

      <MobileSpaceSwitcher />

      <MobileContextMenu />

      <FileTreeBottomBar
        onCreateNote={handleCreateNote}
        onCreateRecording={handleCreateRecording}
      />
    </div>
  );
}
