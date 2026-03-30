// ── Propriétés calculées ────────────────────────────────────────────────────
//
// Syntaxe : $$expression$$
// Variables : self.prop (référence une propriété de la note courante)
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

/**
 * Évalue une formule $$...$$ dans le contexte des propriétés d'une note.
 * Le résultat n'est jamais persisté — recalculé à l'affichage.
 *
 * @param children  Notes enfant de la base — nécessaire pour agg()
 */
export function computeFormula(
    raw: string,
    vars: Record<string, unknown>,
    children?: NoteFile[],
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
            if (isFormula(val)) val = computeFormula(val as string, vars, children);
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
                    if (isFormula(val)) return computeFormula(val as string, frontmatter as Record<string, unknown>, undefined);
                    return String(val ?? "");
                });
            });
        if (result === null || result === undefined) return "";
        // Arrondir les résultats numériques pour éviter les flottants à 15 décimales
        const round_result = typeof result === "number" ? Math.round(result * 1e6) / 1e6 : result;
        return String(round_result);
    } catch {
        return "#ERREUR";
    }
}
