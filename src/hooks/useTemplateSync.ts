import { useAtomValue, useSetAtom } from "jotai";
import { treeAtom, folderPathAtom, writingPathsRegistry } from "../lib/atoms";
import { flattenTree, type Frontmatter } from "../components/FileTree/useFileTree";
import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "../lib/logger";
import { loadTree, applyAllTemplates } from "../lib/vaultIO";
import { isSystemField } from "../lib/fileTreeHelpers";
import { NoteType } from "../lib/noteTypes";

const log = createLogger("useTemplateSync");

// ── Types ──────────────────────────────────────────────────────────────────

type TemplateChange =
    | { type: "addProp"; key: string; value?: string }
    | { type: "removeProp"; key: string }
    | { type: "renameProp"; oldKey: string; newKey: string }
    | { type: "forceValue"; key: string; value: string };

interface PropagateResult {
    modified: number;
    errors: string[];
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTemplateSync() {
    const tree = useAtomValue(treeAtom);
    const setTree = useSetAtom(treeAtom);
    const folderPath = useAtomValue(folderPathAtom);
    const allNotes = flattenTree(tree);

    async function onTemplateChange(
        templateId: string,
        prev: Frontmatter,
        next: Frontmatter,
    ) {
        if (!folderPath) return;

        const changes = diffFrontmatter(prev, next);
        if (changes.length === 0) return;

        log.info("changements template détectés", { templateId, changes });

        // La confirmation removeProp est gérée en amont dans FrontmatterEditor
        for (const change of changes) {
            await propagate(templateId, change);
        }
    }

    /**
     * Renomme une propriété dans un template et propage aux héritiers.
     * TODO: préserver les valeurs existantes des enfants lors du renommage
     */
    async function renameTemplateProperty(
        templateId: string,
        oldKey: string,
        newKey: string,
    ) {
        if (!folderPath) return;

        const allPaths = [templateId, ...resolveAllHeirs(templateId)];
        log.info("renommage propriété template", { templateId, oldKey, newKey, pathCount: allPaths.length });

        for (const p of allPaths) writingPathsRegistry.add(p);

        try {
            const result = await invoke<PropagateResult>("propagate_template_change", {
                affectedPaths: allPaths,
                change: { type: "renameProp", oldKey, newKey },
            });
            log.info("renommage Rust terminé", { modified: result.modified, errors: result.errors });

            const nodes = await loadTree(folderPath);
            const finalNodes = await applyAllTemplates(nodes);
            setTree(finalNodes);
        } finally {
            for (const p of allPaths) writingPathsRegistry.delete(p);
        }
    }

    // ── Helpers privés ─────────────────────────────────────────────────────

    async function propagate(templateId: string, change: TemplateChange) {
        if (!folderPath) return;

        const affectedPaths = resolveAllHeirs(templateId);
        if (affectedPaths.length === 0) {
            log.info("aucun héritier trouvé — pas de propagation", { templateId, change });
            return;
        }

        log.info("propagation vers héritiers", { templateId, change, count: affectedPaths.length });

        for (const p of affectedPaths) writingPathsRegistry.add(p);

        try {
            const result = await invoke<PropagateResult>("propagate_template_change", {
                affectedPaths,
                change,
            });
            log.info("propagation Rust terminée", { modified: result.modified, errors: result.errors });

            const nodes = await loadTree(folderPath);
            const finalNodes = await applyAllTemplates(nodes);
            setTree(finalNodes);
        } finally {
            for (const p of affectedPaths) writingPathsRegistry.delete(p);
        }
    }

    /**
     * Retourne les chemins de toutes les notes héritant du template donné.
     * Les bases sont exclues — elles portent __Template__ pour leurs enfants,
     * pas pour elles-mêmes.
     */
    function resolveAllHeirs(templateId: string): string[] {
        return allNotes
            .filter((note) => {
                if (note.id === templateId) return false;
                if (note.type === NoteType.BASE) return false;

                const directTemplates = toArray(note.frontmatter.__Template__);
                if (directTemplates.includes(templateId)) return true;

                const bases = toArray(note.frontmatter.__Base__);
                return bases.some((basePath) => {
                    const base = allNotes.find((n) => n.id === basePath);
                    return base
                        ? toArray(base.frontmatter.__Template__).includes(templateId)
                        : false;
                });
            })
            .map((n) => n.id);
    }

    return { onTemplateChange, renameTemplateProperty };
}

// ── Helpers purs ───────────────────────────────────────────────────────────

function toArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as string[];
    return [value as string];
}

function diffFrontmatter(prev: Frontmatter, next: Frontmatter): TemplateChange[] {
    const changes: TemplateChange[] = [];

    const prevKeys = Object.keys(prev).filter((k) => !isSystemField(k));
    const nextKeys = Object.keys(next).filter((k) => !isSystemField(k));

    const added = nextKeys.filter((k) => !(k in prev));
    const removed = prevKeys.filter((k) => !(k in next));

    // Ajout + suppression simultanés = renommage
    if (added.length === 1 && removed.length === 1) {
        changes.push({ type: "renameProp", oldKey: removed[0], newKey: added[0] });
        return changes;
    }

    for (const key of added) {
        changes.push({ type: "addProp", key, value: next[key] as string | undefined });
    }
    for (const key of removed) {
        changes.push({ type: "removeProp", key });
    }

    for (const key of nextKeys) {
        if (key in prev && prev[key] !== next[key] && next[key]) {
            changes.push({ type: "forceValue", key, value: next[key] as string });
        }
    }

    return changes;
}