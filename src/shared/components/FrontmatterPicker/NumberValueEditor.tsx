import { platform } from "@tauri-apps/plugin-os";
import {
  type NumberDef,
  serializeNumber,
} from "../../lib/FrontmatterPicker/numberProperty";

interface Props {
  def: NumberDef;
  onChange: (raw: string) => void;
  onBlur: () => void;
}

/**
 * Édition d'une propriété NUMBER dont l'expression est un littéral simple
 * (pas une formule) : input numérique classique, avec l'unité en suffixe.
 * L'arrondi (decimals) n'est appliqué qu'au blur, pas à chaque frappe —
 * sinon impossible de taper "1." ou d'effacer une décimale en cours.
 */
export function NumberValueEditor({ def, onChange, onBlur }: Props) {
  const isMobile = platform() === "ios";

  return (
    <div className="flex items-center gap-1 flex-1">
      <input
        type="number"
        value={def.expr}
        onChange={(e) => {
          const newExpr = e.target.value;
          // Contenu vidé entièrement : supprime $$NUMBER(...)$$ plutôt que de
          // committer une formule vide invalide (qui basculerait l'affichage
          // en badge ƒ en erreur au lieu de rester un champ éditable).
          if (newExpr.trim() === "") {
            onChange("");
            return;
          }
          onChange(serializeNumber({ ...def, expr: newExpr }));
        }}
        onBlur={() => {
          const num = Number(def.expr);
          if (def.expr.trim() !== "" && !Number.isNaN(num)) {
            const rounded =
              def.decimals !== undefined ? num.toFixed(def.decimals) : def.expr;
            onChange(serializeNumber({ ...def, expr: rounded }));
          }
          onBlur();
        }}
        style={isMobile ? { fontSize: 14 } : undefined}
        className="w-full mt-0.5 bg-transparent outline-none border-b border-transparent
          text-gray-600 focus:border-gray-300 transition-colors"
      />
      {def.unit && (
        <span className="shrink-0 mt-0.5 text-gray-400 text-xs select-none">
          {def.unit}
        </span>
      )}
    </div>
  );
}
