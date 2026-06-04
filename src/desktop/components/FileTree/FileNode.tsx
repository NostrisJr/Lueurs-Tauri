import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useState } from "react";
import { EditableText } from "../../../shared/components/EditableText";
import { NodeIconProvider } from "../../../shared/components/NodeIconProvider.tsx";
import {
  IconChevronDown,
  IconChevronRight,
  IconFolder,
  IconFolderBadgePlus,
  IconPlus,
  IconTrash,
} from "../../../shared/components/PlatformIcon";
import {
  type FolderNode,
  type MediaFile,
  type NoteFile,
  type TreeNode,
  useFileTree,
} from "../../../shared/hooks/useFileTree";
import { useNote } from "../../../shared/hooks/useNote";
import {
  activeNoteIdAtom,
  dragOverAtom,
  dragSourceAtom,
  openTabIdsAtom,
  selectedIdsAtom,
  selectionAnchorAtom,
  treeAtom,
} from "../../../shared/lib/atoms";
import { vaultIO } from "../../../shared/lib/vaultIO";
import { useFileDragCtx } from "./FileDragCtx";

// ── Helpers range selection ────────────────────────────────────────────────────

// Collecte tous les IDs descendants d'un nœud dossier (notes + médias + sous-dossiers).
function collectDescendantIds(
  nodes: TreeNode[],
  folderId: string,
  out: Set<string>
): boolean {
  for (const node of nodes) {
    if (node.id === folderId && node.kind === "folder") {
      function addAll(ns: TreeNode[]) {
        for (const n of ns) {
          out.add(n.id);
          if (n.kind === "folder") addAll(n.children);
        }
      }
      addAll(node.children);
      return true;
    }
    if (
      node.kind === "folder" &&
      collectDescendantIds(node.children, folderId, out)
    )
      return true;
  }
  return false;
}

// Calcule la sélection par plage depuis l'ancre jusqu'à targetId via l'ordre DOM.
// Les dossiers dans la plage incluent aussi tous leurs descendants (depuis treeAtom).
function computeRangeSelection(
  anchorId: string,
  targetId: string,
  tree: TreeNode[]
): Set<string> {
  const allVisible = Array.from(
    document.querySelectorAll<HTMLElement>("[data-node-id]")
  ).map((el) => el.dataset.nodeId!);

  const anchorIdx = allVisible.indexOf(anchorId);
  const targetIdx = allVisible.indexOf(targetId);
  if (anchorIdx < 0 || targetIdx < 0) return new Set([targetId]);

  const start = Math.min(anchorIdx, targetIdx);
  const end = Math.max(anchorIdx, targetIdx);
  const rangeIds = allVisible.slice(start, end + 1);

  const result = new Set<string>();
  for (const id of rangeIds) {
    result.add(id);
    // Si c'est un dossier, ajouter tous ses descendants
    const hasExt = /\.[^/]+$/.test(id.split("/").pop() ?? "");
    if (!hasExt) {
      collectDescendantIds(tree, id, result);
    }
  }
  return result;
}

// ── Styles partagés ────────────────────────────────────────────────────────────

const ROW_BASE =
  "select-none group justify-between flex items-center gap-1.5 rounded-lg px-2 py-1.5 pl-2 cursor-pointer";
export const ROW_ACTIVE = "liquid-glass bg-white/90";
export const ROW_INACTIVE =
  "text-gray-600 hover:bg-white/80 hover:text-gray-800";
const ROW_DRAGGING = "opacity-40";
const rowIndent = 8;

// ── Rendu récursif ─────────────────────────────────────────────────────────────

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
    <div className="gap-1 flex flex-col w-full">
      {nodes.map((node) =>
        node.kind === "folder" ? (
          <FolderNodeComponent
            key={node.id}
            node={node}
            activeId={activeId}
            depth={depth}
          />
        ) : node.kind === "media" ? (
          <MediaNodeComponent key={node.id} node={node} activeId={activeId} />
        ) : (
          <FileNodeComponent key={node.id} node={node} activeId={activeId} />
        )
      )}
    </div>
  );
}

// ── Nœud fichier ──────────────────────────────────────────────────────────────

function FileNodeComponent({
  node,
  activeId,
}: {
  node: NoteFile;
  activeId: string | null;
}) {
  const isActive = activeId === node.id;
  const { handleSelectNote, handleDeleteNote, handleRename } = useNote();
  const dnd = useFileDragCtx();
  const dragSource = useAtomValue(dragSourceAtom);
  const isDragging = dragSource === node.id;
  const [selectedIds, setSelectedIds] = useAtom(selectedIdsAtom);
  const [anchor, setAnchor] = useAtom(selectionAnchorAtom);
  const isSelected = selectedIds.has(node.id);
  const store = useStore();

  function handleClick(e: React.MouseEvent) {
    if (e.shiftKey) {
      e.preventDefault();
      if (anchor) {
        setSelectedIds(
          computeRangeSelection(anchor, node.id, store.get(treeAtom))
        );
      } else {
        setSelectedIds(new Set([node.id]));
        setAnchor(node.id);
      }
    } else {
      setSelectedIds(new Set());
      setAnchor(node.id);
      handleSelectNote(node, e.metaKey);
    }
  }

  return (
    <>
      <div
        data-node-id={node.id}
        onPointerDown={(e) => dnd.onPointerDown(e, node.id, node.name)}
        onClick={handleClick}
        onKeyDown={(e) => e.key === "Enter" && handleSelectNote(node)}
        onContextMenu={(e) => dnd.onContextMenu(e, node.id, "file")}
        className={`${ROW_BASE} ${isActive || isSelected ? ROW_ACTIVE : ROW_INACTIVE} ${isDragging ? ROW_DRAGGING : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <NodeIconProvider
            node={node}
            className="size-4 text-gray-400 shrink-0"
          />
          <EditableText
            value={node.name}
            onSave={async (newName) => {
              await handleRename(node.id, newName, false);
            }}
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteNote(node.id);
          }}
          aria-label={`Mettre ${node.name} à la poubelle`}
          title="Mettre à la poubelle"
          className="hidden group-hover:block rounded text-gray-300 hover:text-red-400 transition-all cursor-pointer"
        >
          <IconTrash className="size-3" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

// ── Nœud média ────────────────────────────────────────────────────────────────

function MediaNodeComponent({
  node,
  activeId,
}: {
  node: MediaFile;
  activeId: string | null;
}) {
  const isActive = activeId === node.id;
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
  const [openTabIds, setOpenTabIds] = useAtom(openTabIdsAtom);
  const { handleSelectNote, handleDeleteMedia } = useNote();
  const { reload } = useFileTree();
  const dnd = useFileDragCtx();
  const dragSource = useAtomValue(dragSourceAtom);
  const isDragging = dragSource === node.id;
  const [selectedIds, setSelectedIds] = useAtom(selectedIdsAtom);
  const [anchor, setAnchor] = useAtom(selectionAnchorAtom);
  const isSelected = selectedIds.has(node.id);
  const store = useStore();

  function handleClick(e: React.MouseEvent) {
    if (e.shiftKey) {
      e.preventDefault();
      if (anchor) {
        setSelectedIds(
          computeRangeSelection(anchor, node.id, store.get(treeAtom))
        );
      } else {
        setSelectedIds(new Set([node.id]));
        setAnchor(node.id);
      }
    } else {
      setSelectedIds(new Set());
      setAnchor(node.id);
      handleSelectNote(node, e.metaKey);
    }
  }

  async function handleRename(newName: string) {
    const dotIdx = node.fileName.lastIndexOf(".");
    const ext = dotIdx > 0 ? node.fileName.slice(dotIdx) : "";
    const newFileName = `${newName}${ext}`;
    const parentPath = node.id.split("/").slice(0, -1).join("/");
    const newId = `${parentPath}/${newFileName}`;
    await vaultIO.rename(node.id, newFileName);
    if (openTabIds.includes(node.id)) {
      setOpenTabIds(openTabIds.map((id) => (id === node.id ? newId : id)));
    }
    setActiveNoteId(newId);
    reload();
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
    <div
      data-node-id={node.id}
      onPointerDown={(e) => dnd.onPointerDown(e, node.id, node.name)}
      onClick={handleClick}
      onContextMenu={(e) => dnd.onContextMenu(e, node.id, "media")}
      className={`${ROW_BASE} ${isActive || isSelected ? ROW_ACTIVE : ROW_INACTIVE} ${isDragging ? ROW_DRAGGING : ""}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <NodeIconProvider
          node={node}
          className="size-4 text-gray-400 shrink-0"
        />
        <EditableText value={node.name} onSave={handleRename} />
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleDeleteMedia(node.id);
        }}
        aria-label={`Mettre ${node.name} à la poubelle`}
        title="Mettre à la poubelle"
        className="hidden group-hover:block rounded text-gray-300 hover:text-red-400 transition-all cursor-pointer"
      >
        <IconTrash className="size-3" aria-hidden="true" />
      </button>
    </div>
  );
}

// ── Nœud dossier ──────────────────────────────────────────────────────────────

function FolderNodeComponent({
  node,
  activeId,
  depth,
}: {
  node: FolderNode;
  activeId: string | null;
  depth: number;
}) {
  const [open, setOpen] = useState(depth === 0);

  const { createNote, createFolder } = useFileTree();
  const { handleRename, handleDeleteFolder, handleOpenFolder } = useNote();
  const dnd = useFileDragCtx();
  const dragSource = useAtomValue(dragSourceAtom);
  const dragOver = useAtomValue(dragOverAtom);
  const isDragging = dragSource === node.id;
  const isOver = dragOver === node.id;
  const [selectedIds, setSelectedIds] = useAtom(selectedIdsAtom);
  const [anchor, setAnchor] = useAtom(selectionAnchorAtom);
  const isSelected = selectedIds.has(node.id);
  const store = useStore();

  // La note __folder__ est celle qui porte exactement le même nom que ce dossier
  const folderNoteId = `${node.id}/${node.name}.md`;
  const isActive = activeId === folderNoteId;

  // Masquer la note __folder__ du même nom dans la liste des enfants
  const visibleChildren = node.children.filter(
    (child) => !(child.kind === "file" && child.name === node.name)
  );

  function handleFolderShiftClick(e: React.MouseEvent) {
    if (!e.shiftKey) return;
    e.preventDefault();
    e.stopPropagation();
    if (anchor) {
      setSelectedIds(
        computeRangeSelection(anchor, node.id, store.get(treeAtom))
      );
    } else {
      // Sélectionner le dossier + tous ses descendants
      const ids = new Set([node.id]);
      collectDescendantIds(store.get(treeAtom), node.id, ids);
      setSelectedIds(ids);
      setAnchor(node.id);
    }
  }

  return (
    <>
      <div data-dropzone={node.id} className={isDragging ? ROW_DRAGGING : ""}>
        {/* En-tête du dossier */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
        <div
          data-node-id={node.id}
          onPointerDown={(e) => dnd.onPointerDown(e, node.id, node.name)}
          onClick={handleFolderShiftClick}
          onContextMenu={(e) => dnd.onContextMenu(e, node.id, "folder")}
          className={`${ROW_BASE} ${isActive || isSelected ? ROW_ACTIVE : isOver ? "bg-amber-400/20 text-gray-700" : ROW_INACTIVE}`}
        >
          {/* Flèche : toggle seul */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="shrink-0 p-0.5 transition-colors"
            aria-label={open ? "Fermer le dossier" : "Ouvrir le dossier"}
          >
            {open ? (
              <IconChevronDown
                className="size-3 text-gray-400"
                aria-hidden="true"
              />
            ) : (
              <IconChevronRight
                className="size-3 text-gray-400"
                aria-hidden="true"
              />
            )}
          </button>

          {/* Icône + nom : ouvre la note __folder__ (ou shift-sélectionne) */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
          <div
            className="flex items-center gap-2 min-w-0 flex-1"
            onClick={(e) => {
              if (e.shiftKey) return; // géré par le parent
              setOpen(true);
              setSelectedIds(new Set());
              setAnchor(node.id);
              handleOpenFolder(node, e.metaKey);
            }}
          >
            <IconFolder
              className="size-4 text-gray-400 shrink-0"
              aria-hidden="true"
            />
            <EditableText
              value={node.name}
              onSave={async (newName) => {
                await handleRename(node.id, newName, true);
              }}
            />
          </div>

          {/* Actions dossier (visibles au hover) */}
          <div className="hidden relative right-0 group-hover:flex items-center gap-1.5 transition-opacity z-10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                createNote(node.id);
              }}
              aria-label="Nouvelle note dans ce dossier"
              title="Nouvelle note"
              className="rounded text-gray-400 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <IconPlus className="size-3 m-1" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                createFolder(node.id);
              }}
              aria-label="Nouveau sous-dossier"
              title="Nouveau dossier"
              className="rounded text-gray-400 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <IconFolderBadgePlus
                className="size-3.5 m-1"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFolder(node);
              }}
              aria-label={`Mettre ${node.name} à la poubelle`}
              title="Mettre à la poubelle"
              className="rounded text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
            >
              <IconTrash className="size-3" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Enfants */}
        {open && visibleChildren.length > 0 && (
          <div
            className={`border-l pl-1 select-none  transition-colors ${isOver ? "border-amber-300/70 bg-amber-100/30" : "border-gray-400/30"}`}
            style={{ marginLeft: `${rowIndent * 2}px` }}
          >
            <TreeNodes
              nodes={visibleChildren}
              activeId={activeId}
              depth={depth + 1}
            />
          </div>
        )}

        {/* Dossier vide */}
        {open && visibleChildren.length === 0 && (
          <p
            className={`text-xs py-1 transition-colors ${isOver ? "text-amber-400" : "text-gray-300"}`}
            style={{ paddingLeft: `${(depth + 1) * rowIndent + 8}px` }}
          >
            Vide
          </p>
        )}
      </div>
    </>
  );
}

export { FileNodeComponent, FolderNodeComponent, MediaNodeComponent };
