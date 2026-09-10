/**
 * inlineFormulaDraft.ts
 *
 * État pur du switcher Nombre/Bouton du popup d'édition d'une formule inline
 * (InlineFormulaPopup) — déduction du mode depuis `raw`, mutation du
 * brouillon, sérialisation retour vers `raw`.
 *
 * Pas de mode "Formule" séparé : Nombre le couvre déjà. NumberExprField
 * bascule lui-même en formule complète (self[]/ref()/...) dès qu'on tape
 * "$$", et $$NUMBER(expr)$$ sans decimals/unit s'évalue identiquement à une
 * formule brute $$expr$$ (cf. formulas.ts, formatNumberResult no-op sans
 * format). Une formule héritée non wrappée est donc traitée comme Nombre dès
 * l'ouverture, et n'est réécrite en $$NUMBER(...)$$ qu'au premier commit —
 * sans effet visible.
 */

import {
  type EnumDef,
  createEmptyEnumDef,
  isEnumFormula,
  parseEnum,
  serializeEnum,
} from "../../lib/FrontmatterPicker/enumProperty";
import {
  type NumberDef,
  isFormatOnlyNumber,
  isNumberFormula,
  parseNumber,
  serializeNumber,
} from "../../lib/FrontmatterPicker/numberProperty";
import { formulaInner } from "./inlineFormulaState";

export type InlineFormulaMode = "number" | "enum";

export interface InlineFormulaDraft {
  mode: InlineFormulaMode;
  numberDef: NumberDef;
  enumDef: EnumDef;
}

/** Déduit le brouillon initial depuis la formule brute (`$$...$$`) du nœud. */
export function deriveInlineFormulaDraft(raw: string): InlineFormulaDraft {
  if (isEnumFormula(raw)) {
    return {
      mode: "enum",
      numberDef: { expr: "" },
      enumDef: parseEnum(raw) ?? createEmptyEnumDef(),
    };
  }
  if (isNumberFormula(raw)) {
    return {
      mode: "number",
      numberDef: parseNumber(raw) ?? { expr: "" },
      enumDef: createEmptyEnumDef(),
    };
  }
  return {
    mode: "number",
    numberDef: { expr: formulaInner(raw) },
    enumDef: createEmptyEnumDef(),
  };
}

/**
 * Change de mode. Bouton fait exception (liste de valeurs, pas une
 * expression) : on ne reprend rien en y entrant, et l'expr Nombre repart
 * vierge en sortant — même logique que useValueEditor.handleTypeChange.
 */
export function switchInlineFormulaMode(
  draft: InlineFormulaDraft,
  next: InlineFormulaMode
): InlineFormulaDraft {
  if (next === draft.mode) return draft;
  if (next === "number") {
    return { ...draft, mode: "number", numberDef: { expr: "" } };
  }
  return { ...draft, mode: "enum" };
}

/** Sérialise le brouillon vers `raw` — "$$$$" (vide, supprime le nœud) si rien à committer. */
export function serializeInlineFormulaDraft(draft: InlineFormulaDraft): string {
  if (draft.mode === "enum") {
    const options = draft.enumDef.options.filter((o) => o.value.trim() !== "");
    return options.length === 0
      ? "$$$$"
      : serializeEnum({ ...draft.enumDef, options });
  }
  const emptyExpr = draft.numberDef.expr.trim() === "";
  return emptyExpr && !isFormatOnlyNumber(draft.numberDef)
    ? "$$$$"
    : serializeNumber(draft.numberDef);
}
