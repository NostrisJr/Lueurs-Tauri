/**
 * vaultIO.ts — Lecture/écriture du vault sans état React.
 * Toutes les fonctions sont pures ou async IO, sans hooks.
 */
import { readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import {
    sortNodes,
    parseFrontmatter,
    serializeFrontmatter,
    ensureType,
    extractTitle,
    extractTags,
    applyMissingTemplateProps,
    flattenTree,
    updateNodeInTree,
    type Frontmatter,
} from "../components/FileTree/lib/fileTreeHelpers";
import { NoteType } from "./noteTypes";
import { createLogger } from "./logger";
import type { NoteFile, TreeNode } from "../components/FileTree/hooks/useFileTree";

const log = createLogger("vaultIO");

// ── Parsing d'une note ─────────────────────────────────────────────────────

export function noteFromRaw(fullPath: string, fileName: string, rawContent: string): NoteFile {
    const noteName = fileName.replace(/\.md$/, "");
    const pathParts = fullPath.split("/");
    const parentFolderName = pathParts[pathParts.length - 2] ?? "";

    const { frontmatter: rawFrontmatter, body } = parseFrontmatter(rawContent);
    const frontmatter = ensureType(rawFrontmatter, noteName, parentFolderName);

    if (!rawFrontmatter.__Type__ && frontmatter.__Type__) {
        log.info("__Type__ injecté automatiquement", { path: fullPath, type: frontmatter.__Type__ });
    }

    return {
        kind: "file",
        id: fullPath,
        name: noteName,
        type: frontmatter.__Type__ as string ?? null,
        title: extractTitle(body),
        body,
        frontmatter,
        tags: extractTags(rawContent),
        updatedAt: new Date(),
    };
}

// ── Chargement récursif ────────────────────────────────────────────────────

export async function loadTree(dirPath: string): Promise<TreeNode[]> {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const entries = await readDir(dirPath, { baseDir: null } as any);
    const nodes: TreeNode[] = [];

    await Promise.all(
        entries.map(async (entry) => {
            if (!entry.name || entry.name.startsWith(".")) return;
            if (entry.isDirectory && (entry.name === "resources" || entry.name === "config")) return;

            const fullPath = `${dirPath}/${entry.name}`;

            if (entry.isDirectory) {
                const children = await loadTree(fullPath);
                nodes.push({ kind: "folder", id: fullPath, name: entry.name, children: sortNodes(children) });
            } else if (entry.name.endsWith(".md")) {
                // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                const rawContent = await readTextFile(fullPath, { baseDir: null } as any);
                const note = noteFromRaw(fullPath, entry.name, rawContent);

                // Persister __Type__ si absent
                if (!parseFrontmatter(rawContent).frontmatter.__Type__) {
                    const raw = serializeFrontmatter(note.frontmatter, note.body);
                    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                    writeTextFile(fullPath, raw, { baseDir: null } as any).catch((err) =>
                        log.error("échec persistance __Type__", { path: fullPath, err })
                    );
                }

                nodes.push(note);
            }
        }),
    );

    return sortNodes(nodes);
}

// ── Application des templates ──────────────────────────────────────────────

/**
 * Résout les templates pour toutes les notes du vault après chargement complet.
 * Trie les notes par priorité (templates → bases → notes) pour garantir que
 * les templates des bases sont résolus avant d'être appliqués aux enfants.
 * Retourne l'arbre final et écrit les fichiers modifiés sur le disque.
 */
export async function applyAllTemplates(nodes: TreeNode[]): Promise<TreeNode[]> {
    const allNotes = flattenTree(nodes);

    // Ordre de résolution : __template__ d'abord, puis __base__, puis le reste
    const priority = (n: NoteFile) => {
        if (n.type === NoteType.TEMPLATE) return 0;
        if (n.type === NoteType.BASE) return 1;
        return 2;
    };
    const sorted = [...allNotes].sort((a, b) => priority(a) - priority(b));

    // Map mutable pour avoir les frontmatters à jour au fur et à mesure
    const resolved = new Map<string, Frontmatter>(
        allNotes.map((n) => [n.id, n.frontmatter])
    );

    const toWrite: { path: string; frontmatter: Frontmatter; body: string }[] = [];

    for (const note of sorted) {
        const fm = resolved.get(note.id) ?? {};

        const directTemplates = toStringArray(fm.__Template__);
        const parentBases = toStringArray(fm.__Base__);
        const inheritedTemplates = parentBases.flatMap((basePath) => {
            const baseFm = resolved.get(basePath);
            return baseFm ? toStringArray(baseFm.__Template__) : [];
        });

        const allTemplatePaths = [...new Set([...directTemplates, ...inheritedTemplates])];
        if (allTemplatePaths.length === 0) continue;

        // Les bases ne reçoivent pas les props du template — sert uniquement à templater leurs enfants
        if (note.type === NoteType.BASE) continue;

        const templates = allTemplatePaths
            .map((tp) => resolved.get(tp))
            .filter((f): f is Frontmatter => !!f);

        const { updated, added } = applyMissingTemplateProps(fm, templates);
        if (added.length === 0) continue;

        log.info("propriétés template appliquées", { noteId: note.id, added });
        resolved.set(note.id, updated);
        toWrite.push({ path: note.id, frontmatter: updated, body: note.body });
    }

    if (toWrite.length === 0) return nodes;

    // Persister sur le disque
    await Promise.all(
        toWrite.map(({ path, frontmatter, body }) => {
            const raw = serializeFrontmatter(frontmatter, body);
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            return writeTextFile(path, raw, { baseDir: null } as any).catch((err) =>
                log.error("échec persistance props template", { path, err })
            );
        })
    );

    // Mettre à jour l'arbre en mémoire
    let finalNodes = nodes;
    for (const { path, frontmatter } of toWrite) {
        finalNodes = updateNodeInTree(finalNodes, path, { frontmatter }) as TreeNode[];
    }
    return finalNodes;
}

// ── Scope Tauri ────────────────────────────────────────────────────────────

export async function allowVaultScope(vaultPath: string): Promise<void> {
    log.info("autorisation scope vault", { vaultPath });
    try {
        await invoke("allow_vault_path", { vaultPath });
        log.info("scope vault autorisé", { vaultPath });
    } catch (err) {
        log.error("échec allow_vault_path", err);
        throw err;
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toStringArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as string[];
    return [value as string];
}