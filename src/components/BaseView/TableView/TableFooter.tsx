import { useRef, useState } from "react";
import type { NoteFile } from "../../FileTree/hooks/useFileTree";
import type { TableColumn } from "../hooks/useTable";
import {
  type AggregationOp,
  type TableAggregations,
  AGG_OPS,
  AGG_LABELS,
  computeAggregation,
} from "../../../lib/aggregations";
import { AnchoredDropdown } from "../../Frontmatter/AnchoredDropdown";
import { computeFormula, isFormula } from "../../../lib/formulas";

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
      className="relative flex border-r border-gray-100 last:border-none px-3 py-1.5 cursor-pointer select-none group justify-end"
      onClick={() => setOpen((v) => !v)}
      title="Choisir une agrégation"
    >
      {op !== "none" ? (
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-400 font-body leading-tight">
            {AGG_LABELS[op]}
          </span>
          <span className="text-xs text-gray-500 font-body font-medium leading-tight">
            {result}
          </span>
        </div>
      ) : (
        <span className="text-[10px] text-transparent group-hover:text-gray-400 transition-colors  transition-300 font-body">
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
                className={`w-full text-left px-3 py-1.5 text-xs font-body hover:bg-gray-100 transition-colors ${
                  aggOp === op ? "text-amber-500 font-medium" : "text-gray-700"
                }`}
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
    <div className="flex items-stretch bg-gray-50/50 rounded-b-lg">
      {/* Cellule titre — vide, non interactive */}
      <div
        style={{ width: titleColWidth }}
        className="shrink-0 border-r border-gray-100 px-3 py-1.5"
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
