import { useEffect, useState } from "react";
import type { NumberDef } from "../../lib/FrontmatterPicker/numberProperty";
import {
  type EditorDraft,
  type PropertyType,
  changeDraftType,
  makeEmptyFormulaDraft,
  makeInitialDraft,
  serializeDraft,
  withFormatConstraint,
} from "../../lib/FrontmatterPicker/propertyDraft";

/**
 * Réglages Texte/Nombre/Bouton d'une cellule de tableau (BaseView) — état
 * local à CETTE cellule, pas un atome partagé keyé par nom de champ (contrairement
 * à useValueEditor/settingsKeyAtom côté frontmatter panel) : une même clé de
 * colonne existe sur plusieurs notes, un atome global confondrait leurs
 * éditions. Même pattern que NumberCellSelector, déjà utilisé pour les
 * colonnes Nombre. N'a pas besoin de gérer de contrainte ENUM de template
 * (contrairement à useValueEditor) : la roue crantée qui ouvre ce panneau est
 * masquée dès qu'un enumConstraint de template existe, cf. TableCell.
 */
export function usePropertyCellSettings(
  strValue: string,
  onCommit: (value: string) => void,
  numberFormatConstraint?: NumberDef
) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EditorDraft | null>(null);

  function openPopup() {
    setDraft(
      withFormatConstraint(makeInitialDraft(strValue), numberFormatConstraint)
    );
    setOpen(true);
  }

  // Ouverture directe en Nombre/formule vierge — déclenchée par "$$" tapé
  // dans une cellule texte libre, à la place du passage direct en édition de
  // formule brute (cf. TableCell) : même mécanique que
  // useValueEditor.openFormulaEditor côté frontmatter.
  function openAsFormula() {
    setDraft(
      withFormatConstraint(makeEmptyFormulaDraft(), numberFormatConstraint)
    );
    setOpen(true);
  }

  function handleTypeChange(next: PropertyType) {
    if (!draft) return;
    if (numberFormatConstraint && next !== "number") return;
    setDraft(changeDraftType(draft, next));
  }

  // Commit en live à chaque modification du brouillon tant que le panneau est
  // ouvert — même filet de sécurité que useValueEditor côté frontmatter panel
  // (cf. commit 876a3b3) : sans ça, un démontage silencieux de la cellule
  // (tri/filtre/suppression de ligne pendant l'édition) perdait le brouillon
  // sans jamais appeler onCommit.
  useEffect(() => {
    if (!open || draft === null) return;
    const newValue = serializeDraft(draft, numberFormatConstraint);
    if (newValue !== strValue) onCommit(newValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'à une vraie modification du brouillon, pas à chaque render
  }, [draft]);

  function commitAndClose() {
    if (draft) {
      const newValue = serializeDraft(draft, numberFormatConstraint);
      if (newValue !== strValue) onCommit(newValue);
    }
    setOpen(false);
    setDraft(null);
  }

  return {
    open,
    draft,
    setDraft,
    openPopup,
    openAsFormula,
    handleTypeChange,
    commitAndClose,
  };
}

export type PropertyCellSettings = ReturnType<typeof usePropertyCellSettings>;
