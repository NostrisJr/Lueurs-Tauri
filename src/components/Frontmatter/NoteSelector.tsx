import { useState, useEffect, useRef } from "react";
import { AnchoredDropdown } from "./AnchoredDropdown";
import type { NoteFile } from "../FileTree/hooks/useFileTree";

interface NoteSelectorProps {
  notes: NoteFile[];
  onSelect: (note: NoteFile) => void;
  onClose: () => void;
  anchorRef: { current: HTMLElement | HTMLButtonElement | null };
  placeholder?: string;
}

export function NoteSelector({
  notes,
  onSelect,
  onClose,
  anchorRef,
  placeholder = "Rechercher une note...",
}: NoteSelectorProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = notes.filter((n) =>
    n.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <AnchoredDropdown anchorRef={anchorRef} onClose={onClose}>
      <div className="px-2 py-1.5 border-b border-gray-100">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          placeholder={placeholder}
          className="w-full text-xs text-gray-700 outline-none placeholder:text-gray-400"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-400">Aucune note trouvée</p>
        ) : (
          filtered.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => {
                onSelect(note);
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium">{note.name}</span>
              <span className="ml-1.5 text-gray-400 text-[10px]">
                {note.id.split("/").slice(-2, -1)[0]}
              </span>
            </button>
          ))
        )}
      </div>
    </AnchoredDropdown>
  );
}
