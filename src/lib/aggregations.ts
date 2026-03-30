// ── Agrégations de colonnes (vue tableau des bases) ─────────────────────────

import type { NoteFile } from "../components/FileTree/hooks/useFileTree";

export type AggregationOp = "none" | "count" | "sum" | "avg" | "min" | "max";

export type TableAggregations = Record<string, AggregationOp>;

/**
 * Résout la valeur affichable d'une propriété pour une note.
 * Permet à l'appelant d'évaluer les formules $$...$$ avant l'agrégation,
 * sans créer de dépendance circulaire entre aggregations ↔ formulas.
 */
export type ValueResolver = (
    frontmatter: Record<string, unknown>,
    key: string,
) => string;

export const AGG_OPS: AggregationOp[] = ["none", "count", "sum", "avg", "min", "max"];

export const AGG_LABELS: Record<AggregationOp, string> = {
    none: "—",
    count: "Comptage",
    sum: "Somme",
    avg: "Moyenne",
    min: "Min",
    max: "Max",
};

export function parseTableAggregations(raw: string | undefined): TableAggregations {
    if (!raw || typeof raw !== "string") return {};
    try {
        return JSON.parse(raw) as TableAggregations;
    } catch {
        return {};
    }
}

export function serializeTableAggregations(aggs: TableAggregations): string {
    return JSON.stringify(aggs);
}

/**
 * @param resolveValue  Optionnel — résolveur de valeur pour évaluer les formules.
 *                      Si absent, la valeur brute du frontmatter est utilisée.
 */
export function computeAggregation(
    notes: NoteFile[],
    key: string,
    op: AggregationOp,
    resolveValue?: ValueResolver,
): string {
    if (op === "none") return "";

    const getRaw = (n: NoteFile): string => {
        if (resolveValue) return resolveValue(n.frontmatter as Record<string, unknown>, key);
        return String(n.frontmatter[key] ?? "");
    };

    if (op === "count") {
        const count = notes.filter((n) => {
            const v = n.frontmatter[key];
            return v !== undefined && v !== null && v !== "";
        }).length;
        return String(count);
    }

    const values = notes
        .map((n) => Number(getRaw(n)))
        .filter((v) => !Number.isNaN(v));

    if (values.length === 0) return "—";

    switch (op) {
        case "sum":
            return String(values.reduce((a, b) => a + b, 0));
        case "avg": {
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            // Arrondi à 3 décimales pour éviter les virgules flottantes disgracieuses
            return String(Math.round(avg * 1000) / 1000);
        }
        case "min":
            return String(Math.min(...values));
        case "max":
            return String(Math.max(...values));
        default:
            return "";
    }
}
