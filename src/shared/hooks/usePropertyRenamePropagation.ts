/**
 * usePropertyRenamePropagation.ts
 *
 * Renommer une propriété ne suffit pas : les formules qui la référencent
 * gardent l'ancien nom et se mettent à valoir 0 silencieusement. On réécrit
 * donc, dans tout le vault :
 *   - `self["ancien"]` dans les formules des notes qui PORTENT la propriété
 *   - `ref("<note>")["ancien"]` dans les formules de toutes les autres notes
 * frontmatter ET corps de note.
 *
 * Rappel de convention (cf. plugins/inline-formula/refPaths.ts) : les `ref()`
 * du frontmatter portent un chemin absolu en mémoire, ceux du corps un chemin
 * relatif au vault. D'où les deux jeux d'options ci-dessous.
 *
 * Pendant symétrique de usePathPropagation (renommage de NOTE).
 */

import { useStore } from "jotai";
import { activeNoteIdAtom, folderPathAtom, treeAtom } from "../lib/atoms";
import {
  type FormulaRenameOptions,
  isFormula,
  renamePropertyInFormula,
  rewriteBodyFormulas,
} from "../lib/formulas";
import { createLogger } from "../lib/logger";
import { toVaultRelative } from "../plugins/inline-formula/refPaths";
import { rewriteOpenEditorFormulas } from "../plugins/inline-formula/rewriteOpenFormulas";
import { type Frontmatter, flattenTree } from "./useFileTree";
import { usePersistNote } from "./usePersistNote";

const log = createLogger("usePropertyRenamePropagation");

/** Réécrit les valeurs formule d'un frontmatter. */
function renameInFrontmatter(
  frontmatter: Frontmatter,
  opts: FormulaRenameOptions
): { frontmatter: Frontmatter; changed: boolean } {
  let changed = false;
  const next: Frontmatter = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (isFormula(value)) {
      const rewritten = renamePropertyInFormula(value, opts);
      if (rewritten !== value) changed = true;
      next[key] = rewritten;
    } else {
      next[key] = value;
    }
  }
  return { frontmatter: next, changed };
}

export function usePropertyRenamePropagation() {
  const store = useStore();
  const persistPatch = usePersistNote();

  /**
   * @param ownerPaths Notes portant la propriété renommée (la note éditée, ou
   *                   le template et tous ses héritiers).
   */
  async function propagatePropertyRename(
    ownerPaths: string[],
    oldKey: string,
    newKey: string
  ) {
    if (!oldKey || !newKey || oldKey === newKey) return;

    const vault = store.get(folderPathAtom);
    const allNotes = flattenTree(store.get(treeAtom));
    const owners = new Set(ownerPaths);
    const openNoteId = store.get(activeNoteIdAtom);

    // Corps de note : les ref() sont relatifs au vault.
    const ownerByRelPath = new Map<string, string>();
    if (vault) {
      for (const p of owners) ownerByRelPath.set(toVaultRelative(p, vault), p);
    }

    const tasks: Array<Promise<unknown>> = [];
    let openBodyRewrite: ((raw: string) => string) | null = null;
    for (const note of allNotes) {
      const fmOpts: FormulaRenameOptions = {
        oldKey,
        newKey,
        isOwner: owners.has(note.id),
        isRefOwner: (path) => owners.has(path),
      };
      const bodyOpts: FormulaRenameOptions = {
        ...fmOpts,
        isRefOwner: (path) => owners.has(path) || ownerByRelPath.has(path),
      };

      const fm = renameInFrontmatter(note.frontmatter, fmOpts);

      // Note ouverte : son corps appartient à l'éditeur, pas au disque — il est
      // réécrit par transaction tout à la fin (cf. plus bas).
      if (note.id === openNoteId) {
        openBodyRewrite = (raw) => renamePropertyInFormula(raw, bodyOpts);
        if (fm.changed) {
          tasks.push(persistPatch(note.id, fm.frontmatter, note.body));
        }
        continue;
      }

      const body = rewriteBodyFormulas(note.body, (raw) =>
        renamePropertyInFormula(raw, bodyOpts)
      );

      if (fm.changed || body.changed) {
        tasks.push(persistPatch(note.id, fm.frontmatter, body.body));
      }
    }

    log.info("propagation renommage propriété", {
      oldKey,
      newKey,
      owners: ownerPaths.length,
      notes: tasks.length,
    });
    await Promise.all(tasks);

    if (!openBodyRewrite) return;
    // En dernier, et après un rendu : la transaction déclenche onChange, dont la
    // closure lit `activeNote.frontmatter`. Sans laisser React re-rendre, elle
    // repersisterait le frontmatter d'avant la réécriture ci-dessus.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    rewriteOpenEditorFormulas(openBodyRewrite);
  }

  return { propagatePropertyRename };
}
