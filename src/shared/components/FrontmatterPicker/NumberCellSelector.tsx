import { platform } from "@tauri-apps/plugin-os";
import { useRef, useState } from "react";
import { NumberExprField } from "../../../desktop/components/Frontmatter/NumberExprField";
import { NumberFormatFields } from "../../../desktop/components/Frontmatter/NumberFormatFields";
import { toPropertyOptions } from "../../../desktop/components/Frontmatter/lib/frontmatterUtils";
import type { NoteFile } from "../../hooks/useFileTree";
import { computeFormula, isFormula, isFormulaError } from "../../lib/formulas";
import {
  type NumberDef,
  applyFormatConstraint,
  isFormatOnlyNumber,
  isNumberFormula,
  parseNumber,
  serializeNumber,
} from "../../lib/FrontmatterPicker/numberProperty";
import { AnchoredDropdown } from "../AnchoredDropdown";

interface Props {
  fieldKey: string;
  value: string;
  /** Contrainte de format imposée par un template : decimals/unit imposés, expr libre. */
  numberFormatConstraint?: NumberDef;
  frontmatter: Record<string, unknown>;
  noteResolver: (path: string) => NoteFile | undefined;
  allNotes: NoteFile[];
  onCommit: (value: string) => void;
}

/**
 * Déduit le NumberDef initial d'édition depuis la valeur committée — même
 * logique que useValueEditor.makeInitialDraft (branche Nombre), simplifiée :
 * pas de mode Texte/Bouton ici, une colonne Nombre reste toujours Nombre.
 * Boolean simple (pas les type predicates `value is string` de isFormula/
 * isNumberFormula) : `raw` est déjà typé string, le predicate effondrerait
 * sinon la branche négative en `never` (même piège que useValueEditor.isBareFormula).
 */
function isNumberFormulaValue(raw: string): boolean {
  return isNumberFormula(raw);
}
function isFormulaValue(raw: string): boolean {
  return isFormula(raw);
}

function makeInitialNumberDef(raw: string): NumberDef {
  if (isNumberFormulaValue(raw)) return parseNumber(raw) ?? { expr: "0" };
  if (isFormulaValue(raw)) {
    return { expr: raw.replace(/^\$\$/, "").replace(/\$\$$/, "") };
  }
  return { expr: raw };
}

/**
 * Cellule Nombre d'un tableau (BaseView) : valeur formatée affichée en ligne,
 * édition (expression + décimales/unité) dans un popup flottant ancré —
 * state local à CETTE cellule (pas d'atome partagé keyé par nom de champ,
 * contrairement à useValueEditor/settingsKeyAtom côté frontmatter panel) :
 * une même clé de colonne existe sur plusieurs notes, un atome global
 * confondrait leurs éditions. Même pattern que EnumValueSelector, déjà
 * utilisé ici pour les colonnes Bouton.
 */
export function NumberCellSelector({
  fieldKey,
  value,
  numberFormatConstraint,
  frontmatter,
  noteResolver,
  allNotes,
  onCommit,
}: Props) {
  const isMobile = platform() === "ios";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<NumberDef | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const formula = isFormula(value);
  const displayValue = formula
    ? computeFormula(value, frontmatter, undefined, noteResolver)
    : value;
  const isError = isFormulaError(displayValue);

  function openPopup() {
    const initial = makeInitialNumberDef(value);
    setDraft(
      numberFormatConstraint
        ? applyFormatConstraint(initial, numberFormatConstraint)
        : initial
    );
    setOpen(true);
  }

  function commitAndClose() {
    if (draft) {
      // decimals/unit ne viennent jamais du brouillon si un template les
      // impose — cf. useValueEditor.commitDraft (NumberFormatFields est de
      // toute façon désactivé dans ce cas, mais on ne fait pas confiance au
      // seul disabled côté UI).
      const finalDef = numberFormatConstraint
        ? applyFormatConstraint(draft, numberFormatConstraint)
        : draft;
      const emptyExpr = finalDef.expr.trim() === "";
      const newValue =
        emptyExpr && !isFormatOnlyNumber(finalDef)
          ? ""
          : serializeNumber(finalDef);
      if (newValue !== value) onCommit(newValue);
    }
    setOpen(false);
    setDraft(null);
  }

  return (
    <span className="inline-flex w-full min-w-0">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => (open ? commitAndClose() : openPopup())}
        className={`w-full min-w-0 truncate text-left bg-transparent ${
          formula ? "flex items-center gap-1 text-gray-400" : "text-gray-700"
        } ${isMobile ? "text-base" : "text-xs"}`}
      >
        {formula && (
          <span className="text-gray-300 font-mono text-[10px] leading-none shrink-0">
            ƒ
          </span>
        )}
        <span className={isError ? "text-red-400" : undefined}>
          {displayValue || "—"}
        </span>
      </button>

      {open && draft && (
        <AnchoredDropdown
          anchorRef={anchorRef}
          onClose={commitAndClose}
          className="p-2"
        >
          <div
            className="flex flex-col gap-2"
            onKeyDown={(e) => {
              // Filet pour NumberFormatFields (pas de gestion clavier propre) —
              // NumberExprField gère déjà Entrée/Échap via FormulaEditField en
              // mode formule ; double appel inoffensif (cf. InlineFormulaPopup).
              if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault();
                commitAndClose();
              }
            }}
          >
            <NumberExprField
              expr={draft.expr}
              onChange={(expr) => setDraft({ ...draft, expr })}
              allNotes={allNotes}
              noteResolver={noteResolver}
              selfProperties={toPropertyOptions(
                Object.keys(frontmatter),
                fieldKey
              )}
              inputClassName={`w-full bg-transparent outline-none border-b text-gray-700 focus:border-amber-400 transition-colors font-mono ${
                isMobile
                  ? "text-base py-1 border-gray-200"
                  : "text-sm border-gray-300"
              }`}
              autoFocus
            />
            <NumberFormatFields
              numberDef={draft}
              onChange={setDraft}
              disabled={!!numberFormatConstraint}
            />
          </div>
        </AnchoredDropdown>
      )}
    </span>
  );
}
