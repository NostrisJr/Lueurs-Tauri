/**
 * wikilinkRewrite.ts
 *
 * Réécriture des href de liens markdown vers des notes dans un corps de note.
 * Utilisé par la propagation de renommage/déplacement (usePathPropagation).
 * Les href sont des chemins relatifs à la racine du vault, avec extension.
 * Les images (`![...](...)`) sont ignorées.
 */

// [texte](url "titre") — url éventuellement entre <> (chemins avec espaces).
const LINK_RE = /(!?)\[([^\]]*)\]\((<[^>\n]+>|[^)\s]+)((?:\s+"[^"]*")?)\)/g;

function unwrap(url: string): { raw: string; wrapped: boolean } {
  if (url.startsWith("<") && url.endsWith(">")) {
    return { raw: url.slice(1, -1), wrapped: true };
  }
  return { raw: url, wrapped: false };
}

function formatUrl(url: string, wasWrapped: boolean): string {
  return wasWrapped || /\s/.test(url) ? `<${url}>` : url;
}

/**
 * Applique `mapHref` à chaque href de lien markdown du corps.
 * mapHref renvoie le nouvel href, ou null si inchangé.
 */
export function rewriteNoteLinkHrefs(
  body: string,
  mapHref: (href: string) => string | null
): { body: string; changed: boolean } {
  let changed = false;
  const next = body.replace(LINK_RE, (full, bang, text, rawUrl, title) => {
    if (bang === "!") return full; // image
    const { raw, wrapped } = unwrap(rawUrl as string);
    const mapped = mapHref(raw);
    if (mapped === null || mapped === raw) return full;
    changed = true;
    return `[${text}](${formatUrl(mapped, wrapped)}${title})`;
  });
  return { body: next, changed };
}
