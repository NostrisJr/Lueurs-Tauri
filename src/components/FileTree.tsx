import { useState } from "react";
import { useFileTree, type FolderNode, type NoteFile, type TreeNode } from "../hooks/useFileTree";
import { useNote } from "../hooks/useNote";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { sfChevronDown, sfChevronRight, sfDocument, sfFolder, sfFolderBadgePlus, sfPlus, sfTrash } from "@bradleyhodges/sfsymbols";
import { EditableText } from "./EditableText";

// ── Props ─────────────────────────────────────────────────────────────────────
interface FileTreeProps {
    nodes: TreeNode[];
    activeId: string | null;
}

// ── Nœud fichier ──────────────────────────────────────────────────────────────

function FileNode({
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
                 ${isActive ?
                    "bg-white shadow-sm border border-gray-200 text-gray-900"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                }`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
            <div className="flex items-center gap-2 min-w-0">
                <SFIcon icon={sfDocument} className="size-4 text-gray-400 shrink-0" aria-hidden="true" />
                <EditableText
                    value={node.name}
                    onSave={async (newName) => {
                        await handleRename(node.id, newName, false);
                    }}
                />
            </div>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDeleteNote(node.id); }}
                aria-label={`Mettre ${node.name} à la poubelle`}
                title="Mettre à la poubelle"
                className="hidden group-hover:block p-0.5 rounded text-gray-300 hover:text-red-400 transition-all cursor-pointer"
            >
                <SFIcon icon={sfTrash} className="size-3" aria-hidden="true" />
            </button>
        </div >
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
    const [open, setOpen] = useState(depth === 0); // racine ouverte par défaut

    const { createNote, createFolder } = useFileTree();
    const { handleRename, handleDeleteFolder } = useNote();

    return (
        <div>
            {/* En-tête du dossier */}
            <div
                onClick={() => setOpen((v) => !v)}
                onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
                className="group flex items-center justify-between gap-1.5 rounded-md px-2 py-1.5 cursor-pointer text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <SFIcon icon={open ? sfChevronDown : sfChevronRight} className="size-3 text-gray-400 shrink-0" aria-hidden="true" />
                    <SFIcon icon={open ? sfFolder : sfFolder} className="size-4 text-gray-400 shrink-0" aria-hidden="true" />
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
                        onClick={(e) => { e.stopPropagation(); createNote(node.id); }}
                        aria-label="Nouvelle note dans ce dossier"
                        title="Nouvelle note"
                        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                        <SFIcon icon={sfPlus} className="size-3" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); createFolder(node.id); }}
                        aria-label="Nouveau sous-dossier"
                        title="Nouveau dossier"
                        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                        <SFIcon icon={sfFolderBadgePlus} className="size-3" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteFolder(node); }}
                        aria-label={`Mettre ${node.name} à la poubelle`}
                        title="Mettre à la poubelle"
                        className="p-1 rounded text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                    >
                        <SFIcon icon={sfTrash} className="size-3" aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* Enfants */}
            {open && node.children.length > 0 && (
                <div
                    className="border-l border-gray-200"
                    style={{ marginLeft: `${depth * 12 + 16}px` }}
                >
                    <TreeNodes
                        nodes={node.children}
                        activeId={activeId}
                        depth={depth + 1}
                    />
                </div>
            )}

            {/* Dossier vide */}
            {open && node.children.length === 0 && (
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

// ── Rendu récursif des nœuds ──────────────────────────────────────────────────

function TreeNodes({
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
                    <FileNode
                        key={node.id}
                        node={node}
                        activeId={activeId}
                        depth={depth}
                    />
                ),
            )}
        </div>
    );
}

// ── Export ────────────────────────────────────────────────────────────────────

export function FileTree({
    nodes,
    activeId,
}: FileTreeProps) {
    return (
        <div className="px-2 py-1 overflow-scroll">
            <TreeNodes
                nodes={nodes}
                activeId={activeId}
                depth={0}
            />
        </div>
    );
}