import {
  sfChevronDown,
  sfChevronRight,
  sfFolder,
  sfFolderBadgePlus,
  sfPlus,
  sfTrash,
} from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { useAtomValue } from "jotai";
import { useRef, useState } from "react";
import {
  EditableText,
  type EditableTextHandle,
} from "../../../shared/components/EditableText";
import { NodeIconProvider } from "../../../shared/components/NodeIconProvider.tsx";
import {
  type FolderNode,
  type NoteFile,
  type TreeNode,
  useFileTree,
} from "../../../shared/hooks/useFileTree";
import { useNote } from "../../../shared/hooks/useNote";
import { dragOverAtom, dragSourceAtom } from "../../../shared/lib/Atoms";
import { useFileDragCtx } from "./FileDragCtx";

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
        // TODO : pourquoi j'utilise autre chose que NoteType.FOLDER ???
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
  const editableRef = useRef<EditableTextHandle | null>(null);

  return (
    <>
      <div
        onPointerDown={(e) => dnd.onPointerDown(e, node.id, node.name)}
        onClick={(e) => handleSelectNote(node, e.metaKey)}
        onKeyDown={(e) => e.key === "Enter" && handleSelectNote(node)}
        className={`${ROW_BASE} ${isActive ? ROW_ACTIVE : ROW_INACTIVE} ${isDragging ? ROW_DRAGGING : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <NodeIconProvider
            node={node}
            className="size-4 text-gray-400 shrink-0"
          />
          <EditableText
            ref={editableRef}
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
    </>
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
  const editableRef = useRef<EditableTextHandle | null>(null);

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
    <>
      <div data-dropzone={node.id} className={isDragging ? ROW_DRAGGING : ""}>
        {/* En-tête du dossier */}
        <div
          onPointerDown={(e) => dnd.onPointerDown(e, node.id, node.name)}
          className={`${ROW_BASE} ${isActive ? ROW_ACTIVE : isOver ? "bg-amber-400/20 text-gray-700" : ROW_INACTIVE}`}
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
              ref={editableRef}
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

export { FileNodeComponent, FolderNodeComponent };
