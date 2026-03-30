import { useStore } from "jotai";
import { treeAtom } from "../lib/atoms";
import { flattenTree, type Frontmatter } from "../components/FileTree/hooks/useFileTree";
import { toArray } from "../components/FileTree/lib/fileTreeHelpers";
import { SystemField } from "../lib/noteTypes";
import { usePersistNote } from "./usePersistNote";
import { createLogger } from "../lib/logger";

const log = createLogger("usePathPropagation");

const PATH_FIELDS = [SystemField.TEMPLATE, SystemField.BASE, SystemField.CHILDREN] as const;

/**
 * Applique un remplacement de paths sur les champs __Template__, __Base__, __Children__.
 * Retourne le frontmatter modifié et un flag indiquant si au moins un champ a changé.
 */
function replaceInPathFields(
    frontmatter: Frontmatter,
    predicate: (p: string) => boolean,
    replace: (p: string) => string,
): Frontmatter {
    const updated = { ...frontmatter };
    for (const field of PATH_FIELDS) {
        const val = toArray(updated[field]);
        if (!val.some(predicate)) continue;
        updated[field] = val.map((p) => (predicate(p) ? replace(p) : p));
    }
    return updated;
}

export function usePathPropagation() {
    const store = useStore();
    const persistPatch = usePersistNote();

    /**
     * Met à jour toutes les notes qui référencent oldPath dans leurs champs path.
     * À appeler après un rename de note, avant de mettre à jour activeNoteId.
     */
    async function propagateNoteRename(oldPath: string, newPath: string) {
        const allNotes = flattenTree(store.get(treeAtom));
        const affected = allNotes.filter(
            (n) =>
                n.id !== oldPath &&
                PATH_FIELDS.some((field) => toArray(n.frontmatter[field]).includes(oldPath))
        );

        if (affected.length === 0) {
            log.info("aucune référence à propager", { oldPath });
            return;
        }

        log.info("propagation renommage note", { oldPath, newPath, count: affected.length });

        await Promise.all(
            affected.map((note) => {
                const updated = replaceInPathFields(
                    note.frontmatter,
                    (p) => p === oldPath,
                    () => newPath,
                );
                return persistPatch(note.id, updated, note.body);
            })
        );
    }

    /**
     * Met à jour toutes les notes qui référencent un path sous oldFolderPath/.
     * À appeler après un rename de dossier, une fois treeAtom mis à jour par renameNode.
     * Couvre à la fois les notes extérieures et les notes intérieures qui se réfèrent entre elles.
     */
    async function propagateFolderRename(oldFolderPath: string, newFolderPath: string) {
        const prefix = `${oldFolderPath}/`;
        const allNotes = flattenTree(store.get(treeAtom));
        const affected = allNotes.filter((n) =>
            PATH_FIELDS.some((field) =>
                toArray(n.frontmatter[field]).some((p) => p.startsWith(prefix))
            )
        );

        if (affected.length === 0) {
            log.info("aucune référence à propager", { oldFolderPath });
            return;
        }

        log.info("propagation renommage dossier", { oldFolderPath, newFolderPath, count: affected.length });

        await Promise.all(
            affected.map((note) => {
                const updated = replaceInPathFields(
                    note.frontmatter,
                    (p) => p.startsWith(prefix),
                    (p) => `${newFolderPath}/${p.slice(prefix.length)}`,
                );
                return persistPatch(note.id, updated, note.body);
            })
        );
    }

    return { propagateNoteRename, propagateFolderRename };
}
