import { useAtomValue, useSetAtom, useStore } from "jotai";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { treeAtom, folderPathAtom, writingPathsRegistry, skipPropagationAtom } from "../lib/atoms";
import { flattenTree, type Frontmatter } from "../components/FileTree/hooks/useFileTree";
import { serializeFrontmatter, updateNodeInTree, isSystemField } from "../components/FileTree/lib/fileTreeHelpers";
import { invoke } from "@tauri-apps/api/core";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { createLogger } from "../lib/logger";
import { loadTree, applyAllTemplates } from "../lib/vaultIO";
import { NoteType, SystemField } from "../lib/noteTypes";

const log = createLogger("useTemplateSync");

// ── Types ──────────────────────────────────────────────────────────────────

type TemplateChange =
    | { type: "addProp"; key: string; value?: string }
    | { type: "removeProp"; key: string }
    | { type: "renameProp"; old_key: string; new_key: string }
    | { type: "forceValue"; key: string; value: string };

interface PropagateResult {
    modified: number;
    errors: string[];
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTemplateSync() {
    const store = useStore();
    const tree = useAtomValue(treeAtom);
    const setTree = useSetAtom(treeAtom);
    const folderPath = useAtomValue(folderPathAtom);
    const setSkipPropagation = useSetAtom(skipPropagationAtom);
    const allNotes = flattenTree(tree);

    async function onTemplateChange(templateId: string, prev: Frontmatter, next: Frontmatter) {
        if (!folderPath) return;

        const changes = diffFrontmatter(prev, next);
        if (changes.length === 0) return;

        // Lire skipPropagationAtom au moment de l'exécution (pas au rendu)
        const skipPropagation = store.get(skipPropagationAtom);

        const filteredChanges = changes.filter((change) => {
            if (change.type !== "removeProp") return true;
            if (skipPropagation.has(change.key)) {
                log.info("propagation ignorée pour cette clé", { key: change.key });
                return false;
            }
            return true;
        });

        // Vider l'atom après consommation
        if (skipPropagation.size > 0) setSkipPropagation(new Set());

        log.info("changements template détectés", { templateId, changes: filteredChanges });
        for (const change of filteredChanges) {
            await propagate(templateId, change);
        }
    }

    async function renameTemplateProperty(templateId: string, oldKey: string, newKey: string) {
        if (!folderPath) return;

        const allPaths = [templateId, ...resolveAllHeirs(templateId)];
        log.info("renommage propriété template", { templateId, oldKey, newKey, pathCount: allPaths.length });

        for (const p of allPaths) writingPathsRegistry.add(p);

        try {
            const result = await invoke<PropagateResult>("propagate_template_change", {
                affectedPaths: allPaths,
                change: { type: "renameProp", old_key: oldKey, new_key: newKey },
            });
            log.info("renommage Rust terminé", { modified: result.modified, errors: result.errors });

            const nodes = await loadTree(folderPath);
            const finalNodes = await applyAllTemplates(nodes);
            setTree(finalNodes);
        } finally {
            for (const p of allPaths) writingPathsRegistry.delete(p);
        }
    }

    /**
     * Vérifie si une propriété est utilisée comme KanbanKey dans une base héritière.
     * Propose de supprimer la vue Kanban en cascade.
     * Retourne false si l'utilisateur refuse (annule la suppression de la propriété).
     */
    async function checkKanbanKeyUsage(templateId: string, propKey: string): Promise<boolean> {
        const affectedBases = resolveHeirBases(templateId).filter(
            (base) => base.frontmatter[SystemField.KANBAN_KEY] === propKey
        );

        if (affectedBases.length === 0) return true;

        const baseNames = affectedBases.map((b) => b.name).join(", ");
        log.info("propriété utilisée comme KanbanKey", { propKey, bases: baseNames });

        const confirmed = await ask(
            `La propriété "${propKey}" est utilisée comme clé Kanban dans : ${baseNames}.\n\nSupprimer aussi la vue Kanban de ces bases ?`,
            { title: "Propriété Kanban", kind: "warning" }
        );

        if (!confirmed) {
            log.info("suppression annulée — KanbanKey protégée", { propKey });
            return false;
        }

        for (const base of affectedBases) {
            const { [SystemField.VIEW]: _v, [SystemField.KANBAN_KEY]: _k, [SystemField.KANBAN_COLUMNS]: _c, ...rest } = base.frontmatter;
            const raw = serializeFrontmatter(rest, base.body);

            try {
                writingPathsRegistry.add(base.id);
                // biome-ignore lint/suspicious/noExplicitAny: baseDir null requis par Tauri
                await writeTextFile(base.id, raw, { baseDir: null } as any);
                setTree((prev) => updateNodeInTree(prev, base.id, { frontmatter: rest }));
                log.info("vue Kanban supprimée de la base", { baseId: base.id });
            } catch (err) {
                log.error("échec suppression vue Kanban", { baseId: base.id, err });
                await message(`Impossible de modifier la base "${base.name}".`, { title: "Erreur", kind: "error" });
            } finally {
                writingPathsRegistry.delete(base.id);
            }
        }

        return true;
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
                    return base ? toArray(base.frontmatter.__Template__).includes(templateId) : false;
                });
            })
            .map((n) => n.id);
    }

    function resolveHeirBases(templateId: string) {
        return allNotes.filter(
            (note) =>
                note.type === NoteType.BASE &&
                toArray(note.frontmatter.__Template__).includes(templateId)
        );
    }

    return { onTemplateChange, renameTemplateProperty, checkKanbanKeyUsage };
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

    if (added.length === 1 && removed.length === 1) {
        changes.push({ type: "renameProp", old_key: removed[0], new_key: added[0] });
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