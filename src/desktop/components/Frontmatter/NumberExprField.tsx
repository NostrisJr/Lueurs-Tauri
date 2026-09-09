/**
 * NumberExprField — édition de l'expression d'une propriété NUMBER. Un seul
 * champ : nombre simple par défaut, bascule en formule complète (self[],
 * ref(), round(), iif()…) dès que "$$" est tapé — même mécanique d'auto-pair
 * que le champ valeur standard du frontmatter (cf. FrontmatterValue).
 */
import { useEffect, useRef, useState } from "react";
import { FormulaEditField } from "../../../shared/components/FormulaField/FormulaEditField";
import type { NoteFile } from "../../../shared/hooks/useFileTree";
import { isPlainNumberExpr } from "../../../shared/lib/FrontmatterPicker/numberProperty";
import type { PropertyOption } from "./lib/frontmatterUtils";

interface Props {
  expr: string;
  onChange: (expr: string) => void;
  allNotes: NoteFile[];
  noteResolver: (path: string) => NoteFile | undefined;
  selfProperties: PropertyOption[];
  inputClassName: string;
  autoFocus?: boolean;
  /**
   * Notifie le panneau englobant qu'une session d'édition formule se termine
   * (Entrée/Échap/blur) — le panneau décide alors, après vérification du focus
   * réel, s'il doit se refermer (cf. FrontmatterValue : un blur vers un champ
   * frère du même panneau — décimales, unité — ne doit pas le fermer).
   */
  onFieldDone?: () => void;
}

export function NumberExprField({
  expr,
  onChange,
  allNotes,
  noteResolver,
  selfProperties,
  inputClassName,
  autoFocus,
  onFieldDone,
}: Props) {
  // Une expression vide (ex: "$$" tapé sur un champ vierge) démarre en mode
  // formule, prête à taper — seul un littéral déjà présent reste en mode simple.
  const [editingFormula, setEditingFormula] = useState(
    !isPlainNumberExpr(expr)
  );
  const plainInputRef = useRef<HTMLInputElement>(null);

  // Focus explicite (plutôt que l'attribut autoFocus) : en mode Nombre, la
  // ligne décimales/unité apparaît sous ce champ avec sa propre transition de
  // hauteur, dont le reflow juste après un focus natif fait perdre l'affichage
  // du caret sous WebKit (le focus logique reste bon, seul le rendu du caret
  // disparaît jusqu'à la prochaine frappe). Différer d'une frame laisse le
  // layout se stabiliser avant de (re)focus. Même pattern que FormulaEditField.
  useEffect(() => {
    if (editingFormula || !autoFocus) return;
    const id = requestAnimationFrame(() => {
      const el = plainInputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
    return () => cancelAnimationFrame(id);
  }, [editingFormula, autoFocus]);

  if (editingFormula) {
    return (
      <FormulaEditField
        rawValue={`$$${expr}$$`}
        onChange={(raw) =>
          onChange(raw.replace(/^\$\$/, "").replace(/\$\$$/, ""))
        }
        onDone={() => {
          setEditingFormula(!isPlainNumberExpr(expr));
          onFieldDone?.();
        }}
        allNotes={allNotes}
        noteResolver={noteResolver}
        selfProperties={selfProperties}
        inputClassName={inputClassName}
        autoFocus={autoFocus}
      />
    );
  }

  return (
    <input
      ref={plainInputRef}
      type="text"
      inputMode="decimal"
      value={expr}
      onChange={(e) => {
        const v = e.target.value;
        // Auto-pair : $$ → bascule immédiate en édition de formule, comme
        // pour une propriété texte normale.
        if (v.endsWith("$$") && !v.slice(0, -2).endsWith("$$")) {
          onChange("");
          setEditingFormula(true);
          return;
        }
        onChange(v);
      }}
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      className={inputClassName}
    />
  );
}
