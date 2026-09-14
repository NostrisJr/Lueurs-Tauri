import { ask } from "@tauri-apps/plugin-dialog";
import { useStore } from "jotai";
import { folderPathAtom, treeAtom } from "../lib/atoms";
import type { FileKind } from "../lib/fileTreeHelpers";
import { toArray } from "../lib/fileTreeHelpers";
import { isFormula, rewriteBodyFormulas } from "../lib/formulas";
import { createLogger } from "../lib/logger";
import { SystemField } from "../lib/noteTypes";
import { rewriteRefPaths } from "../plugins/inline-formula/refPaths";
import {
  rewriteMediaHrefs,
  stripBrokenMediaLinks,
} from "../plugins/wikilink/wikilinkRewrite";
import { type Frontmatter, flattenTree } from "./useFileTree";
import { usePersistNote } from "./usePersistNote";

const log = createLogger("useFileReferences");

// Champs frontmatter qui portent un chemin de note (array). Une note/dossier
// renommé(e) peut y apparaître ; un média jamais (cf. propagateRename).
const PATH_FIELDS = [
  SystemField.TEMPLATE,
  SystemField.BASE,
  SystemField.CHILDREN,
] as const;

// Champs path à valeur scalaire (kind "string", pas "noteArray") : même propagation
// que PATH_FIELDS mais sans passer par toArray, pour ne pas transformer le
// scalaire en tableau à 1 élément dans le frontmatter réécrit.
const SCALAR_PATH_FIELDS = [SystemField.DEFAULT_FOLDER] as const;

/** Vrai si un champ path (array ou scalaire) contient un path vérifiant predicate. */
function pathFieldsMatch(
  frontmatter: Frontmatter,
  predicate: (p: string) => boolean
): boolean {
  if (PATH_FIELDS.some((field) => toArray(frontmatter[field]).some(predicate)))
    return true;
  return SCALAR_PATH_FIELDS.some((field) => {
    const val = frontmatter[field];
    return typeof val === "string" && predicate(val);
  });
}

/**
 * Applique un remplacement de paths sur les champs __Template__, __Base__, __Children__
 * ainsi que __DefaultFolder__ (scalaire).
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
  for (const field of SCALAR_PATH_FIELDS) {
    const val = updated[field];
    if (typeof val === "string" && predicate(val)) {
      updated[field] = replace(val);
    }
  }
  return updated;
}

/** Réécrit les ref() d'un frontmatter (chemins absolus) selon predicate/replace. */
function replaceRefPathsInFrontmatter(
  frontmatter: Frontmatter,
  predicate: (p: string) => boolean,
  replace: (p: string) => string
): { frontmatter: Frontmatter; changed: boolean } {
  let changed = false;
  const next: Frontmatter = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (isFormula(value)) {
      const rewritten = rewriteRefPaths(value, (p) =>
        predicate(p) ? replace(p) : null
      );
      if (rewritten !== value) changed = true;
      next[key] = rewritten;
    } else {
      next[key] = value;
    }
  }
  return { frontmatter: next, changed };
}

/** Retire (au lieu de remplacer) les entrées d'un frontmatter vérifiant matches. */
function removeFromPathFields(
  frontmatter: Frontmatter,
  matches: (p: string) => boolean
): { frontmatter: Frontmatter; changed: boolean } {
  let changed = false;
  const updated = { ...frontmatter };
  for (const field of PATH_FIELDS) {
    const val = toArray(updated[field]);
    if (!val.some(matches)) continue;
    updated[field] = val.filter((p) => !matches(p));
    changed = true;
  }
  for (const field of SCALAR_PATH_FIELDS) {
    const val = updated[field];
    if (typeof val === "string" && matches(val)) {
      updated[field] = "";
      changed = true;
    }
  }
  return { frontmatter: updated, changed };
}

/** Chemin absolu → chemin relatif à la racine du vault, ou null si hors vault. */
function toVaultRelative(vault: string | null, abs: string): string | null {
  if (!vault) return null;
  const prefix = vault.endsWith("/") ? vault : `${vault}/`;
  return abs.startsWith(prefix) ? abs.slice(prefix.length) : null;
}

interface PathMatchers {
  /** Chemin absolu — frontmatter path fields + ref() en frontmatter. */
  matchesPath: (p: string) => boolean;
  /** Chemin relatif au vault — wikilinks/audio/images + ref() en corps. */
  matchesHref: (h: string) => boolean;
}

/** Matchers pour un chemin exact (note ou média) — pas de préfixe. */
function exactMatchers(vault: string | null, path: string): PathMatchers {
  const rel = toVaultRelative(vault, path);
  return {
    matchesPath: (p) => p === path,
    matchesHref: (h) => rel !== null && h === rel,
  };
}

/** Matchers pour un dossier et tout son contenu (préfixe). */
function prefixMatchers(
  vault: string | null,
  folderPath: string
): PathMatchers {
  const fmPrefix = `${folderPath}/`;
  const relFolder = toVaultRelative(vault, folderPath);
  const linkPrefix = relFolder !== null ? `${relFolder}/` : null;
  return {
    matchesPath: (p) => p === folderPath || p.startsWith(fmPrefix),
    matchesHref: (h) => linkPrefix !== null && h.startsWith(linkPrefix),
  };
}

/** Matchers pour un chemin donné, selon sa nature (dossier → préfixe, sinon exact). */
function matchersFor(
  kind: FileKind,
  path: string,
  vault: string | null
): PathMatchers {
  return kind === "folder"
    ? prefixMatchers(vault, path)
    : exactMatchers(vault, path);
}

/** Compte les occurrences vérifiant matches dans les path fields d'un frontmatter. */
function countPathFieldMatches(
  frontmatter: Frontmatter,
  matches: (p: string) => boolean
): number {
  let count = 0;
  for (const field of PATH_FIELDS) {
    count += toArray(frontmatter[field]).filter(matches).length;
  }
  for (const field of SCALAR_PATH_FIELDS) {
    const val = frontmatter[field];
    if (typeof val === "string" && matches(val)) count++;
  }
  return count;
}

/** Compte les ref() d'une formule brute ($$…$$ ou son contenu) vérifiant matches. */
function countRefMatches(raw: string, matches: (p: string) => boolean): number {
  let count = 0;
  rewriteRefPaths(raw, (p) => {
    if (matches(p)) count++;
    return null; // lecture seule : aucun remplacement
  });
  return count;
}

/** Compte les href (wikilinks/audio/images) d'un corps vérifiant matches. */
function countHrefMatches(
  body: string,
  matches: (h: string) => boolean
): number {
  let count = 0;
  rewriteMediaHrefs(body, (h) => {
    if (matches(h)) count++;
    return null;
  });
  return count;
}

/** Compte les ref() du corps vérifiant matches (scopé aux formules $$…$$, comme la propagation). */
function countBodyRefMatches(
  body: string,
  matches: (p: string) => boolean
): number {
  let count = 0;
  rewriteBodyFormulas(body, (raw) => {
    count += countRefMatches(raw, matches);
    return raw; // lecture seule
  });
  return count;
}

export function useFileReferences() {
  const store = useStore();
  const persistPatch = usePersistNote();

  /**
   * Scanne tout le vault et réécrit les références à un chemin renommé/déplacé.
   * matchesPath/replacePath opèrent sur les chemins absolus (frontmatter path
   * fields + ref() en frontmatter) ; matchesHref/replaceHref sur les chemins
   * relatifs au vault (corps : wikilinks/audio/images + ref() en corps).
   * isNoteLike=false (média) : seul le corps est concerné, un média n'apparaît
   * jamais dans un path field ni un ref().
   */
  async function run(
    isNoteLike: boolean,
    matchesPath: (p: string) => boolean,
    replacePath: (p: string) => string,
    matchesHref: (h: string) => boolean,
    replaceHref: (h: string) => string
  ) {
    const allNotes = flattenTree(store.get(treeAtom));
    const tasks: Array<Promise<unknown>> = [];

    for (const note of allNotes) {
      let frontmatter = note.frontmatter;
      let fmChanged = false;

      if (isNoteLike) {
        if (pathFieldsMatch(frontmatter, matchesPath)) {
          frontmatter = replaceInPathFields(
            frontmatter,
            matchesPath,
            replacePath
          );
          fmChanged = true;
        }
        const refResult = replaceRefPathsInFrontmatter(
          frontmatter,
          matchesPath,
          replacePath
        );
        if (refResult.changed) {
          frontmatter = refResult.frontmatter;
          fmChanged = true;
        }
      }

      const { body: bodyAfterHrefs, changed: hrefsChanged } = rewriteMediaHrefs(
        note.body,
        (h) => (matchesHref(h) ? replaceHref(h) : null)
      );
      let body = bodyAfterHrefs;
      let bodyChanged = hrefsChanged;

      if (isNoteLike) {
        const refResult = rewriteBodyFormulas(body, (raw) =>
          rewriteRefPaths(raw, (p) => (matchesHref(p) ? replaceHref(p) : null))
        );
        if (refResult.changed) {
          body = refResult.body;
          bodyChanged = true;
        }
      }

      if (fmChanged || bodyChanged) {
        tasks.push(persistPatch(note.id, frontmatter, body));
      }
    }

    if (tasks.length === 0) {
      log.info("aucune référence à propager");
      return;
    }
    log.info("propagation de référence", { count: tasks.length });
    await Promise.all(tasks);
  }

  /** Rename/déplacement exact (note ou média) : oldPath === le chemin visé, pas de préfixe. */
  async function propagateExactRename(
    oldPath: string,
    newPath: string,
    kind: FileKind
  ) {
    const vault = store.get(folderPathAtom);
    const { matchesPath, matchesHref } = exactMatchers(vault, oldPath);
    const relNew = toVaultRelative(vault, newPath);

    await run(
      kind !== "media",
      matchesPath,
      () => newPath,
      matchesHref,
      () => relNew as string
    );
  }

  /**
   * Rename/déplacement de dossier : tout chemin sous oldFolderPath/ (ou égal,
   * pour un scalaire comme __DefaultFolder__) est concerné — notes, sous-
   * dossiers, ET médias imbriqués (rewriteMediaHrefs couvre les deux).
   */
  async function propagateFolderRename(
    oldFolderPath: string,
    newFolderPath: string
  ) {
    const vault = store.get(folderPathAtom);
    const fmPrefix = `${oldFolderPath}/`;
    const relOldFolder = toVaultRelative(vault, oldFolderPath);
    const relNewFolder = toVaultRelative(vault, newFolderPath);
    const linkPrefix = relOldFolder !== null ? `${relOldFolder}/` : null;
    const { matchesPath, matchesHref } = prefixMatchers(vault, oldFolderPath);

    const replacePath = (p: string) =>
      p === oldFolderPath
        ? newFolderPath
        : `${newFolderPath}/${p.slice(fmPrefix.length)}`;
    const replaceHref = (h: string) =>
      `${relNewFolder}/${h.slice((linkPrefix as string).length)}`;

    await run(true, matchesPath, replacePath, matchesHref, replaceHref);
  }

  /**
   * Point d'entrée unique de la propagation de rename/move — à appeler après
   * chaque rename/move de note, dossier ou média (fileTreeMutations.renameNode
   * / moveNode / tout call-site équivalent), quelle que soit la plateforme.
   */
  async function propagateRename(
    oldPath: string,
    newPath: string,
    kind: FileKind
  ) {
    if (kind === "folder") {
      await propagateFolderRename(oldPath, newPath);
    } else {
      await propagateExactRename(oldPath, newPath, kind);
    }
  }

  /**
   * Compte les références à un chemin sur le point d'être supprimé — path
   * fields, wikilinks/audio/images du corps, ref() (frontmatter et corps).
   * À appeler avant suppression pour avertir l'utilisateur (cf. cleanupReferences).
   */
  async function countReferences(
    path: string,
    kind: FileKind
  ): Promise<number> {
    const vault = store.get(folderPathAtom);
    const { matchesPath, matchesHref } = matchersFor(kind, path, vault);
    const isNoteLike = kind !== "media";
    const allNotes = flattenTree(store.get(treeAtom));

    let total = 0;
    for (const note of allNotes) {
      if (isNoteLike) {
        total += countPathFieldMatches(note.frontmatter, matchesPath);
        for (const value of Object.values(note.frontmatter)) {
          if (isFormula(value)) total += countRefMatches(value, matchesPath);
        }
        total += countBodyRefMatches(note.body, matchesHref);
      }
      total += countHrefMatches(note.body, matchesHref);
    }
    return total;
  }

  /**
   * Nettoie les références à un chemin supprimé, après confirmation de
   * l'utilisateur (cf. countReferences) : retire les entrées des path fields
   * (__Template__/__Base__/__Children__/__DefaultFolder__) et les liens/
   * images/blocs audio du corps (remplacés par le texte — ou l'alt — en
   * surlignage rouge =={red}...==, signalant la référence rompue).
   * Les ref() de formule ne sont pas touchés : casser une formule
   * silencieusement (0/null) serait pire qu'un lien mort visible — ils
   * restent signalés comme cassés au rendu plutôt que réécrits ici.
   */
  async function cleanupReferences(
    path: string,
    kind: FileKind
  ): Promise<void> {
    const vault = store.get(folderPathAtom);
    const { matchesPath, matchesHref } = matchersFor(kind, path, vault);
    const isNoteLike = kind !== "media";
    const allNotes = flattenTree(store.get(treeAtom));
    const tasks: Array<Promise<unknown>> = [];

    for (const note of allNotes) {
      let frontmatter = note.frontmatter;
      let fmChanged = false;

      if (isNoteLike) {
        const result = removeFromPathFields(frontmatter, matchesPath);
        if (result.changed) {
          frontmatter = result.frontmatter;
          fmChanged = true;
        }
      }

      const { body, changed: bodyChanged } = stripBrokenMediaLinks(
        note.body,
        matchesHref
      );

      if (fmChanged || bodyChanged) {
        tasks.push(persistPatch(note.id, frontmatter, body));
      }
    }

    if (tasks.length === 0) {
      log.info("aucune référence à nettoyer", { path, kind });
      return;
    }
    log.info("nettoyage de références après suppression", {
      path,
      kind,
      count: tasks.length,
    });
    await Promise.all(tasks);
  }

  /**
   * Étape de confirmation + nettoyage à jouer avant toute suppression : compte
   * les références au chemin visé et, s'il y en a, demande confirmation (même
   * pattern que la propagation de suppression de propriété de template, cf.
   * FrontmatterEditor.tsx) avant de les nettoyer. Un refus laisse les
   * références telles quelles (signalées cassées au rendu).
   */
  async function confirmAndCleanupReferences(
    path: string,
    kind: FileKind
  ): Promise<void> {
    const count = await countReferences(path, kind);
    if (count === 0) return;
    const label =
      count === 1
        ? "1 référence va être cassée."
        : `${count} références vont être cassées.`;
    const clean = await ask(`${label} Nettoyer automatiquement ?`, {
      title: "Suppression",
      kind: "warning",
    });
    if (clean) await cleanupReferences(path, kind);
  }

  return {
    propagateRename,
    countReferences,
    cleanupReferences,
    confirmAndCleanupReferences,
  };
}
