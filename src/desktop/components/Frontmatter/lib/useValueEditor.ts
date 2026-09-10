import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import {
  type EnumDef,
  createEmptyEnumDef,
  isEnumFormula,
  parseEnum,
  serializeEnum,
} from "../../../../shared/lib/FrontmatterPicker/enumProperty";
import {
  type NumberDef,
  applyFormatConstraint,
  isFormatOnlyNumber,
  isNumberFormula,
  parseNumber,
  serializeNumber,
} from "../../../../shared/lib/FrontmatterPicker/numberProperty";
import { isFormula } from "../../../../shared/lib/formulas";
import { settingsKeyAtom } from "./frontMatterAtoms";
import { useExpandPanel } from "./useExpandPanel";

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
 * Déduit le type/brouillon initial du panneau à partir de la valeur committée.
 * `text` (utilisé si on bascule vers Texte) porte l'expression, jamais le
 * wrapper $$...$$/NUMBER(...) — sinon, une fois committée en texte, la valeur
 * serait réinterprétée comme une formule au prochain rendu (isFormula ne
 * regarde que la forme du texte). Basculer Nombre → Texte donne donc le texte
 * de la formule elle-même (ex: "1+1"), pas son résultat calculé ni du vide.
 */
function makeInitialDraft(raw: string): EditorDraft {
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
  // numberDef.expr : simple graine si on bascule vers Nombre depuis l'onglet
  // (cf. handleTypeChange, qui reprend le texte tel quel).
  return {
    type: "text",
    text: raw,
    numberDef: { expr: raw },
    enumDef: createEmptyEnumDef(),
  };
}

/**
 * Impose une contrainte de format template (decimals/unit) au brouillon
 * initial : toujours Nombre (le texte n'a pas de sens si le parent impose un
 * format), decimals/unit remplacés par ceux du template — seul l'expr reste
 * celui déjà présent. Filet de sécurité pour l'état transitoire où la valeur
 * stockée n'est pas encore réconciliée (cf. computeTemplateProps) : sans ça,
 * une valeur encore "texte libre" laisserait le panneau s'ouvrir en mode
 * Texte, libre de tout choisir.
 */
function withFormatConstraint(
  base: EditorDraft,
  constraint: NumberDef | undefined
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
 * Impose une contrainte ENUM de template (options/couleurs) au brouillon :
 * toujours Bouton, options remplacées par celles du template — même logique
 * que withFormatConstraint pour Nombre. En pratique le panneau de réglages
 * n'est jamais accessible pour une propriété contrainte par un ENUM (la
 * valeur se choisit directement sur la ligne, cf. EnumValueSelector dans
 * FrontmatterValue) ; ce filet de sécurité évite malgré tout qu'un héritier
 * puisse changer de type ou réécrire les options si ce panneau s'ouvrait un
 * jour par un autre chemin.
 */
function withEnumConstraint(
  base: EditorDraft,
  constraint: EnumDef | undefined
): EditorDraft {
  if (!constraint) return base;
  return { ...base, type: "enum", enumDef: constraint };
}

/**
 * État + logique du panneau d'édition d'une propriété (type Texte/Nombre,
 * formule, décimales/unité) — partagé entre FrontmatterRow (qui assemble le
 * tab switcher au-dessus et décimales/unité en dessous de la ligne
 * icônes+champ, pour que le champ ne bouge jamais visuellement) et
 * FrontmatterValue (qui n'affiche plus que le champ lui-même).
 */
export function useValueEditor(
  fieldKey: string,
  strValue: string,
  onTextChange: (value: string) => void,
  onTextBlur: () => void,
  /**
   * Contrainte de format NUMBER imposée par un template (decimals/unit) —
   * cf. useTemplateConstraints.numberFormatConstraints. undefined = propriété
   * libre, comportement inchangé.
   */
  numberFormatConstraint?: NumberDef,
  /**
   * Contrainte ENUM imposée par un template (options/couleurs) —
   * cf. useTemplateConstraints.enumConstraints. undefined = propriété libre,
   * comportement inchangé.
   */
  enumConstraint?: EnumDef
) {
  const [settingsKey, setSettingsKey] = useAtom(settingsKeyAtom);
  const expanded = settingsKey === fieldKey;
  const [draft, setDraft] = useState<EditorDraft | null>(null);

  useEffect(() => {
    if (!expanded) setDraft(null);
  }, [expanded]);

  const effectiveDraft = withEnumConstraint(
    withFormatConstraint(
      draft ?? makeInitialDraft(strValue),
      numberFormatConstraint
    ),
    enumConstraint
  );

  function commitDraft() {
    // decimals/unit ne sont jamais pris du brouillon quand un template les
    // impose : la valeur locale du champ (désactivé côté UI) ne fait pas foi.
    const draftForCommit = numberFormatConstraint
      ? {
          ...effectiveDraft,
          numberDef: applyFormatConstraint(
            effectiveDraft.numberDef,
            numberFormatConstraint
          ),
        }
      : effectiveDraft;

    if (draftForCommit.type === "enum") {
      // Héritier contraint : la valeur se choisit directement sur la ligne
      // (EnumValueSelector, jamais ce panneau) — rien à committer ici, sous
      // peine d'écraser la valeur littérale de l'héritier par la formule
      // $$ENUM(...)$$ elle-même.
      if (enumConstraint) {
        onTextBlur();
        return;
      }
      // Options vides tapées en cours d'édition : elles n'ont rien à
      // contraindre, autant ne pas les faire survivre à la sérialisation.
      const options = draftForCommit.enumDef.options.filter(
        (o) => o.value.trim() !== ""
      );
      const newValue =
        options.length === 0
          ? ""
          : serializeEnum({ ...draftForCommit.enumDef, options });
      if (newValue !== strValue) onTextChange(newValue);
      onTextBlur();
      return;
    }

    // Une expression vide n'a rien à calculer : committer $$NUMBER()$$
    // produirait une formule invalide affichée telle quelle. Retombe sur du
    // texte vide — SAUF si decimals/unit est défini, auquel cas c'est une
    // contrainte de format seule (cf. isFormatOnlyNumber), à préserver.
    const emptyExpr = draftForCommit.numberDef.expr.trim() === "";
    const newValue =
      draftForCommit.type === "text"
        ? draftForCommit.text
        : emptyExpr && !isFormatOnlyNumber(draftForCommit.numberDef)
          ? ""
          : serializeNumber(draftForCommit.numberDef);
    if (newValue !== strValue) onTextChange(newValue);
    onTextBlur();
  }

  const { mounted, visible, handleFieldDone, containerProps, commitAndClose } =
    useExpandPanel(expanded, () => setSettingsKey(null), commitDraft);

  // Toujours une expression vierge : le texte déjà tapé n'est pas repris
  // (il n'y a aucune raison qu'il forme une expression valide une fois
  // entouré de $$, ex. du texte libre).
  function openFormulaEditor() {
    setDraft({
      type: "number",
      text: "",
      numberDef: { expr: "" },
      enumDef: createEmptyEnumDef(),
    });
    setSettingsKey(fieldKey);
  }

  function open() {
    setSettingsKey(fieldKey);
  }

  // Bascule déterministe pour la roue de réglages : un clic pendant que le
  // panneau est déjà ouvert doit le refermer immédiatement (commit inclus),
  // plutôt que de rouvrir/no-op en attendant que le blur différé d'une frame
  // ferme le panneau à sa place — les deux entraient en course, laissant
  // parfois le panneau bloqué rouvert et la roue silencieuse.
  function toggleOpen() {
    if (expanded) commitAndClose();
    else open();
  }

  // Changer de type ne doit jamais faire perdre ce qui a été tapé : le
  // contenu actif passe tel quel dans l'autre champ (juste entouré de $$ côté
  // Nombre) — à l'utilisateur de corriger si le résultat n'a pas de sens.
  // Bouton fait exception (liste de valeurs, pas une expression) : on ne
  // reprend rien en entrant, et on repart du premier libellé en sortant.
  function handleTypeChange(next: PropertyType) {
    if (next === effectiveDraft.type) return;
    // Texte/Bouton désactivés quand le template impose un format NUMBER, et
    // Texte/Nombre désactivés quand il impose un ENUM : dans les deux cas
    // ce serait perdre la contrainte de template pour un autre type.
    if (numberFormatConstraint && next !== "number") return;
    if (enumConstraint && next !== "enum") return;
    if (next === "number") {
      setDraft({
        ...effectiveDraft,
        type: next,
        numberDef: {
          ...effectiveDraft.numberDef,
          expr: effectiveDraft.type === "enum" ? "" : effectiveDraft.text,
        },
      });
    } else if (next === "enum") {
      setDraft({ ...effectiveDraft, type: next });
    } else {
      setDraft({
        ...effectiveDraft,
        type: next,
        text:
          effectiveDraft.type === "enum"
            ? effectiveDraft.enumDef.default
            : effectiveDraft.numberDef.expr,
      });
    }
  }

  return {
    expanded,
    // Reste vrai pendant l'animation de fermeture — cf. useExpandPanel.
    visible,
    draft: effectiveDraft,
    setDraft,
    handleTypeChange,
    // decimals/unit imposés par un template : Texte désactivé, champs
    // décimales/unité en lecture seule dans le panneau (cf. FrontmatterRow).
    numberFormatLocked: !!numberFormatConstraint,
    mounted,
    handleFieldDone,
    containerProps,
    openFormulaEditor,
    open,
    toggleOpen,
  };
}
