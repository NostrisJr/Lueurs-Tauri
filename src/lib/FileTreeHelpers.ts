import type { NoteFile, TreeNode } from "../hooks/useFileTree";
import { Command } from "@tauri-apps/plugin-shell";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Frontmatter {
    [key: string]: string | string[] | undefined;
}

// ── Frontmatter ───────────────────────────────────────────────────────────────

export function parseFrontmatter(markdown: string): { frontmatter: Frontmatter; body: string } {
    const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!match) return { frontmatter: {}, body: markdown };

    const raw = match[1];
    const body = markdown.slice(match[0].length);
    const frontmatter: Frontmatter = {};

    for (const line of raw.split("\n")) {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();

        if (value.startsWith("[") && value.endsWith("]")) {
            frontmatter[key] = value.slice(1, -1).split(",").map((v) => v.trim()).filter(Boolean);
        } else {
            frontmatter[key] = value;
        }
    }

    return { frontmatter, body };
}

export function serializeFrontmatter(frontmatter: Frontmatter, body: string): string {
    const keys = Object.keys(frontmatter);
    if (keys.length === 0) return body;

    const lines = keys.map((key) => {
        const value = frontmatter[key];
        if (Array.isArray(value)) return `${key}: [${value.join(", ")}]`;
        return `${key}: ${value ?? ""}`;
    });

    return `---\n${lines.join("\n")}\n---\n${body}`;
}

// ── Extraction de métadonnées ─────────────────────────────────────────────────

export function extractTitle(body: string): string {
    for (const line of body.split("\n")) {
        const trimmed = line.replace(/^#+\s*/, "").trim();
        if (trimmed) return trimmed;
    }
    return "Sans titre";
}

export function extractTags(markdown: string): string[] {
    const { frontmatter } = parseFrontmatter(markdown);
    const tags = frontmatter.tags;
    return Array.isArray(tags) ? tags : [];
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