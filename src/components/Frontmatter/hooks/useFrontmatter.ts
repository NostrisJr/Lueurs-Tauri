import { useSetAtom, useStore } from "jotai";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { message } from "@tauri-apps/plugin-dialog";
import { treeAtom } from "../../../lib/atoms";
import { isSystemField, serializeFrontmatter, updateNodeInTree } from "../../../lib/fileTreeHelpers";
import { createLogger } from "../../../lib/logger";
import { NoteType } from "../../../lib/noteTypes";
import { flattenTree, type Frontmatter, type NoteFile } from "../../FileTree/useFileTree";

const log = createLogger("useFrontmatter");

// ── Helpers ────────────────────────────────────────────────────────────────

function toArray(value: string | string[] | undefined): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return value.split(",").map((v) => v.trim()).filter(Boolean);
}

function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((v, i) => v === sb[i]);
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useFrontmatter() {
    const store = useStore();
    const setTree = useSetAtom(treeAtom);

    // Lecture de l'arbre au moment de l'exécution, pas au render
    function getCurrentNotes() {
        return flattenTree(store.get(treeAtom));
    }

    function getMissingTemplateProps(noteFrontmatter: Frontmatter): Frontmatter {
        const allNotes = getCurrentNotes();
        const missing: Frontmatter = {};

        const directTemplates = toArray(noteFrontmatter.__Template__);
        const parentBases = toArray(noteFrontmatter.__Base__);
        const inheritedTemplates = parentBases.flatMap((basePath) => {
            const base = allNotes.find((n) => n.id === basePath);
            return base ? toArray(base.frontmatter.__Template__) : [];
        });

        const allTemplates = [...new Set([...directTemplates, ...inheritedTemplates])];

        for (const templatePath of allTemplates) {
            const template = allNotes.find((n) => n.id === templatePath);
            if (!template) {
                log.warn("template introuvable", { templatePath });
                continue;
            }
            for (const [key, value] of Object.entries(template.frontmatter)) {
                if (isSystemField(key)) continue;
                if (!(key in noteFrontmatter)) {
                    missing[key] = value ?? "";
                    log.info("propriété manquante ajoutée depuis template", { key, templatePath });
                }
            }
        }

        return missing;
    }

    async function applyTemplateProps(noteId: string, frontmatter: Frontmatter): Promise<Frontmatter | null> {
        if (frontmatter.__Type__ === NoteType.BASE) return null;

        const missing = getMissingTemplateProps(frontmatter);
        if (Object.keys(missing).length === 0) return null;

        const updated: Frontmatter = { ...frontmatter, ...missing };
        const note = getCurrentNotes().find((n) => n.id === noteId);
        if (!note) return updated;

        const raw = serializeFrontmatter(updated, note.body);
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        await writeTextFile(noteId, raw, { baseDir: null } as any);
        setTree((prev) => updateNodeInTree(prev, noteId, { frontmatter: updated }));
        log.info("propriétés template appliquées", { noteId, added: Object.keys(missing) });

        return updated;
    }

    async function onFrontmatterChange(
        noteId: string,
        prevFrontmatter: Frontmatter,
        nextFrontmatter: Frontmatter,
    ) {
        const prevBases = toArray(prevFrontmatter.__Base__);
        const nextBases = toArray(nextFrontmatter.__Base__);

        if (!arraysEqual(prevBases, nextBases)) {
            log.info("__Base__ modifié", { noteId, prevBases, nextBases });
            const basesAdded = nextBases.filter((b) => !prevBases.includes(b));
            const basesRemoved = prevBases.filter((b) => !nextBases.includes(b));
            await Promise.all([
                ...basesAdded.map((basePath) => addToChildren(basePath, noteId)),
                ...basesRemoved.map((basePath) => removeFromChildren(basePath, noteId)),
            ]);
        }

        const templateChanged = !arraysEqual(
            toArray(prevFrontmatter.__Template__),
            toArray(nextFrontmatter.__Template__)
        );
        if (templateChanged || !arraysEqual(prevBases, nextBases)) {
            await applyTemplateProps(noteId, nextFrontmatter);

            if (templateChanged) {
                const children = toArray(nextFrontmatter.__Children__);
                await Promise.all(children.map(async (childPath) => {
                    const child = getCurrentNotes().find((n) => n.id === childPath);
                    if (child) await applyTemplateProps(childPath, child.frontmatter);
                }));
                if (children.length > 0) {
                    log.info("template propagé aux enfants de la base", { noteId, childCount: children.length });
                }
            }
        }

        const prevChildren = toArray(prevFrontmatter.__Children__);
        const nextChildren = toArray(nextFrontmatter.__Children__);

        if (!arraysEqual(prevChildren, nextChildren)) {
            log.info("__Children__ modifié", { noteId, prevChildren, nextChildren });
            const childrenAdded = nextChildren.filter((c) => !prevChildren.includes(c));
            const childrenRemoved = prevChildren.filter((c) => !nextChildren.includes(c));
            await Promise.all([
                ...childrenAdded.map((childPath) => addBaseToNote(childPath, noteId)),
                ...childrenRemoved.map((childPath) => removeBaseFromNote(childPath, noteId)),
            ]);
        }
    }

    async function addToChildren(basePath: string, noteId: string) {
        const base = getCurrentNotes().find((n) => n.id === basePath);
        if (!base) {
            log.warn("base introuvable pour ajout __Children__", { basePath });
            return;
        }
        const children = toArray(base.frontmatter.__Children__);
        if (children.includes(noteId)) {
            log.info("note déjà dans __Children__", { basePath, noteId });
            return;
        }
        await writeBaseChildren(base, [...children, noteId]);
        log.info("note ajoutée à __Children__", { basePath, noteId });
    }

    async function removeFromChildren(basePath: string, noteId: string) {
        const base = getCurrentNotes().find((n) => n.id === basePath);
        if (!base) {
            log.warn("base introuvable pour retrait __Children__", { basePath });
            return;
        }
        const children = toArray(base.frontmatter.__Children__);
        const updated = children.filter((c) => c !== noteId);
        if (updated.length === children.length) return;
        await writeBaseChildren(base, updated);
        log.info("note retirée de __Children__", { basePath, noteId });
    }

    async function addBaseToNote(notePath: string, basePath: string) {
        const note = getCurrentNotes().find((n) => n.id === notePath);
        if (!note) {
            log.warn("note enfant introuvable pour ajout __Base__", { notePath });
            return;
        }
        const bases = toArray(note.frontmatter.__Base__);
        if (bases.includes(basePath)) return;
        const updatedFrontmatter = await writeNoteBase(note, [...bases, basePath]);
        await applyTemplateProps(notePath, updatedFrontmatter);
        log.info("__Base__ ajouté à la note enfant", { notePath, basePath });
    }

    async function removeBaseFromNote(notePath: string, basePath: string) {
        const note = getCurrentNotes().find((n) => n.id === notePath);
        if (!note) {
            log.warn("note enfant introuvable pour retrait __Base__", { notePath });
            return;
        }
        const bases = toArray(note.frontmatter.__Base__);
        const updated = bases.filter((b) => b !== basePath);
        if (updated.length === bases.length) return;
        await writeNoteBase(note, updated);
        log.info("__Base__ retiré de la note enfant", { notePath, basePath });
    }

    async function writeNoteBase(note: NoteFile, bases: string[]): Promise<Frontmatter> {
        const updatedFrontmatter: Frontmatter = { ...note.frontmatter, "__Base__": bases };
        const raw = serializeFrontmatter(updatedFrontmatter, note.body);
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        await writeTextFile(note.id, raw, { baseDir: null } as any);
        setTree((prev) => updateNodeInTree(prev, note.id, { frontmatter: updatedFrontmatter }));
        log.info("__Base__ persisté et arbre mis à jour", { noteId: note.id, count: bases.length });
        return updatedFrontmatter;
    }

    /** Arbre mis à jour immédiatement, persistance disque en arrière-plan. */
    function writeBaseChildren(base: NoteFile, children: string[]) {
        const updatedFrontmatter: Frontmatter = { ...base.frontmatter, "__Children__": children };
        log.info("writeBaseChildren — avant setTree", { baseId: base.id, children });
        setTree((prev) => {
            const next = updateNodeInTree(prev, base.id, { frontmatter: updatedFrontmatter });
            log.info("writeBaseChildren — setTree appelé", { baseId: base.id });
            return next;
        });
        const raw = serializeFrontmatter(updatedFrontmatter, base.body);
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        writeTextFile(base.id, raw, { baseDir: null } as any).catch((err) =>
            log.error("échec persistance __Children__", { baseId: base.id, err })
        );
        log.info("writeBaseChildren — terminé", { baseId: base.id, count: children.length });
    }

    async function refreshBaseChildren(base: NoteFile) {
        log.info("refresh __Children__", { baseId: base.id });
        const allNotes = getCurrentNotes();
        const orphans: string[] = [];
        const found: string[] = [];

        for (const note of allNotes) {
            if (note.id === base.id) continue;
            if (toArray(note.frontmatter.__Base__).includes(base.id)) {
                found.push(note.id);
            }
        }

        const currentChildren = toArray(base.frontmatter.__Children__);
        for (const childPath of currentChildren) {
            if (!allNotes.find((n) => n.id === childPath) && !found.includes(childPath)) {
                orphans.push(childPath);
            }
        }

        if (orphans.length > 0) {
            log.warn("enfants introuvables au refresh", { orphans });
            await message(
                `${orphans.length} note(s) introuvable(s) dans le vault :\n${orphans.join("\n")}\n\nElles ont été retirées de la base.`,
                { title: "Refresh — notes introuvables", kind: "warning" }
            );
        }

        await writeBaseChildren(base, found);
        log.info("refresh terminé", { baseId: base.id, childCount: found.length, orphanCount: orphans.length });
        return found;
    }

    async function cleanupNoteFromBases(noteId: string) {
        const allNotes = getCurrentNotes();
        log.info("cleanup — snapshot arbre", { totalNotes: allNotes.length, noteId });

        const bases = allNotes.filter((n) =>
            toArray(n.frontmatter.__Children__).includes(noteId)
        );
        log.info("cleanup — bases trouvées", { baseCount: bases.length, baseIds: bases.map((b) => b.id) });

        if (bases.length === 0) return;

        for (const base of bases) {
            const avant = toArray(base.frontmatter.__Children__);
            const apres = avant.filter((c) => c !== noteId);
            log.info("cleanup — writeBaseChildren", { baseId: base.id, avant, apres });
            writeBaseChildren(base, apres);
        }

        log.info("cleanup — terminé", { noteId });
    }

    return {
        onFrontmatterChange,
        refreshBaseChildren,
        applyTemplateProps,
        cleanupNoteFromBases,
    };
}