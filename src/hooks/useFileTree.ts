import { useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir, readTextFile, writeTextFile, mkdir, rename } from "@tauri-apps/plugin-fs";
import { useAtom, useSetAtom } from "jotai";
import { activeNoteAtom, errorAtom, folderPathAtom, loadingAtom, treeAtom } from "../lib/Atoms";
import {
    extractTitle,
    extractTags,
    sortNodes,
    updateNodeInTree,
    renameNodeInTree,
    deleteNodeInTree,
    addNodeInTree,
    flattenTree,
    moveToTrash,
    findNextAvailableNumber,
} from "../lib/FileTreeHelpers";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NoteFile {
    kind: "file";
    id: string;
    name: string;
    title: string;
    content: string;
    tags: string[];
    updatedAt: Date;
}

export interface FolderNode {
    kind: "folder";
    id: string;
    name: string;
    children: TreeNode[];
}

export type TreeNode = NoteFile | FolderNode;

export { flattenTree };

// ── Constantes ────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 1000;

// ── Chargement récursif ───────────────────────────────────────────────────────

async function loadTree(dirPath: string): Promise<TreeNode[]> {
    const entries = await readDir(dirPath, { baseDir: null } as any);
    const nodes: TreeNode[] = [];

    await Promise.all(
        entries.map(async (entry) => {
            if (!entry.name || entry.name.startsWith(".")) return;

            const fullPath = `${dirPath}/${entry.name}`;

            if (entry.isDirectory) {
                const children = await loadTree(fullPath);
                nodes.push({
                    kind: "folder",
                    id: fullPath,
                    name: entry.name,
                    children: sortNodes(children),
                });
            } else if (entry.name.endsWith(".md")) {
                const content = await readTextFile(fullPath, { baseDir: null } as any);
                nodes.push({
                    kind: "file",
                    id: fullPath,
                    name: entry.name.replace(/\.md$/, ""),
                    title: extractTitle(content),
                    content,
                    tags: extractTags(content),
                    updatedAt: new Date(),
                });
            }
        }),
    );

    return sortNodes(nodes);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFileTree() {
    const [folderPath, setFolderPath] = useAtom(folderPathAtom);
    const setTree = useSetAtom(treeAtom);
    const setLoading = useSetAtom(loadingAtom);
    const setError = useSetAtom(errorAtom);
    const setActiveNote = useSetAtom(activeNoteAtom);

    const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // ── Chargement ────────────────────────────────────────────────────────────

    async function reload(path: string) {
        setLoading(true);
        setError(null);
        try {
            const nodes = await loadTree(path);
            setTree(nodes);
        } catch (e) {
            setError(`Impossible de lire le dossier : ${e instanceof Error ? e.message : String(e)}`);
            setTree([]);
        } finally {
            setLoading(false);
        }
    }

    async function initFolder() {
        if (folderPath) await reload(folderPath);
    }

    async function pickFolder() {
        const selected = await open({ directory: true, multiple: false });
        if (typeof selected === "string") {
            setTree([]);
            setActiveNote(null);
            setError(null);
            setFolderPath(selected);
            await reload(selected);
        }
    }

    // ── Écriture ──────────────────────────────────────────────────────────────

    function updateNote(fileId: string, markdown: string) {
        setTree((prev) =>
            updateNodeInTree(prev, fileId, {
                content: markdown,
                title: extractTitle(markdown),
                tags: extractTags(markdown),
                updatedAt: new Date(),
            })
        );

        const existing = debounceTimers.current.get(fileId);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(async () => {
            await writeTextFile(fileId, markdown, { baseDir: null } as any);
            debounceTimers.current.delete(fileId);
        }, DEBOUNCE_MS);

        debounceTimers.current.set(fileId, timer);
    }

    // ── Création ──────────────────────────────────────────────────────────────

    async function createNote(dirPath: string) {
        const entries = await readDir(dirPath, { baseDir: null } as any);
        const number = await findNextAvailableNumber(entries, "Nouvelle note", false);
        const fileName = `Nouvelle note ${number}.md`;
        const filePath = `${dirPath}/${fileName}`;
        const content = "# Nouvelle note\n\nCommence à écrire...\n";

        await writeTextFile(filePath, content, { baseDir: null } as any);

        const newNode: NoteFile = {
            kind: "file",
            id: filePath,
            name: `Nouvelle note ${number}`,
            title: "Nouvelle note",
            content,
            tags: [],
            updatedAt: new Date(),
        };

        setTree((prev) => addNodeInTree(prev, dirPath, newNode));
        return filePath;
    }

    async function createFolder(dirPath: string) {
        const entries = await readDir(dirPath, { baseDir: null } as any);
        const number = await findNextAvailableNumber(entries, "Nouveau dossier", true);
        const name = `Nouveau dossier ${number}`;
        const fullPath = `${dirPath}/${name}`;

        await mkdir(fullPath, { baseDir: null } as any);

        const newNode: FolderNode = {
            kind: "folder",
            id: fullPath,
            name,
            children: [],
        };

        setTree((prev) => addNodeInTree(prev, dirPath, newNode));
    }

    // ── Suppression ───────────────────────────────────────────────────────────

    async function deleteNote(fileId: string) {
        await moveToTrash(fileId);
        setTree((prev) => deleteNodeInTree(prev, fileId));
    }

    async function deleteFolder(folderId: string, recursive = false) {
        if (!recursive) {
            const entries = await readDir(folderId, { baseDir: null } as any);
            const visible = entries.filter((e) => e.name && !e.name.startsWith("."));
            if (visible.length > 0) {
                throw new Error("Le dossier n'est pas vide.");
            }
        }
        await moveToTrash(folderId);
        setTree((prev) => deleteNodeInTree(prev, folderId));
    }

    // ── Renommage ─────────────────────────────────────────────────────────────

    async function renameNode(oldPath: string, newName: string, isFolder: boolean) {
        const pathParts = oldPath.split("/");
        pathParts[pathParts.length - 1] = isFolder ? newName : `${newName}.md`;
        const newPath = pathParts.join("/");

        await rename(oldPath, newPath, { baseDir: null } as any);
        setTree((prev) => renameNodeInTree(prev, oldPath, newPath, newName));

        return newPath;
    }

    // ── API ───────────────────────────────────────────────────────────────────

    return {
        pickFolder,
        initFolder,
        reload: () => folderPath && reload(folderPath),
        createNote,
        createFolder,
        updateNote,
        deleteNote,
        deleteFolder,
        renameNode,
    };
}