// ── Propriétés calculées ────────────────────────────────────────────────────
//
// Syntaxe : $$expression$$
// Variables : self.prop (référence une propriété de la note courante)
//             ref("chemin/note.md").prop (référence une propriété d'une autre note)
// Fonctions disponibles :
//   round(n, decimals?)         — arrondi
//   iif(cond, alors, sinon)     — conditionnel
//   agg(col, op)                — agrégation sur les enfants (bases uniquement)
// Opérateurs : + - * / () > < >= <= === !==

import type { NoteFile } from "../components/FileTree/hooks/useFileTree";
import { computeAggregation, type AggregationOp } from "./aggregations";

const FORMULA_RE = /^\$\$(.+)\$\$$/s;

// Matche les noms de propriété Unicode (accents FR inclus)
const SELF_REF_RE = /self\.([\p{L}\p{N}_]+)/gu;

export function isFormula(value: unknown): value is string {
    return typeof value === "string" && FORMULA_RE.test(value);
}

/** Remplace les chemins absolus dans ref() par les noms de notes pour l'affichage. */
export function humanizeFormula(
    raw: string,
    noteResolver: (path: string) => NoteFile | undefined,
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
    notesByName: Map<string, string>,
): string {
    return humanized.replace(/ref\("([^"]+)"\)/g, (match, nameOrPath: string) => {
        // Déjà un chemin absolu → inchangé
        if (nameOrPath.startsWith("/")) return match;
        const id = notesByName.get(nameOrPath);
        return id ? `ref("${id}")` : match;
    });
}

/**
 * Évalue une formule $$...$$ dans le contexte des propriétés d'une note.
 * Le résultat n'est jamais persisté — recalculé à l'affichage.
 *
 * @param children       Notes enfant de la base — nécessaire pour agg()
 * @param noteResolver   Résolution d'une note par chemin absolu — nécessaire pour ref()
 */
export function computeFormula(
    raw: string,
    vars: Record<string, unknown>,
    children?: NoteFile[],
    noteResolver?: (path: string) => NoteFile | undefined,
): string {
    const match = FORMULA_RE.exec(raw);
    if (!match) return raw;

    const expr = match[1].trim();

    // Substitution self.prop → valeur numérique ou chaîne
    // Réinitialise lastIndex (regex avec flag /g est stateful)
    SELF_REF_RE.lastIndex = 0;
    const substituted = expr
        .replace(SELF_REF_RE, (_, key: string) => {
            let val = vars[key];
            if (isFormula(val)) val = computeFormula(val as string, vars, children, noteResolver);
            if (val === undefined || val === null || val === "") return "0";
            const num = Number(val);
            return Number.isNaN(num) ? JSON.stringify(String(val)) : String(num);
        })
        .replace(/agg\(([\p{L}\p{N}_]+),\s*([\p{L}\p{N}_]+)\)/gu, 'agg("$1", "$2")');

    try {
        // Sandbox minimal — app desktop, données de l'utilisateur lui-même
        const fn = new Function(
            "round",
            "iif",
            "agg",
            "ref",
            `"use strict"; return (${substituted});`,
        );
        const result = fn(
            // round(n, decimals?) — arrondi à d décimales
            (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d,
            // iif(cond, alors, sinon) — alternative à l'opérateur ternaire
            (cond: boolean, a: unknown, b: unknown) => (cond ? a : b),
            // agg(col, op) — agrégation sur les enfants de la base courante
            (col: string, op: string) => {
                if (!children) return "—";
                return computeAggregation(children, col, op as AggregationOp, (frontmatter, key) => {
                    const val = frontmatter[key];
                    if (isFormula(val)) return computeFormula(val as string, frontmatter as Record<string, unknown>, undefined, noteResolver);
                    return String(val ?? "");
                });
            },
            // ref("chemin") — accès aux propriétés d'une autre note
            (path: string) => {
                const note = noteResolver?.(path);
                if (!note) return {};
                const fm = note.frontmatter as Record<string, unknown>;
                // Récupérer les enfants de la note référencée (nécessaire si c'est une base avec agg())
                const rawChildren = fm["__Children__"];
                const childPaths: string[] = Array.isArray(rawChildren)
                    ? rawChildren as string[]
                    : typeof rawChildren === "string" && rawChildren ? [rawChildren] : [];
                const refChildren = childPaths
                    .map((p) => noteResolver!(p))
                    .filter((n): n is NoteFile => n !== undefined);
                // Objet pré-calculé (pas de Proxy — compatibilité WKWebView)
                return Object.fromEntries(
                    Object.entries(fm).map(([k, v]) => {
                        if (isFormula(v)) {
                            return [k, computeFormula(
                                v as string,
                                fm,
                                refChildren.length > 0 ? refChildren : undefined,
                                noteResolver,
                            )];
                        }
                        const num = Number(v ?? "");
                        return [k, Number.isNaN(num) ? String(v ?? "") : num];
                    })
                );
            },
        );
        if (result === null || result === undefined) return "";
        // Arrondir les résultats numériques pour éviter les flottants à 15 décimales
        const round_result = typeof result === "number" ? Math.round(result * 1e6) / 1e6 : result;
        return String(round_result);
    } catch {
        return "#ERREUR";
    }
}
