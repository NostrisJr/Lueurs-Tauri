import type { NoteFile, TreeNode } from "../hooks/useFileTree";
import { Command } from "@tauri-apps/plugin-shell";

// ── Extraction de métadonnées ─────────────────────────────────────────────────

export function extractTitle(markdown: string): string {
    for (const line of markdown.split("\n")) {
        const trimmed = line.replace(/^#+\s*/, "").trim();
        if (trimmed) return trimmed;
    }
    return "Sans titre";
}

export function extractTags(markdown: string): string[] {
    const match = markdown.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return [];
    const tagsMatch = match[1].match(/tags:\s*\[([^\]]*)\]/);
    if (!tagsMatch) return [];
    return tagsMatch[1].split(",").map((t) => t.trim()).filter(Boolean);
}

// ── Tri ───────────────────────────────────────────────────────────────────────

export function sortNodes(nodes: TreeNode[]): TreeNode[] {
    return [...nodes].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name, "fr");
    });
}

// ── Mutations de l'arbre ──────────────────────────────────────────────────────

export function updateNodeInTree(nodes: TreeNode[], fileId: string, patch: Partial<NoteFile>): TreeNode[] {
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

export function renameNodeInTree(nodes: TreeNode[], oldPath: string, newPath: string, newName: string): TreeNode[] {
    return nodes.map((node) => {
        if (node.id === oldPath) {
            return { ...node, id: newPath, name: newName };
        }
        if (node.kind === "folder") {
            return { ...node, children: renameNodeInTree(node.children, oldPath, newPath, newName) };
        }
        return node;
    });
}

export function deleteNodeInTree(nodes: TreeNode[], id: string): TreeNode[] {
    return nodes
        .filter((node) => node.id !== id)
        .map((node) =>
            node.kind === "folder"
                ? { ...node, children: deleteNodeInTree(node.children, id) }
                : node
        );
}

export function addNodeInTree(nodes: TreeNode[], parentId: string, newNode: TreeNode): TreeNode[] {
    return nodes.map((node) => {
        if (node.kind === "folder" && node.id === parentId) {
            return { ...node, children: sortNodes([...node.children, newNode]) };
        }
        if (node.kind === "folder") {
            return { ...node, children: addNodeInTree(node.children, parentId, newNode) };
        }
        return node;
    });
}

// ── Aplatissement ─────────────────────────────────────────────────────────────

export function flattenTree(nodes: TreeNode[]): NoteFile[] {
    return nodes.flatMap((node) =>
        node.kind === "file" ? [node] : flattenTree(node.children),
    );
}

// ── Corbeille ─────────────────────────────────────────────────────────────────

export async function moveToTrash(filePath: string): Promise<void> {
    const command = Command.create("osascript", [
        "-e",
        `tell application "Finder" to delete POSIX file "${filePath}"`
    ]);

    const output = await command.execute();

    if (output.code !== 0) {
        throw new Error(output.stderr || "Erreur inconnue");
    }
}

// ── Nommage automatique ───────────────────────────────────────────────────────

export async function findNextAvailableNumber(
    entries: { name?: string }[],
    baseName: string,
    isFolder: boolean
): Promise<number> {
    const existingNumbers = new Set<number>();
    const pattern = new RegExp(
        `^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} (\\d+)${isFolder ? "" : "\\.md"}$`
    );

    for (const entry of entries) {
        if (!entry.name) continue;
        const match = entry.name.match(pattern);
        if (match) existingNumbers.add(parseInt(match[1], 10));
    }

    let number = 1;
    while (existingNumbers.has(number)) number++;
    return number;
}