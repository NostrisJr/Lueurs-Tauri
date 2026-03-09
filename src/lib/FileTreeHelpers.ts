import type { NoteFile, TreeNode } from "../components/FileTree/useFileTree";
import { Command } from "@tauri-apps/plugin-shell";
import { NoteType } from "./noteTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Frontmatter {
    [key: string]: string | string[] | undefined;
}

// ── Types système ─────────────────────────────────────────────────────────────

export { NoteType, SystemField } from "./noteTypes";
export type { NoteTypeValue, SystemFieldKey } from "./noteTypes";

const SYSTEM_FIELD_REGEX = /^__[A-Za-z]+__$/;

/** Retourne true si la clé est un champ système (__Mot__) */
export function isSystemField(key: string): boolean {
    return SYSTEM_FIELD_REGEX.test(key);
}

/**
 * Injecte __Type__ dans un frontmatter si absent.
 * Détecte automatiquement __folder__ si la note porte le même nom que son dossier parent.
 */
export function ensureType(
    frontmatter: Frontmatter,
    noteName: string,       // sans extension
    parentFolderName: string // nom du dossier parent direct
): Frontmatter {
    if (frontmatter["__Type__"]) return frontmatter;

    const inferredType = noteName === parentFolderName
        ? NoteType.FOLDER
        : NoteType.NOTE;

    return { "__Type__": inferredType, ...frontmatter };
}

/**
 * Applique les propriétés manquantes d'un ensemble de templates à un frontmatter.
 * Version pure (sans IO) — utilisée au parsing.
 * templates : liste de frontmatters de notes __template__.
 */
export function applyMissingTemplateProps(
    frontmatter: Frontmatter,
    templates: Frontmatter[]
): { updated: Frontmatter; added: string[] } {
    const added: string[] = [];
    const updated = { ...frontmatter };

    for (const template of templates) {
        for (const [key, value] of Object.entries(template)) {
            if (/^__[A-Za-z]+__$/.test(key)) continue; // ignorer les champs système
            if (!(key in updated)) {
                updated[key] = value ?? "";
                added.push(key);
            }
        }
    }

    return { updated, added };
}

// ── Frontmatter ───────────────────────────────────────────────────────────────

export function parseFrontmatter(markdown: string): { frontmatter: Frontmatter; body: string } {
    const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!match) return { frontmatter: {}, body: markdown };

    const raw = match[1];
    const body = markdown.slice(match[0].length);
    const frontmatter: Frontmatter = {};

    const lines = raw.split("\n");
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) { i++; continue; }

        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();

        // Array inline : key: [a, b, c]
        if (value.startsWith("[") && value.endsWith("]")) {
            frontmatter[key] = value.slice(1, -1).split(",").map((v) => v.trim()).filter(Boolean);
            i++;
            continue;
        }

        // Array multiligne YAML :
        // key:
        //   - item1
        //   - item2
        if (value === "") {
            const items: string[] = [];
            i++;
            while (i < lines.length && lines[i].match(/^\s+-\s+/)) {
                items.push(lines[i].replace(/^\s+-\s+/, "").trim());
                i++;
            }
            if (items.length > 0) {
                frontmatter[key] = items;
                continue;
            }
            // Valeur vide réelle
            frontmatter[key] = "";
            continue;
        }

        frontmatter[key] = value;
        i++;
    }

    return { frontmatter, body };
}

export function serializeFrontmatter(frontmatter: Frontmatter, body: string): string {
    const keys = Object.keys(frontmatter);
    if (keys.length === 0) return body;

    // Les champs système (__Mot__) sont écrits en premier
    const systemKeys = keys.filter(isSystemField);
    const userKeys = keys.filter((k) => !isSystemField(k));
    const orderedKeys = [...systemKeys, ...userKeys];

    const lines = orderedKeys.map((key) => {
        const value = frontmatter[key];
        if (Array.isArray(value)) {
            // Format YAML natif pour les arrays
            if (value.length === 0) return `${key}: []`;
            return `${key}:\n${value.map((v) => `  - ${v}`).join("\n")}`;
        }
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

export function addNodeInTree(nodes: TreeNode[], parentId: string, newNode: TreeNode, rootId?: string): TreeNode[] {
    // Cas racine : parentId est le vault root, pas un dossier dans l'arbre
    if (rootId && parentId === rootId) {
        return sortNodes([...nodes, newNode]);
    }
    return nodes.map((node) => {
        if (node.kind === "folder" && node.id === parentId) {
            return { ...node, children: sortNodes([...node.children, newNode]) };
        }
        if (node.kind === "folder") {
            return { ...node, children: addNodeInTree(node.children, parentId, newNode, rootId) };
        }
        return node;
    });
}

// ── Aplatissement ─────────────────────────────────────────────────────────────

export function updateFolderInTree(
    nodes: TreeNode[],
    oldPath: string,
    newPath: string,
    newName: string,
    newChildren: TreeNode[]
): TreeNode[] {
    return nodes.map((node) => {
        if (node.id === oldPath && node.kind === "folder") {
            return { ...node, id: newPath, name: newName, children: newChildren };
        }
        if (node.kind === "folder") {
            return { ...node, children: updateFolderInTree(node.children, oldPath, newPath, newName, newChildren) };
        }
        return node;
    });
}

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