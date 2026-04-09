import { useState } from "react";
import { isFormula, computeFormula } from "../../../lib/formulas";
import type { NoteFile } from "../../FileTree/hooks/useFileTree";

interface Props {
  value: string;
  isImposed: boolean;
  frontmatter: Record<string, unknown>;
  noteResolver: (path: string) => NoteFile | undefined;
  onCommit: (value: string) => void;
}

const CELL_WIDTH = 140;

export function MobileTableCell({
  value,
  isImposed,
  frontmatter,
  noteResolver,
  onCommit,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const formula = isFormula(value);

  const displayValue = formula
    ? computeFormula(value, frontmatter, undefined, noteResolver)
    : value;

  function commit() {
    setEditing(false);
    onCommit(draft);
  }

  return (
    <div
      className="shrink-0 px-3 py-2 border-r border-gray-100 last:border-none"
      style={{ width: CELL_WIDTH }}
      // biome-ignore lint/a11y/useKeyWithClickEvents: édition inline
      onClick={() => {
        if (!isImposed && !formula) {
          setDraft(value);
          setEditing(true);
        }
      }}
    >
      {editing ? (
        <input
          // biome-ignore lint/a11y/noAutofocus: focus intentionnel
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          style={{ fontSize: 16 }}
          className="w-full bg-transparent outline-none text-gray-700 text-sm"
        />
      ) : (
        <span
          className={`text-sm truncate block ${
            formula
              ? "text-gray-400"
              : isImposed
                ? "text-gray-300"
                : value
                  ? "text-gray-700"
                  : "text-gray-300"
          }`}
        >
          {formula ? (
            <span className="flex items-center gap-1">
              <span className="text-gray-300 font-mono text-[10px]">ƒ</span>
              {displayValue || "—"}
            </span>
          ) : (
            displayValue || "—"
          )}
        </span>
      )}
    </div>
  );
}
