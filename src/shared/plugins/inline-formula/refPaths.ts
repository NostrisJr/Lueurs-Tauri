/**
 * refPaths.ts — chemins des `ref()` dans les formules inline du corps.
 *
 * Convention du CORPS de note (identique aux images, à l'audio et aux liens
 * entre notes) : chemin relatif à la racine du vault, sur disque comme dans
 * l'attribut du nœud. La résolution vers une note se fait à l'usage, via
 * `inlineFormulaBridge.noteResolver`.
 *
 * À ne pas confondre avec le frontmatter, qui garde ses `ref()` en absolu en
 * mémoire et ne les relativise qu'à l'écriture (`vaultIO.relativizePathFields`).
 * Le corps ne peut pas suivre cette convention : Milkdown parse le body EN
 * MÉMOIRE, et un chemin absolu de conteneur iCloud (`iCloud~com~lueurs~app`)
 * fragmente le nœud texte en nœuds `delete` — le scan `$$…$$` ne matche plus.
 */

const REF_RE = /ref\("([^"]+)"\)/g;

/** Chemin absolu → relatif à la racine du vault. Idempotent. */
export function toVaultRelative(path: string, vaultPath: string): string {
  const prefix = vaultPath.endsWith("/") ? vaultPath : `${vaultPath}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/**
 * Relativise tous les chemins `ref()` d'une formule brute.
 * Appliqué à la sérialisation : migre au passage les notes écrites avant
 * l'adoption du relatif (chemins absolus dans le corps).
 */
export function relativizeRefPaths(
  raw: string,
  vaultPath: string | null | undefined
): string {
  if (!vaultPath) return raw;
  REF_RE.lastIndex = 0;
  return raw.replace(
    REF_RE,
    (_, p: string) => `ref("${toVaultRelative(p, vaultPath)}")`
  );
}

/**
 * Réécrit les chemins `ref()` d'une formule brute selon `mapPath` (chemin →
 * nouveau chemin, ou null si inchangé). Symétrique à rewriteNoteLinkHrefs
 * (wikilinkRewrite.ts) côté formules — utilisé par la propagation de
 * renommage/déplacement (useFileReferences) pour suivre une note dont un
 * ref() dépend, en frontmatter (chemins absolus) comme en corps (relatifs).
 */
export function rewriteRefPaths(
  raw: string,
  mapPath: (path: string) => string | null
): string {
  REF_RE.lastIndex = 0;
  return raw.replace(REF_RE, (full, p: string) => {
    const mapped = mapPath(p);
    return mapped === null || mapped === p ? full : `ref("${mapped}")`;
  });
}
