import {
  sfTrash,
  sfChevronDown,
  sfChevronRight,
  sfFolder,
  sfPlus,
  sfFolderBadgePlus,
} from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { useState } from "react";
import { useAtomValue } from "jotai";
import { dragSourceAtom, dragOverAtom } from "../../lib/atoms.ts";
import {
  type NoteFile,
  type FolderNode,
  type TreeNode,
  useFileTree,
} from "./hooks/useFileTree";
import { useNote } from "../../hooks/useNote";
import { EditableText } from "../EditableText";
import { useFileDragCtx } from "./FileDragCtx";
import { NodeIconProvider } from "./NodeIconProvider.tsx";

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

// ── Nœud fichier ──────────────────────────────────────────────────────────────

function FileNodeComponent({
  node,
  activeId,
  depth,
}: {
  node: NoteFile;
  activeId: string | null;
  depth: number;
}) {
  const isActive = activeId === node.id;
  const { handleSelectNote, handleDeleteNote, handleRename } = useNote();
  const dnd = useFileDragCtx();
  const dragSource = useAtomValue(dragSourceAtom);
  const isDragging = dragSource === node.id;

  return (
    <div
      onPointerDown={(e) => dnd.onPointerDown(e, node.id, node.name)}
      onClick={(e) => handleSelectNote(node, e.metaKey)}
      onKeyDown={(e) => e.key === "Enter" && handleSelectNote(node)}
      className={`select-none group flex justify-between items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer transition-colors
                 ${
                   isActive
                     ? "bg-white shadow-sm inset-ring inset-ring-gray-200"
                     : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                 }
                 ${isDragging ? "opacity-40" : ""}`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
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
        <SFIcon icon={sfTrash} className="size-3" aria-hidden="true" />
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

  // La note __folder__ est celle qui porte exactement le même nom que ce dossier
  const folderNoteId = `${node.id}/${node.name}.md`;
  const isActive = activeId === folderNoteId;

  // Masquer la note __folder__ du même nom dans la liste des enfants
  const visibleChildren = node.children.filter(
    (child) => !(child.kind === "file" && child.name === node.name)
  );

  return (
    <div data-dropzone={node.id} className={isDragging ? "opacity-40" : ""}>
      {/* En-tête du dossier */}
      <div
        onPointerDown={(e) => dnd.onPointerDown(e, node.id, node.name)}
        className={`select-none group flex items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer transition-colors
                    ${
                      isActive
                        ? "bg-white shadow-sm inset-ring inset-ring-gray-200 text-gray-700"
                        : isOver
                          ? "bg-amber-400/20 text-gray-700"
                          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* Flèche : toggle seul */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="shrink-0 p-0.5 rounded hover:bg-gray-200 transition-colors"
          aria-label={open ? "Fermer le dossier" : "Ouvrir le dossier"}
        >
          <SFIcon
            icon={open ? sfChevronDown : sfChevronRight}
            className="size-3 text-gray-400"
            aria-hidden="true"
          />
        </button>

        {/* Icône + nom : ouvre la note __folder__ */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
        <div
          className="flex items-center gap-2 min-w-0 flex-1"
          onClick={(e) => {
            setOpen(true);
            handleOpenFolder(node, e.metaKey);
          }}
        >
          <SFIcon
            icon={sfFolder}
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
            <SFIcon icon={sfPlus} className="size-3 m-1" aria-hidden="true" />
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
            <SFIcon
              icon={sfFolderBadgePlus}
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
            <SFIcon icon={sfTrash} className="size-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Enfants */}
      {open && visibleChildren.length > 0 && (
        <div
          className={`border-l select-none transition-colors ${isOver ? "border-amber-300/70 bg-amber-100/30" : "border-gray-200"}`}
          style={{ marginLeft: `${depth * 12 + 16}px` }}
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
          style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
        >
          Vide
        </p>
      )}
    </div>
  );
}

export { FileNodeComponent, FolderNodeComponent };
