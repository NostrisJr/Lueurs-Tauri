/**
 * useTemplateSync — gère la propagation des modifications d'un template
 * vers toutes les notes héritières, via la commande Rust propagate_template_change.
 */
import { useAtomValue, useSetAtom } from "jotai";
import { treeAtom, folderPathAtom, writingPathsRegistry } from "../lib/atoms";
import { flattenTree, type Frontmatter } from "../components/FileTree/useFileTree";
import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";
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

    /**
     * Appelé depuis onFrontmatterChange quand la note active est un __template__.
     * Compare ancien/nouveau frontmatter et dispatche les changements vers Rust.
     */
    async function onTemplateChange(
        templateId: string,
        prev: Frontmatter,
        next: Frontmatter,
    ) {
        if (!folderPath) return;

        const changes = diffFrontmatter(prev, next);
        if (changes.length === 0) return;

        log.info("changements template détectés", { templateId, changes });

        for (const change of changes) {
            if (change.type === "removeProp") {
                const confirmed = await ask(
                    `Supprimer la propriété "${change.key}" de toutes les notes utilisant ce template ?`,
                    { title: "Propagation du template", kind: "warning" }
                );
                if (!confirmed) continue;
            }
            await propagate(templateId, change);
        }
        // Pas de reloadTree — les héritiers ont été mis à jour en mémoire dans propagate
    }

    /**
     * Renomme une propriété dans un template et propage aux héritiers.
     * Appelé explicitement depuis PropertyEditModal.
     */
    async function renameTemplateProperty(
        templateId: string,
        oldKey: string,
        newKey: string,
    ) {
        if (!folderPath) return;

        const allPaths = [templateId, ...resolveAllHeirs(templateId)];
        log.info("renommage propriété template", { templateId, oldKey, newKey, pathCount: allPaths.length });

        // Verrouiller le watcher FS pour éviter un reload parasite pendant l'écriture Rust
        allPaths.forEach((p) => writingPathsRegistry.add(p));

        try {
            const result = await invoke<PropagateResult>("propagate_template_change", {
                affectedPaths: allPaths,
                change: { type: "renameProp", oldKey, newKey },
            });
            log.info("renommage Rust terminé", { modified: result.modified, errors: result.errors });

            // Recharger l'arbre depuis le disque — source de vérité après écriture Rust
            const nodes = await loadTree(folderPath);
            const finalNodes = await applyAllTemplates(nodes);
            setTree(finalNodes);
            log.info("arbre rechargé après renommage");
        } finally {
            allPaths.forEach((p) => writingPathsRegistry.delete(p));
        }
    }

    /**
     * Vérifie si le frontmatter d'une note viole des contraintes de valeur
     * imposées par ses templates. Retourne les clés qui ont été forcées.
     */
    function getConstraintViolations(
        noteId: string,
        frontmatter: Frontmatter,
    ): Record<string, string> {
        // Les bases ne sont pas contraintes — le template sert uniquement à templater leurs enfants
        if (frontmatter["__Type__"] === NoteType.BASE) return {};

        const violations: Record<string, string> = {};

        const templateIds = resolveAllTemplates(noteId, frontmatter);
        for (const templateId of templateIds) {
            const template = allNotes.find((n) => n.id === templateId);
            if (!template) continue;

            for (const [key, value] of Object.entries(template.frontmatter)) {
                if (isSystemField(key)) continue;
                if (!value) continue; // valeur vide = pas de contrainte
                if (frontmatter[key] !== value) {
                    violations[key] = value as string;
                }
            }
        }
        return violations;
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

        affectedPaths.forEach((p) => writingPathsRegistry.add(p));

        try {
            const result = await invoke<PropagateResult>("propagate_template_change", {
                affectedPaths,
                change,
            });
            log.info("propagation Rust terminée", { modified: result.modified, errors: result.errors });

            const nodes = await loadTree(folderPath);
            const finalNodes = await applyAllTemplates(nodes);
            setTree(finalNodes);
            log.info("arbre rechargé après propagation");
        } finally {
            affectedPaths.forEach((p) => writingPathsRegistry.delete(p));
        }
    }

    /**
     * Retourne tous les chemins de notes héritant du template donné,
     * soit directement (__Template__), soit via une base (__Base__ → __Template__).
     */
    function resolveAllHeirs(templateId: string): string[] {
        return allNotes
            .filter((note) => {
                if (note.id === templateId) return false;
                const directTemplates = toArray(note.frontmatter["__Template__"]);
                if (directTemplates.includes(templateId)) return true;
                // Héritage via base
                const bases = toArray(note.frontmatter["__Base__"]);
                return bases.some((basePath) => {
                    const base = allNotes.find((n) => n.id === basePath);
                    return base
                        ? toArray(base.frontmatter["__Template__"]).includes(templateId)
                        : false;
                });
            })
            .map((n) => n.id);
    }

    /** Résout tous les templateIds applicables à une note (direct + via bases). */
    function resolveAllTemplates(noteId: string, frontmatter: Frontmatter): string[] {
        const direct = toArray(frontmatter["__Template__"]);
        const bases = toArray(frontmatter["__Base__"]);
        const inherited = bases.flatMap((basePath) => {
            const base = allNotes.find((n) => n.id === basePath);
            return base ? toArray(base.frontmatter["__Template__"]) : [];
        });
        return [...new Set([...direct, ...inherited])];
    }

    return {
        onTemplateChange,
        getConstraintViolations,
    };
}

// ── Helpers purs ───────────────────────────────────────────────────────────

function toArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as string[];
    return [value as string];
}

/**
 * Compare deux frontmatters et retourne la liste des changements.
 * Les champs système sont ignorés (gérés ailleurs).
 */
function diffFrontmatter(prev: Frontmatter, next: Frontmatter): TemplateChange[] {
    const changes: TemplateChange[] = [];

    const prevKeys = Object.keys(prev).filter((k) => !isSystemField(k));
    const nextKeys = Object.keys(next).filter((k) => !isSystemField(k));

    const added = nextKeys.filter((k) => !(k in prev));
    const removed = prevKeys.filter((k) => !(k in next));

    // Un ajout + une suppression simultanés = renommage : propager via renameProp
    // pour que les héritiers gardent leur valeur existante
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

    // Valeurs modifiées sur les clés présentes des deux côtés
    for (const key of nextKeys) {
        if (key in prev && prev[key] !== next[key] && next[key]) {
            changes.push({ type: "forceValue", key, value: next[key] as string });
        }
    }

    return changes;
}