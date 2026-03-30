import { useRef, useState } from "react";

interface Props {
  value: string;
  // Propriété imposée (valeur forcée par le template) — lecture seule
  isImposed: boolean;
  width: number;
  onCommit: (value: string) => void;
}

export function TableCell({ value, isImposed, width, onCommit }: Props) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
          // biome-ignore lint/a11y/noAutofocus: <explanation>
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent outline-none text-gray-700 font-body rounded px-1 -mx-1"
        />
      ) : (
        // Imposée → ambre grisé comme dans FrontmatterEditor, contraignante → gris normal
        <span>{value || "—"}</span>
      )}
    </div>
  );
}
