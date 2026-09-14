import clsx from "clsx";
import { useRef, useState } from "react";
import { AnchoredDropdown } from "../../../../shared/components/AnchoredDropdown";
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

interface Props {
  columns: TableColumn[];
  titleColWidth: number;
  childNotes: NoteFile[];
  aggregations: TableAggregations;
  onAggregationChange: (key: string, op: AggregationOp) => void;
}

interface CellProps {
  colKey: string;
  width: number;
  childNotes: NoteFile[];
  op: AggregationOp;
  onChange: (op: AggregationOp) => void;
}

function AggregationCell({
  colKey,
  width,
  childNotes,
  op,
  onChange,
}: CellProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const result = computeAggregation(
    childNotes,
    colKey,
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
    // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
    <div
      ref={anchorRef}
      style={{ width }}
      className={clsx(
        "relative flex shrink-0 border-r last:border-none px-3 py-1.5 cursor-pointer select-none group justify-end",
        "border-line"
      )}
      onClick={() => setOpen((v) => !v)}
      title="Choisir une agrégation"
    >
      {op !== "none" ? (
        <div className="flex flex-col">
          <span
            className={clsx(
              "text-[10px] font-body leading-tight",
              "text-ink-4"
            )}
          >
            {AGG_LABELS[op]}
          </span>
          <span
            className={clsx(
              "text-xs font-body font-medium leading-tight",
              "text-ink-3"
            )}
          >
            {result}
          </span>
        </div>
      ) : (
        <span
          className={clsx(
            "text-[10px] text-transparent transition-colors transition-300 font-body",
            "group-hover:text-ink-4"
          )}
        >
          Calculer
        </span>
      )}

      {open && (
        <AnchoredDropdown anchorRef={anchorRef} onClose={() => setOpen(false)}>
          <div className="py-1">
            {AGG_OPS.map((aggOp) => (
              <button
                key={aggOp}
                type="button"
                className={clsx(
                  "w-full text-left px-3 py-1.5 text-xs font-body hover:bg-surface-3 transition-colors",
                  aggOp === op ? "text-accent font-medium" : "text-ink-2"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(aggOp);
                  setOpen(false);
                }}
              >
                {AGG_LABELS[aggOp]}
              </button>
            ))}
          </div>
        </AnchoredDropdown>
      )}
    </div>
  );
}

export function TableFooter({
  columns,
  titleColWidth,
  childNotes,
  aggregations,
  onAggregationChange,
}: Props) {
  return (
    <div className={clsx("flex items-stretch rounded-b-lg", "bg-surface-2/50")}>
      {/* Cellule titre — vide, non interactive */}
      <div
        style={{ width: titleColWidth }}
        className={clsx("shrink-0 border-r px-3 py-1.5", "border-line")}
      />

      {columns.map((col) => (
        <AggregationCell
          key={col.key}
          colKey={col.key}
          width={col.width}
          childNotes={childNotes}
          op={aggregations[col.key] ?? "none"}
          onChange={(op) => onAggregationChange(col.key, op)}
        />
      ))}
    </div>
  );
}
