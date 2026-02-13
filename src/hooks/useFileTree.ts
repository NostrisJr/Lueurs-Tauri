import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
    readDir,
    readTextFile,
    writeTextFile,
    mkdir,
} from "@tauri-apps/plugin-fs";
import { Command } from "@tauri-apps/plugin-shell";

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

// ── Utilitaires ───────────────────────────────────────────────────────────────

function extractTitle(markdown: string): string {
    for (const line of markdown.split("\n")) {
        const trimmed = line.replace(/^#+\s*/, "").trim();
        if (trimmed) return trimmed;
    }
    return "Sans titre";
}

function extractTags(markdown: string): string[] {
    const match = markdown.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return [];
    const tagsMatch = match[1].match(/tags:\s*\[([^\]]*)\]/);
    if (!tagsMatch) return [];
    return tagsMatch[1].split(",").map((t) => t.trim()).filter(Boolean);
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
    return [...nodes].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name, "fr");
    });
}

const STORAGE_KEY = "lueurs_folder_path";
const DEBOUNCE_MS = 1000;

// ── Fonction pour mettre à la poubelle ───────────────────────────────────────

async function moveToTrash(filePath: string) {
    // Utiliser la commande native macOS pour mettre à la poubelle
    const command = Command.create("osascript", [
        "-e",
        `tell application "Finder" to delete POSIX file "${filePath}"`
    ]);

    await command.execute();
}

// ── Chargement récursif ───────────────────────────────────────────────────────

async function loadTree(dirPath: string): Promise<TreeNode[]> {
    const entries = await readDir(dirPath, {
        // @ts-ignore
        baseDir: null
    });

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
                const content = await readTextFile(fullPath, {
                    // @ts-ignore
                    baseDir: null
                });
                const note = {
                    kind: "file" as const,
                    id: fullPath,
                    name: entry.name.replace(/\.md$/, ""),
                    title: extractTitle(content),
                    content,
                    tags: extractTags(content),
                    updatedAt: new Date(),
                };
                nodes.push(note);
            }
        }),
    );

    return sortNodes(nodes);
}

// ── Aplatissement de l'arbre (pour recherche) ─────────────────────────────────

export function flattenTree(nodes: TreeNode[]): NoteFile[] {
    return nodes.flatMap((node) =>
        node.kind === "file" ? [node] : flattenTree(node.children),
    );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFileTree() {
    const [folderPath, setFolderPath] = useState<string | null>(
        () => localStorage.getItem(STORAGE_KEY),
    );
    const [tree, setTree] = useState<TreeNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const pickFolder = useCallback(async () => {
        const selected = await open({ directory: true, multiple: false });
        if (typeof selected === "string") {
            localStorage.setItem(STORAGE_KEY, selected);
            setFolderPath(selected);
            setError(null);
        }
    }, []);

    const reload = useCallback(async (path: string) => {
        setLoading(true);
        setError(null);
        try {
            const nodes = await loadTree(path);
            setTree(nodes);
        } catch (e) {
            setError(`Impossible de lire le dossier : ${e}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (folderPath) reload(folderPath);
    }, [folderPath, reload]);

    function updateNodeInTree(nodes: TreeNode[], fileId: string, patch: Partial<NoteFile>): TreeNode[] {
        return nodes.map((node) => {
            if (node.kind === "file" && node.id === fileId) {
                return { ...node, ...patch };
            }
            if (node.kind === "folder") {
                return { ...node, children: updateNodeInTree(node.children, fileId, patch) };
            }
            return node;
        });
    }

    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    const updateNote = useCallback(
        (fileId: string, markdown: string) => {
            setTree((prev) =>
                updateNodeInTree(prev, fileId, {
                    content: markdown,
                    title: extractTitle(markdown),
                    tags: extractTags(markdown),
                    updatedAt: new Date(),
                }),
            );

            const existing = debounceTimers.current.get(fileId);
            if (existing) clearTimeout(existing);

            const timer = setTimeout(async () => {
                await writeTextFile(fileId, markdown, {
                    // @ts-ignore
                    baseDir: null
                });
                debounceTimers.current.delete(fileId);
            }, DEBOUNCE_MS);

            debounceTimers.current.set(fileId, timer);
        },
        [],
    );

    const createNote = useCallback(
        async (dirPath: string) => {
            const fileName = `note-${Date.now()}.md`;
            const filePath = `${dirPath}/${fileName}`;
            const content = "# Nouvelle note\n\nCommence à écrire...\n";
            await writeTextFile(filePath, content, {
                // @ts-ignore
                baseDir: null
            });
            if (folderPath) await reload(folderPath);
            return filePath;
        },
        [folderPath, reload],
    );

    const createFolder = useCallback(
        async (dirPath: string) => {
            const name = `Nouveau dossier ${Date.now()}`;
            await mkdir(`${dirPath}/${name}`, {
                // @ts-ignore
                baseDir: null
            });
            if (folderPath) await reload(folderPath);
        },
        [folderPath, reload],
    );

    const deleteNote = useCallback(
        async (fileId: string) => {
            try {
                await moveToTrash(fileId);
                if (folderPath) await reload(folderPath);
            } catch (e) {
                console.error("Erreur lors de la mise à la poubelle:", e);
                // Fallback : afficher une erreur à l'utilisateur
                alert(`Impossible de mettre le fichier à la poubelle : ${e}`);
            }
        },
        [folderPath, reload],
    );

    return {
        folderPath,
        tree,
        loading,
        error,
        pickFolder,
        reload: () => folderPath && reload(folderPath),
        createNote,
        createFolder,
        updateNote,
        deleteNote,
    };
}