import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { isButtonFormula } from "../../../../shared/lib/FrontmatterPicker/buttonProperty";
import {
  type NumberDef,
  isNumberFormula,
  parseNumber,
  serializeNumber,
} from "../../../../shared/lib/FrontmatterPicker/numberProperty";
import { isFormula } from "../../../../shared/lib/formulas";
import { settingsKeyAtom } from "./frontMatterAtoms";
import { useExpandPanel } from "./useExpandPanel";

export type PropertyType = "text" | "number";

export interface EditorDraft {
  type: PropertyType;
  text: string;
  numberDef: NumberDef;
}

// Boolean simple (pas un type predicate) : appeler ces guards "value is string"
// sur une valeur déjà typée string ferait s'effondrer la branche négative en
// `never` pour tout le reste de la fonction appelante (le predicate affirme
// juste "is string", trivialement déjà vrai vu le paramètre).
function isNumberFormulaValue(raw: string): boolean {
  return isNumberFormula(raw);
}
function isBareFormula(raw: string): boolean {
  return isFormula(raw) && !isButtonFormula(raw);
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
    return { type: "number", text: def.expr, numberDef: def };
  }
  if (isBareFormula(raw)) {
    // Formule brute héritée (tapée à la main) : traitée comme Nombre à l'édition.
    const inner = raw.replace(/^\$\$/, "").replace(/\$\$$/, "");
    return { type: "number", text: inner, numberDef: { expr: inner } };
  }
  // numberDef.expr : simple graine si on bascule vers Nombre depuis l'onglet
  // (cf. handleTypeChange, qui reprend le texte tel quel).
  return { type: "text", text: raw, numberDef: { expr: raw } };
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
  onTextBlur: () => void
) {
  const [settingsKey, setSettingsKey] = useAtom(settingsKeyAtom);
  const expanded = settingsKey === fieldKey;
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [rawButtonDraft, setRawButtonDraft] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) {
      setDraft(null);
      setRawButtonDraft(null);
    }
  }, [expanded]);

  const isCurrentlyButton = isButtonFormula(strValue);
  const effectiveDraft = draft ?? makeInitialDraft(strValue);

  function commitTypedDraft() {
    // Une expression vide n'a rien à calculer : committer $$NUMBER()$$
    // produirait une formule invalide affichée telle quelle. Retombe sur du
    // texte vide.
    const newValue =
      effectiveDraft.type === "text"
        ? effectiveDraft.text
        : effectiveDraft.numberDef.expr.trim() === ""
          ? ""
          : serializeNumber(effectiveDraft.numberDef);
    if (newValue !== strValue) onTextChange(newValue);
    onTextBlur();
  }

  function commitButtonDraft() {
    const newValue = rawButtonDraft ?? strValue;
    if (newValue !== strValue) onTextChange(newValue);
    onTextBlur();
  }

  const { mounted, visible, handleFieldDone, containerProps, commitAndClose } =
    useExpandPanel(
      expanded,
      () => setSettingsKey(null),
      isCurrentlyButton ? commitButtonDraft : commitTypedDraft
    );

  // Toujours une expression vierge : le texte déjà tapé n'est pas repris
  // (il n'y a aucune raison qu'il forme une expression valide une fois
  // entouré de $$, ex. du texte libre).
  function openFormulaEditor() {
    setDraft({ type: "number", text: "", numberDef: { expr: "" } });
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
  function handleTypeChange(next: PropertyType) {
    if (next === effectiveDraft.type) return;
    if (next === "number") {
      setDraft({
        ...effectiveDraft,
        type: next,
        numberDef: { ...effectiveDraft.numberDef, expr: effectiveDraft.text },
      });
    } else {
      setDraft({
        ...effectiveDraft,
        type: next,
        text: effectiveDraft.numberDef.expr,
      });
    }
  }

  return {
    expanded,
    // Reste vrai pendant l'animation de fermeture — cf. useExpandPanel.
    visible,
    isCurrentlyButton,
    draft: effectiveDraft,
    setDraft,
    handleTypeChange,
    rawButtonDraft,
    setRawButtonDraft,
    mounted,
    handleFieldDone,
    containerProps,
    openFormulaEditor,
    open,
    toggleOpen,
  };
}
