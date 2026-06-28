import { useStore } from "jotai";
import { folderPathAtom, treeAtom } from "../lib/atoms";
import { toArray } from "../lib/fileTreeHelpers";
import { createLogger } from "../lib/logger";
import { SystemField } from "../lib/noteTypes";
import { rewriteNoteLinkHrefs } from "../plugins/wikilink/wikilinkRewrite";
import { type Frontmatter, flattenTree } from "./useFileTree";
import { usePersistNote } from "./usePersistNote";

const log = createLogger("usePathPropagation");

const PATH_FIELDS = [
  SystemField.TEMPLATE,
  SystemField.BASE,
  SystemField.CHILDREN,
] as const;

/**
 * Applique un remplacement de paths sur les champs __Template__, __Base__, __Children__.
 * Retourne le frontmatter modifié et un flag indiquant si au moins un champ a changé.
 */
function replaceInPathFields(
  frontmatter: Frontmatter,
  predicate: (p: string) => boolean,
  replace: (p: string) => string
): Frontmatter {
  const updated = { ...frontmatter };
  for (const field of PATH_FIELDS) {
    const val = toArray(updated[field]);
    if (!val.some(predicate)) continue;
    updated[field] = val.map((p) => (predicate(p) ? replace(p) : p));
  }
  return updated;
}

/** Chemin absolu → chemin relatif à la racine du vault, ou null si hors vault. */
function toVaultRelative(vault: string | null, abs: string): string | null {
  if (!vault) return null;
  const prefix = vault.endsWith("/") ? vault : `${vault}/`;
  return abs.startsWith(prefix) ? abs.slice(prefix.length) : null;
}

export function usePathPropagation() {
  const store = useStore();
  const persistPatch = usePersistNote();

  /**
   * Met à jour toutes les notes qui référencent oldPath :
   *   - champs path du frontmatter (__Template__, __Base__, __Children__)
   *   - wikilinks dans le corps ([[relpath.md]])
   * À appeler après un rename de note, avant de mettre à jour activeNoteId.
   */
  async function propagateNoteRename(oldPath: string, newPath: string) {
    const vault = store.get(folderPathAtom);
    const allNotes = flattenTree(store.get(treeAtom));
    const relOld = toVaultRelative(vault, oldPath);
    const relNew = toVaultRelative(vault, newPath);

    const tasks: Array<Promise<unknown>> = [];
    for (const note of allNotes) {
      const fmChanged = PATH_FIELDS.some((field) =>
        toArray(note.frontmatter[field]).includes(oldPath)
      );
      const updatedFm = fmChanged
        ? replaceInPathFields(
            note.frontmatter,
            (p) => p === oldPath,
            () => newPath
          )
        : note.frontmatter;

      const { body, changed: bodyChanged } =
        relOld && relNew
          ? rewriteNoteLinkHrefs(note.body, (h) =>
              h === relOld ? relNew : null
            )
          : { body: note.body, changed: false };

      if (fmChanged || bodyChanged) {
        tasks.push(persistPatch(note.id, updatedFm, body));
      }
    }

    if (tasks.length === 0) {
      log.info("aucune référence à propager", { oldPath });
      return;
    }

    log.info("propagation renommage note", {
      oldPath,
      newPath,
      count: tasks.length,
    });
    await Promise.all(tasks);
  }

  /**
   * Met à jour toutes les notes qui référencent un path sous oldFolderPath/ :
   *   - champs path du frontmatter
   *   - wikilinks dans le corps
   * À appeler après un rename de dossier, une fois treeAtom mis à jour par renameNode.
   * Couvre à la fois les notes extérieures et les notes intérieures qui se réfèrent entre elles.
   */
  async function propagateFolderRename(
    oldFolderPath: string,
    newFolderPath: string
  ) {
    const vault = store.get(folderPathAtom);
    const allNotes = flattenTree(store.get(treeAtom));
    const fmPrefix = `${oldFolderPath}/`;
    const relOldFolder = toVaultRelative(vault, oldFolderPath);
    const relNewFolder = toVaultRelative(vault, newFolderPath);
    const linkPrefix = relOldFolder !== null ? `${relOldFolder}/` : null;

    const tasks: Array<Promise<unknown>> = [];
    for (const note of allNotes) {
      const fmChanged = PATH_FIELDS.some((field) =>
        toArray(note.frontmatter[field]).some((p) => p.startsWith(fmPrefix))
      );
      const updatedFm = fmChanged
        ? replaceInPathFields(
            note.frontmatter,
            (p) => p.startsWith(fmPrefix),
            (p) => `${newFolderPath}/${p.slice(fmPrefix.length)}`
          )
        : note.frontmatter;

      const { body, changed: bodyChanged } =
        linkPrefix && relNewFolder !== null
          ? rewriteNoteLinkHrefs(note.body, (h) =>
              h.startsWith(linkPrefix)
                ? `${relNewFolder}/${h.slice(linkPrefix.length)}`
                : null
            )
          : { body: note.body, changed: false };

      if (fmChanged || bodyChanged) {
        tasks.push(persistPatch(note.id, updatedFm, body));
      }
    }

    if (tasks.length === 0) {
      log.info("aucune référence à propager", { oldFolderPath });
      return;
    }

    log.info("propagation renommage dossier", {
      oldFolderPath,
      newFolderPath,
      count: tasks.length,
    });
    await Promise.all(tasks);
  }

  return { propagateNoteRename, propagateFolderRename };
}
