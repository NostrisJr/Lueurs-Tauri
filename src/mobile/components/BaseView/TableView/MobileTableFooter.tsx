import clsx from "clsx";
import { useState } from "react";
import type { NoteFile } from "../../../../shared/hooks/useFileTree";
import type { TableColumn } from "../../../../shared/hooks/useTable";
import {
  AGG_LABELS,
  AGG_OPS,
  type AggregationOp,
  type TableAggregations,
  computeAggregation,
} from "../../../../shared/lib/aggregations";
import { computeFormula, isFormula } from "../../../../shared/lib/formulas";
import { hapticImpact } from "../../../lib/haptics";
import { BottomSheet } from "../../BottomSheet/BottomSheet";
import { CELL_WIDTH, TITLE_WIDTH } from "./constants";

interface Props {
  columns: TableColumn[];
  childNotes: NoteFile[];
  aggregations: TableAggregations;
  onAggregationChange: (key: string, op: AggregationOp) => void;
}

// Pas de sticky ici (contrairement au header) : comme sur desktop, le footer
// d'agrégations reste un simple bloc en fin de tableau, dans le même
// conteneur de scroll horizontal que les lignes — pas besoin de sa propre
// région de scroll synchronisée.
export function MobileTableFooter({
  columns,
  childNotes,
  aggregations,
  onAggregationChange,
}: Props) {
  // Colonne en cours de sélection d'agrégation (ouvre la bottom sheet) — pas
  // de hover sur tactile, donc "Calculer" reste toujours visible (contrairement
  // au desktop où c'est un texte révélé au survol, cf. TableFooter desktop).
  const [pickerKey, setPickerKey] = useState<string | null>(null);

  return (
    <>
      <div className={clsx("flex border-t", "bg-surface-2/50 border-line-2")}>
        <div
          className={clsx(
            "shrink-0 sticky left-0 z-10 border-r",
            "bg-surface-2/50 border-line-2"
          )}
          style={{ width: TITLE_WIDTH }}
        />

        {columns.map((col) => {
          const op = aggregations[col.key] ?? "none";
          const result = computeAggregation(
            childNotes,
            col.key,
            op,
            (frontmatter, key) => {
              const val = frontmatter[key];
              if (isFormula(val))
                return computeFormula(
                  val as string,
                  frontmatter as Record<string, unknown>
                );
              return String(val ?? "");
            }
          );
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => {
                hapticImpact("light");
                setPickerKey(col.key);
              }}
              className={clsx(
                "shrink-0 flex flex-col items-end justify-center px-3 py-1.5 border-r last:border-none text-right",
                "border-line-2"
              )}
              style={{ width: CELL_WIDTH }}
            >
              {op !== "none" ? (
                <>
                  <span className="text-[10px] text-ink-4 leading-tight">
                    {AGG_LABELS[op]}
                  </span>
                  <span
                    className={clsx(
                      "text-xs font-medium leading-tight truncate max-w-full",
                      "text-ink-2"
                    )}
                  >
                    {result}
                  </span>
                </>
              ) : (
                <span className="text-[10px] text-ink-4 leading-tight">
                  Calculer
                </span>
              )}
            </button>
          );
        })}
      </div>

      {pickerKey && (
        <BottomSheet
          onClose={() => setPickerKey(null)}
          title={`Agrégation — ${pickerKey}`}
          autoHeight
        >
          <div className={clsx("flex flex-col divide-y", "divide-line")}>
            {AGG_OPS.map((op) => {
              const checked = (aggregations[pickerKey] ?? "none") === op;
              return (
                <button
                  key={op}
                  type="button"
                  onClick={() => {
                    onAggregationChange(pickerKey, op);
                    setPickerKey(null);
                  }}
                  className={clsx(
                    "w-full flex items-center gap-3 px-4 py-4 text-left text-base transition-colors",
                    "text-ink",
                    "active:bg-surface-2"
                  )}
                >
                  <span className="flex-1 min-w-0 truncate">
                    {AGG_LABELS[op]}
                  </span>
                  {checked && (
                    <span className="text-accent text-lg leading-none">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
