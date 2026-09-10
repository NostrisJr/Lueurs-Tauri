import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import type { EnumDef } from "../../../../shared/lib/FrontmatterPicker/enumProperty";
import type { NumberDef } from "../../../../shared/lib/FrontmatterPicker/numberProperty";
import {
  type EditorDraft,
  type PropertyType,
  changeDraftType,
  makeEmptyFormulaDraft,
  makeInitialDraft,
  serializeDraft,
  withFormatConstraint,
} from "../../../../shared/lib/FrontmatterPicker/propertyDraft";
import { settingsKeyAtom } from "./frontMatterAtoms";
import { useExpandPanel } from "./useExpandPanel";

export type { PropertyType, EditorDraft };

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

  /**
   * Sérialise le brouillon courant vers la valeur à committer — null si rien
   * à committer (héritier contraint par un ENUM : la valeur se choisit
   * directement sur la ligne via EnumValueSelector, jamais ce panneau, sous
   * peine d'écraser la valeur littérale de l'héritier par la formule
   * $$ENUM(...)$$ elle-même). Pure : ni onTextChange ni onTextBlur ici, pour
   * être réutilisable aussi bien par le commit live (useEffect ci-dessous)
   * que par la fermeture explicite (commitDraft).
   */
  function computeCommittedValue(): string | null {
    if (effectiveDraft.type === "enum" && enumConstraint) return null;
    return serializeDraft(effectiveDraft, numberFormatConstraint);
  }

  function commitDraft() {
    const newValue = computeCommittedValue();
    if (newValue !== null && newValue !== strValue) onTextChange(newValue);
    onTextBlur();
  }

  // Commit en live (debounce habituel de l'app — cf. FrontmatterEditor.commit
  // → onChange, même pipeline que n'importe quel autre champ) à chaque
  // modification du brouillon, pas seulement à la fermeture du panneau :
  // sinon naviguer vers une autre note sans passer par Entrée/Échap/roue
  // perdait silencieusement l'édition en cours (jamais commit ne serait
  // appelé). Volontairement SANS onTextBlur() : pas de flush immédiat, pas de
  // fermeture du panneau — la fermeture reste déclenchée UNIQUEMENT par
  // Entrée/Échap/roue (cf. useExpandPanel), pour ne pas réintroduire la
  // course de focus avec les sélecteurs ref()/self[ imbriqués que ce choix
  // avait corrigée.
  useEffect(() => {
    if (!expanded || draft === null) return;
    const newValue = computeCommittedValue();
    if (newValue !== null && newValue !== strValue) onTextChange(newValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'à une vraie modification du brouillon, pas à chaque render (cf. computeCommittedValue, qui referme déjà sur les props courantes)
  }, [draft]);

  const { mounted, visible, handleFieldDone, containerProps, commitAndClose } =
    useExpandPanel(expanded, () => setSettingsKey(null), commitDraft);

  // Toujours une expression vierge : le texte déjà tapé n'est pas repris
  // (il n'y a aucune raison qu'il forme une expression valide une fois
  // entouré de $$, ex. du texte libre).
  function openFormulaEditor() {
    setDraft(makeEmptyFormulaDraft());
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

  // Texte/Bouton désactivés quand le template impose un format NUMBER, et
  // Texte/Nombre désactivés quand il impose un ENUM : dans les deux cas ce
  // serait perdre la contrainte de template pour un autre type. La
  // transformation du brouillon elle-même (que reprendre / oublier en
  // changeant de type) est pure, cf. propertyDraft.changeDraftType.
  function handleTypeChange(next: PropertyType) {
    if (numberFormatConstraint && next !== "number") return;
    if (enumConstraint && next !== "enum") return;
    setDraft(changeDraftType(effectiveDraft, next));
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
