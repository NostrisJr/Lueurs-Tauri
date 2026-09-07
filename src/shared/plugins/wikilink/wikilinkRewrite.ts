/**
 * wikilinkRewrite.ts
 *
 * Réécriture des href de liens markdown (notes, audio, images) dans un corps
 * de note. Utilisé par la propagation de renommage/déplacement (useFileReferences).
 * Les href sont des chemins relatifs à la racine du vault, avec extension.
 * rewriteNoteLinkHrefs ignore les images ; rewriteMediaHrefs les inclut.
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

function rewriteLinkHrefs(
  body: string,
  mapHref: (href: string) => string | null,
  includeImages: boolean
): { body: string; changed: boolean } {
  let changed = false;
  const next = body.replace(LINK_RE, (full, bang, text, rawUrl, title) => {
    if (bang === "!" && !includeImages) return full; // image, hors périmètre
    const { raw, wrapped } = unwrap(rawUrl as string);
    const mapped = mapHref(raw);
    if (mapped === null || mapped === raw) return full;
    changed = true;
    return `${bang}[${text}](${formatUrl(mapped, wrapped)}${title})`;
  });
  return { body: next, changed };
}

/**
 * Applique `mapHref` à chaque href de lien markdown du corps (notes/audio,
 * syntaxe `[texte](url)`). mapHref renvoie le nouvel href, ou null si inchangé.
 * Les images sont ignorées — cf. rewriteMediaHrefs pour les inclure.
 */
export function rewriteNoteLinkHrefs(
  body: string,
  mapHref: (href: string) => string | null
): { body: string; changed: boolean } {
  return rewriteLinkHrefs(body, mapHref, false);
}

/**
 * Comme rewriteNoteLinkHrefs, mais inclut aussi les images (`![alt](url)`).
 * À utiliser pour la propagation d'un renommage/déplacement de média — le
 * bloc audio partage la syntaxe `[titre](url)` avec les wikilinks (cf.
 * audio-block/schema.ts), seule l'image a besoin de cette variante en plus.
 */
export function rewriteMediaHrefs(
  body: string,
  mapHref: (href: string) => string | null
): { body: string; changed: boolean } {
  return rewriteLinkHrefs(body, mapHref, true);
}

/**
 * Retire les liens/images/blocs audio dont le href vérifie `matches`, en
 * conservant le texte (ou l'alt pour une image) sous forme de surlignage
 * rouge (`=={red}texte==`, cf. plugins/highlight) — signale visuellement une
 * référence rompue plutôt que de laisser un lien mort silencieux. Un texte
 * vide (image sans alt) retire le nœud entièrement.
 */
export function stripBrokenMediaLinks(
  body: string,
  matches: (href: string) => boolean
): { body: string; changed: boolean } {
  let changed = false;
  const next = body.replace(LINK_RE, (full, _bang, text, rawUrl) => {
    const { raw } = unwrap(rawUrl as string);
    if (!matches(raw)) return full;
    changed = true;
    return text ? `=={red}${text}==` : "";
  });
  return { body: next, changed };
}
