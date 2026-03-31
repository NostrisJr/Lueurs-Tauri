import { useState, useEffect, useRef } from "react";
import { AnchoredDropdown } from "./AnchoredDropdown";

export interface PropertyOption {
  key: string;
  displayName: string;
}

interface Props {
  options: PropertyOption[];
  onSelect: (key: string) => void;
  onClose: () => void;
  anchorRef: { current: HTMLElement | null };
}

export function PropertySelector({ options, onSelect, onClose, anchorRef }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = options.filter((o) =>
    o.displayName.toLowerCase().includes(query.toLowerCase())
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
          placeholder="Propriété..."
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          className="w-full text-xs text-gray-700 outline-none placeholder:text-gray-400"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-400">Aucune propriété</p>
        ) : (
          filtered.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => { onSelect(opt.key); onClose(); }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors font-mono"
            >
              {opt.displayName}
            </button>
          ))
        )}
      </div>
    </AnchoredDropdown>
  );
}
