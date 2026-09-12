// ── Brouillon Texte/Nombre/Bouton d'une propriété ───────────────────────────
//
// Logique pure extraite de useValueEditor (panneau de réglages du frontmatter)
// pour être réutilisée là où le même brouillon Texte/Nombre/Bouton est utile
// hors de ce panneau — ex: réglages d'une cellule de tableau (BaseView), cf.
// usePropertyCellSettings. useValueEditor reste la seule à gérer la contrainte
// ENUM de template (withEnumConstraint) : un cas qui ne se présente jamais
// pour une cellule de tableau (la roue crantée y est masquée dès qu'un
// enumConstraint de template existe, cf. TableCell).

import { isFormula } from "../formulas";
import {
  type EnumDef,
  createEmptyEnumDef,
  isEnumFormula,
  parseEnum,
  serializeEnum,
} from "./enumProperty";
import {
  type NumberDef,
  applyFormatConstraint,
  isFormatOnlyNumber,
  isNumberFormula,
  parseNumber,
  serializeNumber,
} from "./numberProperty";

export type PropertyType = "text" | "number" | "enum";

export interface EditorDraft {
  type: PropertyType;
  text: string;
  numberDef: NumberDef;
  enumDef: EnumDef;
}

// Boolean simple (pas un type predicate) : appeler ces guards "value is string"
// sur une valeur déjà typée string ferait s'effondrer la branche négative en
// `never` pour tout le reste de la fonction appelante (le predicate affirme
// juste "is string", trivialement déjà vrai vu le paramètre).
function isNumberFormulaValue(raw: string): boolean {
  return isNumberFormula(raw);
}
function isEnumFormulaValue(raw: string): boolean {
  return isEnumFormula(raw);
}
function isBareFormula(raw: string): boolean {
  return isFormula(raw) && !isEnumFormulaValue(raw);
}

/**
 * Déduit le type/brouillon initial à partir de la valeur committée. `text`
 * (utilisé si on bascule vers Texte) porte l'expression, jamais le wrapper
 * $$...$$/NUMBER(...) — sinon, une fois committée en texte, la valeur serait
 * réinterprétée comme une formule au prochain rendu (isFormula ne regarde que
 * la forme du texte).
 */
export function makeInitialDraft(raw: string): EditorDraft {
  if (isNumberFormulaValue(raw)) {
    const def = parseNumber(raw) ?? { expr: "0" };
    return {
      type: "number",
      text: def.expr,
      numberDef: def,
      enumDef: createEmptyEnumDef(),
    };
  }
  if (isEnumFormulaValue(raw)) {
    const def = parseEnum(raw) ?? createEmptyEnumDef();
    return {
      type: "enum",
      text: "",
      numberDef: { expr: "" },
      enumDef: def,
    };
  }
  if (isBareFormula(raw)) {
    // Formule brute héritée (tapée à la main) : traitée comme Nombre à l'édition.
    const inner = raw.replace(/^\$\$/, "").replace(/\$\$$/, "");
    return {
      type: "number",
      text: inner,
      numberDef: { expr: inner },
      enumDef: createEmptyEnumDef(),
    };
  }
  return {
    type: "text",
    text: raw,
    numberDef: { expr: raw },
    enumDef: createEmptyEnumDef(),
  };
}

/**
 * Brouillon "formule vierge" (Nombre, expression vide) — point de départ
 * quand "$$" est tapé dans un champ Texte (cf. FrontmatterValue,
 * usePropertyCellSettings.openAsFormula) : le texte déjà tapé n'a aucune
 * raison de former une expression valide une fois entouré de $$, donc jamais
 * repris.
 */
export function makeEmptyFormulaDraft(): EditorDraft {
  return {
    type: "number",
    text: "",
    numberDef: { expr: "" },
    enumDef: createEmptyEnumDef(),
  };
}

/**
 * Impose une contrainte de format template (decimals/unit) au brouillon :
 * toujours Nombre, decimals/unit remplacés par ceux du template — seul l'expr
 * reste celui déjà présent.
 */
export function withFormatConstraint(
  base: EditorDraft,
  constraint?: NumberDef
): EditorDraft {
  if (!constraint) return base;
  const expr = base.type === "number" ? base.numberDef.expr : base.text;
  return {
    ...base,
    type: "number",
    text: expr,
    numberDef: applyFormatConstraint({ expr }, constraint),
  };
}

/**
 * Change de type en conservant ce qui a été tapé : le contenu actif passe tel
 * quel dans l'autre champ (juste entouré de $$ côté Nombre) — à l'utilisateur
 * de corriger si le résultat n'a pas de sens. Bouton amorce toujours au moins
 * une première option (avec ce même contenu si non vide, sinon une option
 * vide) plutôt que de repartir d'une liste vide — sinon le panneau s'ouvre
 * sans rien à éditer ni à focus. Seulement si aucune option n'existe déjà :
 * un va-et-vient Bouton→Nombre→Bouton ne doit pas écraser des options déjà
 * saisies par un contenu Nombre entre-temps vidé (cf. Bouton→Nombre juste
 * au-dessus, qui repart bien d'une expression vide sans toucher enumDef).
 */
export function changeDraftType(
  draft: EditorDraft,
  next: PropertyType
): EditorDraft {
  if (next === draft.type) return draft;
  if (next === "number") {
    return {
      ...draft,
      type: next,
      numberDef: {
        ...draft.numberDef,
        expr: draft.type === "enum" ? "" : draft.text,
      },
    };
  }
  if (next === "enum") {
    if (draft.enumDef.options.length > 0) return { ...draft, type: next };
    const seed = (
      draft.type === "number" ? draft.numberDef.expr : draft.text
    ).trim();
    return {
      ...draft,
      type: next,
      enumDef: { options: [{ value: seed }], default: seed },
    };
  }
  return {
    ...draft,
    type: next,
    text: draft.type === "enum" ? draft.enumDef.default : draft.numberDef.expr,
  };
}

/**
 * Sérialise le brouillon vers la valeur à committer. decimals/unit ne sont
 * jamais pris du brouillon quand un template les impose : la valeur locale du
 * champ (désactivé côté UI) ne fait pas foi.
 */
export function serializeDraft(
  draft: EditorDraft,
  numberFormatConstraint?: NumberDef
): string {
  const draftForCommit = numberFormatConstraint
    ? {
        ...draft,
        numberDef: applyFormatConstraint(
          draft.numberDef,
          numberFormatConstraint
        ),
      }
    : draft;

  if (draftForCommit.type === "enum") {
    // Options vides tapées en cours d'édition : elles n'ont rien à
    // contraindre, autant ne pas les faire survivre à la sérialisation.
    const options = draftForCommit.enumDef.options.filter(
      (o) => o.value.trim() !== ""
    );
    return options.length === 0
      ? ""
      : serializeEnum({ ...draftForCommit.enumDef, options });
  }

  // Une expression vide n'a rien à calculer : committer $$NUMBER()$$
  // produirait une formule invalide affichée telle quelle. Retombe sur du
  // texte vide — SAUF si decimals/unit est défini, auquel cas c'est une
  // contrainte de format seule (cf. isFormatOnlyNumber), à préserver.
  const emptyExpr = draftForCommit.numberDef.expr.trim() === "";
  return draftForCommit.type === "text"
    ? draftForCommit.text
    : emptyExpr && !isFormatOnlyNumber(draftForCommit.numberDef)
      ? ""
      : serializeNumber(draftForCommit.numberDef);
}
