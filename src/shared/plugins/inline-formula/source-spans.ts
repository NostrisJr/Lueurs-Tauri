/**
 * source-spans.ts — retrouve les `$$…$$` dans la SOURCE, pas dans l'arbre mdast.
 *
 * Le contenu d'une formule n'a aucun sens markdown, mais remark l'ignore et
 * parse son intérieur comme du texte ordinaire : un `*`, `_`, `[` ou `~` dans
 * un chemin `ref("…")` produit des nœuds `emphasis`/`delete`/`link` au milieu
 * de la formule, qui n'est alors plus contenue dans un seul nœud `text` — le
 * scan par nœud ne la voit plus et la formule s'affiche en texte brut.
 *
 * Les caractères fautifs ont disparu de l'arbre (remark les a consommés comme
 * délimiteurs), mais les OFFSETS survivent (`position.start/end.offset`, et
 * Milkdown passe bien la source au transformer : `remark.runSync(tree, md)`).
 * On repère donc les formules dans la source, puis on remplace la tranche de
 * nœuds correspondante.
 *
 * Principe de prudence : au moindre doute la fonction renvoie `null` et
 * l'appelant retombe sur le scan par nœud texte (comportement historique).
 */

// biome-ignore lint/suspicious/noExplicitAny: mdast hors typages stricts
type AnyNode = any;

// `$$` … `$$` non-greedy, sur une seule ligne, au moins un caractère.
const FORMULA_RE = /\$\$([^\n]+?)\$\$/g;

type Span = [start: number, end: number];

function nodeSpan(node: AnyNode): Span | null {
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  return typeof start === "number" && typeof end === "number"
    ? [start, end]
    : null;
}

export interface Rebuilt {
  children: AnyNode[];
  count: number;
}

/**
 * Reconstruit la liste d'enfants d'un nœud inline en y réinsérant les formules
 * telles qu'elles apparaissent dans la source. `null` = reconstruction non sûre
 * ou aucune formule trouvée.
 */
export function rebuildWithFormulas(
  children: AnyNode[],
  source: string
): Rebuilt | null {
  if (children.length === 0) return null;

  const spans: Span[] = [];
  for (const child of children) {
    const span = nodeSpan(child);
    if (!span) return null;
    spans.push(span);
  }

  const start = spans[0][0];
  const end = spans[spans.length - 1][1];
  if (end > source.length || start >= end) return null;

  const matches: Span[] = [];
  FORMULA_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: pattern standard des regex globales
  while ((match = FORMULA_RE.exec(source.slice(start, end))) !== null) {
    matches.push([start + match.index, start + match.index + match[0].length]);
  }
  if (matches.length === 0) return null;

  // Une formule entièrement contenue dans un seul nœud NON-texte relève de ce
  // nœud, pas de ce niveau (ex: `*du $$1+1$$ en italique*`) : la récursion de
  // l'appelant s'en chargera.
  const own = matches.filter(([s, e]) => {
    const host = spans.findIndex(([cs, ce]) => cs <= s && e <= ce);
    return host === -1 || children[host].type === "text";
  });
  if (own.length === 0) return null;

  const out: AnyNode[] = [];

  /** Réémet les nœuds couvrant [from, to) — hors formules. */
  function emitRange(from: number, to: number): boolean {
    if (to <= from) return true;
    for (let i = 0; i < children.length; i++) {
      const [cs, ce] = spans[i];
      if (ce <= from || cs >= to) continue;
      if (cs >= from && ce <= to) {
        out.push(children[i]);
        continue;
      }
      // Chevauchement partiel : seul un nœud texte se découpe sans risque, et
      // seulement si sa source est identique à sa valeur (ni échappement `\*`
      // ni entité `&amp;`, qui décaleraient les offsets).
      const child = children[i];
      if (child.type !== "text" || typeof child.value !== "string")
        return false;
      if (ce - cs !== child.value.length) return false;
      const value = child.value.slice(
        Math.max(from, cs) - cs,
        Math.min(to, ce) - cs
      );
      if (value) out.push({ type: "text", value });
    }
    return true;
  }

  let cursor = start;
  for (const [s, e] of own) {
    // Les nœuds entièrement dans [s, e) sont simplement absorbés par la formule.
    if (!emitRange(cursor, s)) return null;
    out.push({ type: "inline_formula", value: source.slice(s, e) });
    cursor = e;
  }
  if (!emitRange(cursor, end)) return null;

  return { children: out, count: own.length };
}
