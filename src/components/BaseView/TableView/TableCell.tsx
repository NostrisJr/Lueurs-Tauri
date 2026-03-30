import { useRef, useState } from "react";
import type { Frontmatter } from "../../FileTree/hooks/useFileTree";
import { isFormula, computeFormula } from "../../../lib/formulas";

interface Props {
  value: string;
  // Propriété imposée (valeur forcée par le template) — lecture seule
  isImposed: boolean;
  width: number;
  // Frontmatter de la note — pour évaluer les formules
  frontmatter: Frontmatter;
  onCommit: (value: string) => void;
}

export function TableCell({
  value,
  isImposed,
  width,
  frontmatter,
  onCommit,
}: Props) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const formula = isFormula(value);

  function startEdit() {
    if (isImposed) return;
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commit() {
    setEditing(false);
    onCommit(draft);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  }

  // Valeur affichée en mode lecture
  const displayValue = formula
    ? computeFormula(value, frontmatter as Record<string, unknown>)
    : value;

  const isError = displayValue === "#ERREUR";

  return (
    <div
      style={{ width }}
      className={`shrink-0 border-r border-gray-100 px-3 text-xs truncate last:border-none ${
        isImposed
          ? "cursor-default text-gray-300"
          : value
            ? "text-gray-700 cursor-text"
            : "text-gray-300 cursor-text"
      }`}
      onDoubleClick={startEdit}
    >
      {editing ? (
        <input
          ref={inputRef}
          // biome-ignore lint/a11y/noAutofocus: focus intentionnel à l'ouverture de l'édition
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent outline-none text-gray-700 font-body rounded px-1 -mx-1"
        />
      ) : formula ? (
        <span className="flex items-center gap-1 text-gray-400">
          <span className="text-gray-300 font-mono text-[10px] leading-none">
            ƒ
          </span>
          <span className={isError ? "text-red-400" : undefined}>
            {displayValue || "—"}
          </span>
        </span>
      ) : (
        <span>{value || "—"}</span>
      )}
    </div>
  );
}
