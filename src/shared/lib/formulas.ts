// ── Propriétés calculées ────────────────────────────────────────────────────
//
// Syntaxe : $$expression$$
// Variables : self["prop"]                    (propriété de la note courante)
//             ref("chemin/note.md")["prop"]   (propriété d'une autre note)
// Fonctions disponibles :
//   round(n, decimals?)         — arrondi
//   iif(cond, alors, sinon)     — conditionnel
//   agg(col, op)                — agrégation sur les enfants (bases uniquement)
//   BUTTON([a;b;c],def)         — contrainte de valeurs (déclaratif, jamais calculé — voir buttonProperty.ts)
// Opérateurs : + - * / () > < >= <= === !==
//
// Un seul système d'accès aux propriétés : crochets + guillemets, jamais de
// point. La guillemet fermante délimite le nom sans ambiguïté (espaces
// compris), sans avoir besoin de connaître les clés réelles du frontmatter
// pour savoir où il s'arrête. Le sélecteur de propriétés (déclenché par
// `self[` / `ref("…")[` dans FormulaEditField) insère cette forme.

import type { NoteFile } from "../hooks/useFileTree";
import {
  isButtonFormula,
  parseButton,
} from "./FrontmatterPicker/buttonProperty";
import { type AggregationOp, computeAggregation } from "./aggregations";

const FORMULA_RE = /^\$\$(.+)\$\$$/s;

/** Formule `$$…$$` isolée dans un texte libre (corps de note). */
const BODY_FORMULA_RE = /\$\$([^\n]+?)\$\$/g;

const ERROR = "#ERREUR";
/** Référence circulaire : la formule se réévalue elle-même, directement ou non. */
const CYCLE = "#CYCLE";

/** Profondeur maximale d'évaluation — filet de sécurité au-delà du détecteur de cycle. */
const MAX_DEPTH = 64;

export function isFormula(value: unknown): value is string {
  return typeof value === "string" && FORMULA_RE.test(value);
}

/** Marqueur d'échec renvoyé par computeFormula (à styler en erreur). */
export function isFormulaError(value: string): boolean {
  return value === ERROR || value === CYCLE;
}

// ── Accès aux propriétés (self[…] / ref(…)[…]) ─────────────────────────────

/**
 * `self["prop"]`. La borne gauche (classe de caractères, pas de lookbehind —
 * compatibilité WKWebView) évite de matcher un identifiant terminant par
 * « self ». Groupes : 1 = borne gauche, 2 = guillemet, 3 = nom (brut, avec
 * échappements `\"`/`\\` non résolus).
 */
const SELF_ACCESS_RE =
  /(^|[^\p{L}\p{N}_.])self\[\s*(["'])((?:\\.|(?!\2)[^\\\n])*)\2\s*\]/gu;

/**
 * `ref("chemin")["prop"]`. Groupes : 1 = chemin, 2 = guillemet, 3 = nom (brut).
 */
const REF_ACCESS_RE =
  /ref\("([^"]*)"\)\[\s*(["'])((?:\\.|(?!\2)[^\\\n])*)\2\s*\]/g;

function unescapeKey(raw: string): string {
  return raw.replace(/\\(.)/g, "$1");
}

// ── Humanisation des chemins ref() ─────────────────────────────────────────

/** Remplace les chemins absolus dans ref() par les noms de notes pour l'affichage. */
export function humanizeFormula(
  raw: string,
  noteResolver: (path: string) => NoteFile | undefined
): string {
  return raw.replace(/ref\("([^"]+)"\)/g, (_, path: string) => {
    const note = noteResolver(path);
    return note ? `ref("${note.name}")` : `ref("${path}")`;
  });
}

/**
 * Inverse de humanizeFormula : remplace ref("NomNote") par ref("/chemin/absolu").
 * Utilisé pour convertir ce que l'utilisateur voit/tape vers le format stocké.
 */
export function dehumanizeFormula(
  humanized: string,
  notesByName: Map<string, string>
): string {
  return humanized.replace(/ref\("([^"]+)"\)/g, (match, nameOrPath: string) => {
    // Déjà un chemin absolu → inchangé
    if (nameOrPath.startsWith("/")) return match;
    const id = notesByName.get(nameOrPath);
    return id ? `ref("${id}")` : match;
  });
}

// ── Contexte d'évaluation (anti-cycle) ─────────────────────────────────────

/**
 * Une formule peut se réévaluer elle-même : `ref()` vers sa propre note, ou
 * `self["x"]` où `x` référence la note. Sans garde, le facteur de branchement est
 * le nombre de formules du frontmatter → explosion exponentielle qui gèle l'app.
 *
 * `stack` détecte la ré-entrée, `cache` évite de recalculer deux fois la même
 * formule dans une même évaluation (références en diamant).
 * Clé de tous les deux : (objet `vars`, formule brute).
 */
interface EvalCtx {
  stack: Map<object, Set<string>>;
  cache: Map<object, Map<string, string>>;
  depth: number;
}

function newEvalCtx(): EvalCtx {
  return { stack: new Map(), cache: new Map(), depth: 0 };
}

/**
 * Évalue une formule $$...$$ dans le contexte des propriétés d'une note.
 * Le résultat n'est jamais persisté — recalculé à l'affichage.
 *
 * @param children       Notes enfant de la base — nécessaire pour agg()
 * @param noteResolver   Résolution d'une note par chemin absolu — nécessaire pour ref()
 * @param ctx            Interne : partagé par la récursion, ne pas passer depuis l'extérieur
 */
export function computeFormula(
  raw: string,
  vars: Record<string, unknown>,
  children?: NoteFile[],
  noteResolver?: (path: string) => NoteFile | undefined,
  ctx: EvalCtx = newEvalCtx()
): string {
  const match = FORMULA_RE.exec(raw);
  if (!match) return raw;

  // BUTTON est déclaratif (contrainte de template), jamais évalué : aperçu lisible
  // pour la note template elle-même (les héritiers ne stockent qu'un littéral).
  if (isButtonFormula(raw)) {
    const def = parseButton(raw);
    return def ? def.options.map((o) => o.value).join(" · ") : raw;
  }

  const cached = ctx.cache.get(vars)?.get(raw);
  if (cached !== undefined) return cached;

  let inFlight = ctx.stack.get(vars);
  if (inFlight?.has(raw)) return CYCLE;
  if (ctx.depth >= MAX_DEPTH) return CYCLE;
  if (!inFlight) {
    inFlight = new Set();
    ctx.stack.set(vars, inFlight);
  }
  inFlight.add(raw);

  // Même stack/cache, un cran plus profond.
  const inner: EvalCtx = { ...ctx, depth: ctx.depth + 1 };

  try {
    const result = evaluate(
      match[1].trim(),
      vars,
      children,
      noteResolver,
      inner
    );
    let byRaw = ctx.cache.get(vars);
    if (!byRaw) {
      byRaw = new Map();
      ctx.cache.set(vars, byRaw);
    }
    byRaw.set(raw, result);
    return result;
  } finally {
    inFlight.delete(raw);
  }
}

function evaluate(
  expr: string,
  vars: Record<string, unknown>,
  children: NoteFile[] | undefined,
  noteResolver: ((path: string) => NoteFile | undefined) | undefined,
  ctx: EvalCtx
): string {
  // Une propriété en cycle contamine toute formule qui la lit : on remonte le
  // marqueur au lieu de laisser « 3#CYCLE » sortir d'une concaténation.
  const propagated: { value: string | null } = { value: null };

  // self["prop"] est substitué textuellement (self n'existe pas comme objet
  // dans le sandbox ci-dessous) ; ref("chemin")["prop"] n'a besoin d'AUCUNE
  // réécriture — crochets + guillemets sont déjà du JS valide, résolu à
  // l'exécution par la fonction `ref` passée au sandbox.
  const substituted = expr
    .replace(SELF_ACCESS_RE, (_full, boundary: string, _q, rawKey: string) => {
      const key = unescapeKey(rawKey);
      let val = vars[key];
      if (isFormula(val))
        val = computeFormula(val as string, vars, children, noteResolver, ctx);
      if (typeof val === "string" && isFormulaError(val)) {
        propagated.value = val;
        return `${boundary}0`;
      }
      if (val === undefined || val === null || val === "")
        return `${boundary}0`;
      const num = Number(val);
      return (
        boundary +
        (Number.isNaN(num) ? JSON.stringify(String(val)) : String(num))
      );
    })
    // agg(col, op) : les noms de colonne peuvent contenir des espaces.
    .replace(
      /agg\(\s*([^,()"]+?)\s*,\s*([\p{L}\p{N}_]+)\s*\)/gu,
      'agg("$1", "$2")'
    );

  if (propagated.value) return propagated.value;

  try {
    // Sandbox minimal — app desktop, données de l'utilisateur lui-même
    const fn = new Function(
      "round",
      "iif",
      "agg",
      "ref",
      `"use strict"; return (${substituted});`
    );
    const result = fn(
      // round(n, decimals?) — arrondi à d décimales
      (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d,
      // iif(cond, alors, sinon) — alternative à l'opérateur ternaire
      (cond: boolean, a: unknown, b: unknown) => (cond ? a : b),
      // agg(col, op) — agrégation sur les enfants de la base courante
      (col: string, op: string) => {
        if (!children) return "—";
        return computeAggregation(
          children,
          col,
          op as AggregationOp,
          (frontmatter, key) => {
            const val = frontmatter[key];
            if (isFormula(val))
              return computeFormula(
                val as string,
                frontmatter as Record<string, unknown>,
                undefined,
                noteResolver,
                ctx
              );
            return String(val ?? "");
          }
        );
      },
      // ref("chemin") — accès aux propriétés d'une autre note
      (path: string) => {
        const note = noteResolver?.(path);
        if (!note) return {};
        const fm = note.frontmatter as Record<string, unknown>;
        // Récupérer les enfants de la note référencée (nécessaire si c'est une base avec agg())
        const rawChildren = fm.__Children__;
        const childPaths: string[] = Array.isArray(rawChildren)
          ? (rawChildren as string[])
          : typeof rawChildren === "string" && rawChildren
            ? [rawChildren]
            : [];
        const refChildren = childPaths
          .map((p) => noteResolver!(p))
          .filter((n): n is NoteFile => n !== undefined);
        // Objet pré-calculé (pas de Proxy — compatibilité WKWebView)
        return Object.fromEntries(
          Object.entries(fm).map(([k, v]) => {
            if (isFormula(v)) {
              return [
                k,
                computeFormula(
                  v as string,
                  fm,
                  refChildren.length > 0 ? refChildren : undefined,
                  noteResolver,
                  ctx
                ),
              ];
            }
            const num = Number(v ?? "");
            return [k, Number.isNaN(num) ? String(v ?? "") : num];
          })
        );
      }
    );
    if (result === null || result === undefined) return "";
    if (typeof result === "string" && isFormulaError(result)) return result;
    // Arrondir les résultats numériques pour éviter les flottants à 15 décimales
    const round_result =
      typeof result === "number" ? Math.round(result * 1e6) / 1e6 : result;
    return String(round_result);
  } catch {
    return ERROR;
  }
}

// ── Renommage d'une propriété dans les formules ────────────────────────────

export interface FormulaRenameOptions {
  oldKey: string;
  newKey: string;
  /** La note qui porte cette formule a-t-elle vu SA propriété renommée ? Si non, `self[…]` n'est pas touché. */
  isOwner: boolean;
  /** `ref("chemin")` désigne-t-il une note concernée par ce renommage ? */
  isRefOwner: (path: string) => boolean;
}

/**
 * Réécrit `self["oldKey"]` et `ref("…")["oldKey"]` en `newKey` dans une
 * formule brute `$$…$$`. Les références non concernées (autre propriété,
 * `ref()` vers une note hors périmètre) sont rendues intactes.
 */
export function renamePropertyInFormula(
  raw: string,
  opts: FormulaRenameOptions
): string {
  if (opts.oldKey === opts.newKey) return raw;

  let out = raw;
  if (opts.isOwner) {
    out = out.replace(
      SELF_ACCESS_RE,
      (full, boundary: string, _q, rawKey: string) =>
        unescapeKey(rawKey) === opts.oldKey
          ? `${boundary}self[${JSON.stringify(opts.newKey)}]`
          : full
    );
  }
  out = out.replace(REF_ACCESS_RE, (full, path: string, _q, rawKey: string) => {
    if (!opts.isRefOwner(path) || unescapeKey(rawKey) !== opts.oldKey)
      return full;
    return `ref(${JSON.stringify(path)})[${JSON.stringify(opts.newKey)}]`;
  });
  return out;
}

/**
 * Applique `rewrite` à chaque formule `$$…$$` d'un texte libre (corps de note).
 */
export function rewriteBodyFormulas(
  body: string,
  rewrite: (raw: string) => string
): { body: string; changed: boolean } {
  let changed = false;
  BODY_FORMULA_RE.lastIndex = 0;
  const next = body.replace(BODY_FORMULA_RE, (full) => {
    const rewritten = rewrite(full);
    if (rewritten !== full) changed = true;
    return rewritten;
  });
  return { body: next, changed };
}
