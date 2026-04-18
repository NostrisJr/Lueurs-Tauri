import type { NoteFile, TreeNode } from "../hooks/useFileTree";
import { Command } from "@tauri-apps/plugin-shell";
import { NoteType, isFunctionalBaseField } from "./noteTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Frontmatter {
    [key: string]: string | string[] | undefined;
}

// ── Types système ─────────────────────────────────────────────────────────────

const SYSTEM_FIELD_REGEX = /^__[A-Za-z]+__$/;

export function isSystemField(key: string): boolean {
    return SYSTEM_FIELD_REGEX.test(key);
}

export function ensureType(
    frontmatter: Frontmatter,
    noteName: string,
    parentFolderName: string
): Frontmatter {
    if (frontmatter.__Type__) return frontmatter;

    const inferredType = noteName === parentFolderName
        ? NoteType.FOLDER
        : NoteType.NOTE;

    return { "__Type__": inferredType, ...frontmatter };
}

/**
 * Convertit une valeur frontmatter en tableau de strings.
 * Gère les cas : undefined, string unique, string[], array YAML.
 */
export function toArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as string[];
    if (typeof value === "string") return [value];
    return [];
}

/**
 * Calcule les propriétés à appliquer depuis les templates vers une note.
 * - applyForced: false → ajoute seulement les props absentes (chargement initial)
 * - applyForced: true  → ajoute les absentes + écrase si le template impose une valeur non vide (édition live)
 */
export function computeTemplateProps(
    frontmatter: Frontmatter,
    templates: Frontmatter[],
    options: { applyForced: boolean }
): { updated: Frontmatter; changed: string[] } {
    const changed: string[] = [];
    const updated = { ...frontmatter };

    for (const template of templates) {
        for (const [key, value] of Object.entries(template)) {
            if (isSystemField(key)) continue;
            const isMissing = !(key in updated);
            const templateHasValue = value !== "" && value !== null && value !== undefined;

            if (isMissing) {
                updated[key] = value ?? "";
                changed.push(key);
            } else if (options.applyForced && templateHasValue && updated[key] !== value) {
                updated[key] = value;
                changed.push(key);
            }
        }
    }

    return { updated, changed };
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

        // String quotée guillemets simples → dé-quoter et garder telle quelle (ex: JSON sérialisé)
        if (value.startsWith("'") && value.endsWith("'")) {
            frontmatter[key] = value.slice(1, -1);
            i++;
            continue;
        }

        // Valeur entre crochets : JSON ou array YAML inline
        if (value.startsWith("[") && value.endsWith("]")) {
            try {
                const parsed = JSON.parse(value);
                frontmatter[key] = Array.isArray(parsed) ? parsed : value;
            } catch {
                frontmatter[key] = value.slice(1, -1).split(",").map((v) => v.trim()).filter(Boolean);
            }
            i++;
            continue;
        }

        if (value === "") {
            const items: string[] = [];
            i++;
            while (i < lines.length && lines[i].match(/^\s+-\s+/)) {
                items.push(lines[i].replace(/^\s+-\s+/, "").trim());
                i++;
            }
            if (items.length > 0) {
                // Formule cassée par le YAML sur une virgule → réassembler
                const joined = items.join(", ");
                frontmatter[key] = (joined.startsWith("$$") && joined.endsWith("$$")) ? joined : items;
            } else {
                frontmatter[key] = "";
            }
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

    const systemKeys = keys.filter(isSystemField);
    const userKeys = keys.filter((k) => !isSystemField(k));
    const orderedKeys = [...systemKeys, ...userKeys];

    const lines = orderedKeys.map((key) => {
        const value = frontmatter[key];
        if (Array.isArray(value)) {
            if (value.length === 0) return `${key}: []`;
            return `${key}:\n${value.map((v) => `  - ${v}`).join("\n")}`;
        }
        // Valeur vide → key sans valeur (ex: "Status:" sans espace)
        if (value === "" || value === null || value === undefined) return `${key}:`;
        // String JSON (commence par [ ou {) → guillemets pour éviter que YAML la parse comme structure
        if (typeof value === "string" && (value.startsWith("[") || value.startsWith("{"))) {
            return `${key}: '${value}'`;
        }
        // Formule → guillemets pour éviter que la virgule soit interprétée comme séparateur YAML
        if (typeof value === "string" && value.startsWith("$$") && value.endsWith("$$")) {
            return `${key}: '${value}'`;
        }
        return `${key}: ${value}`;
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
    return Array.isArray(tags) ? tags as string[] : [];
}

// ── Helpers Kanban ────────────────────────────────────────────────────────────

/** Retourne les propriétés libres (valeur vide) d'un frontmatter de template.
 *  Ce sont les seules utilisables comme KanbanKey — les notes enfants peuvent y mettre leur propre valeur. */
export function getFreeProps(templateFrontmatter: Frontmatter): string[] {
    return Object.entries(templateFrontmatter)
        .filter(([key, value]) => !isSystemField(key) && !isFunctionalBaseField(key) && (value === "" || value === undefined))
        .map(([key]) => key);
}

// ── Tri ───────────────────────────────────────────────────────────────────────

export function sortNodes(nodes: TreeNode[]): TreeNode[] {
    return [...nodes].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name, "fr", { numeric: true });
    });
}

// ── Mutations de l'arbre ──────────────────────────────────────────────────────

export function updateNodeInTree(nodes: TreeNode[], fileId: string, patch: Partial<NoteFile>): TreeNode[] {
    return nodes.map((node) => {
        if (node.kind === "file" && node.id === fileId) return { ...node, ...patch };
        if (node.kind === "folder") return { ...node, children: updateNodeInTree(node.children, fileId, patch) };
        return node;
    });
}

export function renameNodeInTree(nodes: TreeNode[], oldPath: string, newPath: string, newName: string): TreeNode[] {
    const renamed = nodes.map((node) => {
        if (node.id === oldPath) return { ...node, id: newPath, name: newName };
        if (node.kind === "folder") return { ...node, children: renameNodeInTree(node.children, oldPath, newPath, newName) };
        return node;
    });
    // Re-trier après le rename pour maintenir l'ordre alphabétique
    return sortNodes(renamed);
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
    if (rootId && parentId === rootId) return sortNodes([...nodes, newNode]);

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
        node.kind === "file" ? [node] : flattenTree(node.children)
    );
}

// ── Corbeille ─────────────────────────────────────────────────────────────────

export async function moveToTrash(filePath: string): Promise<void> {
    const command = Command.create("osascript", [
        "-e",
        `tell application "Finder" to delete POSIX file "${filePath}"`
    ]);

    const output = await command.execute();
    if (output.code !== 0) throw new Error(output.stderr || "Erreur inconnue");
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
        if (match) existingNumbers.add(Number.parseInt(match[1], 10));
    }

    let number = 1;
    while (existingNumbers.has(number)) number++;
    return number;
}