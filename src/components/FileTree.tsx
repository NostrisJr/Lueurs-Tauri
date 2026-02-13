import { useState } from "react";
import type { FolderNode, NoteFile, TreeNode } from "../hooks/useFileTree";

// ── Icônes ────────────────────────────────────────────────────────────────────

const IconChevron = ({ open }: { open: boolean }) => (
    <svg
        aria-hidden="true"
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`transition-transform shrink-0 ${open ? "rotate-90" : ""}`}
    >
        <title>{open ? "Réduire" : "Développer"}</title>
        <path d="M9 18l6-6-6-6" />
    </svg>
);

const IconFolder = ({ open }: { open: boolean }) => (
    <svg
        aria-hidden="true"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill={open ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-gray-400"
    >
        <title>Dossier</title>
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
);

const IconFile = () => (
    <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-gray-400"
    >
        <title>Note</title>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
    </svg>
);

const IconPlus = () => (
    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <title>Nouvelle note</title>
        <path d="M12 5v14M5 12h14" />
    </svg>
);

const IconFolderPlus = () => (
    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <title>Nouveau dossier</title>
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        <line x1="12" y1="11" x2="12" y2="17" />
        <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
);

const IconTrash = () => (
    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <title>Mettre à la poubelle</title>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4h6v2" />
    </svg>
);

// ── Props ─────────────────────────────────────────────────────────────────────

interface FileTreeProps {
    nodes: TreeNode[];
    activeId: string | null;
    onSelectNote: (note: NoteFile) => void;
    onCreateNote: (dirPath: string) => void;
    onCreateFolder: (dirPath: string) => void;
    onDeleteNote: (fileId: string) => void;
    rootPath: string;
}

// ── Nœud fichier ──────────────────────────────────────────────────────────────

function FileNode({
    node,
    activeId,
    onSelect,
    onDelete,
    depth,
}: {
    node: NoteFile;
    activeId: string | null;
    onSelect: () => void;
    onDelete: () => void;
    depth: number;
}) {
    const isActive = activeId === node.id;

    return (
        <div
            onClick={onSelect}
            onKeyDown={(e) => e.key === "Enter" && onSelect()}
            className={`group flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${isActive
                ? "bg-white shadow-sm border border-gray-200 text-gray-900"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                }`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
            <IconFile />
            {/* Afficher le nom du fichier au lieu du titre */}
            <span className={`flex-1 truncate text-xs ${isActive ? "font-medium" : ""}`}>
                {node.name}
            </span>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                aria-label={`Mettre ${node.name} à la poubelle`}
                title="Mettre à la poubelle"
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-300 hover:text-red-400 transition-all cursor-pointer shrink-0"
            >
                <IconTrash />
            </button>
        </div>
    );
}

// ── Nœud dossier ──────────────────────────────────────────────────────────────

function FolderNodeComponent({
    node,
    activeId,
    onSelectNote,
    onCreateNote,
    onCreateFolder,
    onDeleteNote,
    depth,
}: {
    node: FolderNode;
    activeId: string | null;
    onSelectNote: (note: NoteFile) => void;
    onCreateNote: (dirPath: string) => void;
    onCreateFolder: (dirPath: string) => void;
    onDeleteNote: (fileId: string) => void;
    depth: number;
}) {
    const [open, setOpen] = useState(depth === 0); // racine ouverte par défaut

    return (
        <div>
            {/* En-tête du dossier */}
            <div
                onClick={() => setOpen((v) => !v)}
                onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
                className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
                <IconChevron open={open} />
                <IconFolder open={open} />
                <span className="flex-1 truncate text-xs font-medium">{node.name}</span>

                {/* Actions dossier (visibles au hover) */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCreateNote(node.id); }}
                        aria-label="Nouvelle note dans ce dossier"
                        title="Nouvelle note"
                        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                        <IconPlus />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCreateFolder(node.id); }}
                        aria-label="Nouveau sous-dossier"
                        title="Nouveau dossier"
                        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                        <IconFolderPlus />
                    </button>
                </div>
            </div>

            {/* Enfants */}
            {open && node.children.length > 0 && (
                <div>
                    <TreeNodes
                        nodes={node.children}
                        activeId={activeId}
                        onSelectNote={onSelectNote}
                        onCreateNote={onCreateNote}
                        onCreateFolder={onCreateFolder}
                        onDeleteNote={onDeleteNote}
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
    onSelectNote,
    onCreateNote,
    onCreateFolder,
    onDeleteNote,
    depth,
}: {
    nodes: TreeNode[];
    activeId: string | null;
    onSelectNote: (note: NoteFile) => void;
    onCreateNote: (dirPath: string) => void;
    onCreateFolder: (dirPath: string) => void;
    onDeleteNote: (fileId: string) => void;
    depth: number;
}) {
    return (
        <>
            {nodes.map((node) =>
                node.kind === "folder" ? (
                    <FolderNodeComponent
                        key={node.id}
                        node={node}
                        activeId={activeId}
                        onSelectNote={onSelectNote}
                        onCreateNote={onCreateNote}
                        onCreateFolder={onCreateFolder}
                        onDeleteNote={onDeleteNote}
                        depth={depth}
                    />
                ) : (
                    <FileNode
                        key={node.id}
                        node={node}
                        activeId={activeId}
                        onSelect={() => onSelectNote(node)}
                        onDelete={() => onDeleteNote(node.id)}
                        depth={depth}
                    />
                ),
            )}
        </>
    );
}

// ── Export ────────────────────────────────────────────────────────────────────

export function FileTree({
    nodes,
    activeId,
    onSelectNote,
    onCreateNote,
    onCreateFolder,
    onDeleteNote,
}: FileTreeProps) {
    return (
        <div className="px-2 py-1">
            <TreeNodes
                nodes={nodes}
                activeId={activeId}
                onSelectNote={onSelectNote}
                onCreateNote={onCreateNote}
                onCreateFolder={onCreateFolder}
                onDeleteNote={onDeleteNote}
                depth={0}
            />
        </div>
    );
}