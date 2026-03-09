// ── Nœud fichier ──────────────────────────────────────────────────────────────

import {
  sfDocument,
  sfTrash,
  sfChevronDown,
  sfChevronRight,
  sfFolder,
  sfPlus,
  sfFolderBadgePlus,
} from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { useState } from "react";
import { type NoteFile, type FolderNode, useFileTree } from "./useFileTree";
import { useNote } from "../../hooks/useNote";
import { EditableText } from "../EditableText";
import { TreeNodes } from "./FileTree";

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
  const { handleSelectNote, handleDeleteNote } = useNote();
  const { handleRename } = useNote();

  return (
    <div
      onClick={() => handleSelectNote(node)}
      onKeyDown={(e) => e.key === "Enter" && handleSelectNote(node)}
      className={`group flex justify-between items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer transition-colors
                 ${
                   isActive
                     ? "bg-white shadow-sm border border-gray-200 text-gray-900"
                     : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                 }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <SFIcon
          icon={sfDocument}
          className="size-4 text-gray-400 shrink-0"
          aria-hidden="true"
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
        className="hidden group-hover:block p-0.5 rounded text-gray-300 hover:text-red-400 transition-all cursor-pointer"
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

  // La note __folder__ est celle qui porte exactement le même nom que ce dossier
  const folderNoteId = `${node.id}/${node.name}.md`;
  const isActive = activeId === folderNoteId;

  // Masquer la note __folder__ du même nom dans la liste des enfants
  const visibleChildren = node.children.filter(
    (child) => !(child.kind === "file" && child.name === node.name)
  );

  return (
    <div>
      {/* En-tête du dossier */}
      <div
        className={`group flex items-center justify-between gap-1.5 rounded-md px-2 py-1.5 cursor-pointer transition-colors
                    ${
                      isActive
                        ? "bg-white shadow-sm border border-gray-200 text-gray-700"
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
          onClick={() => {
            setOpen(true);
            handleOpenFolder(node);
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
        <div className="hidden relative right-0 group-hover:flex items-center gap-0.5 transition-opacity z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              createNote(node.id);
            }}
            aria-label="Nouvelle note dans ce dossier"
            title="Nouvelle note"
            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <SFIcon icon={sfPlus} className="size-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              createFolder(node.id);
            }}
            aria-label="Nouveau sous-dossier"
            title="Nouveau dossier"
            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <SFIcon
              icon={sfFolderBadgePlus}
              className="size-3"
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
            className="p-1 rounded text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
          >
            <SFIcon icon={sfTrash} className="size-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Enfants */}
      {open && visibleChildren.length > 0 && (
        <div
          className="border-l border-gray-200"
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
          className="text-xs text-gray-300 py-1"
          style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
        >
          Vide
        </p>
      )}
    </div>
  );
}

export { FileNodeComponent, FolderNodeComponent };
