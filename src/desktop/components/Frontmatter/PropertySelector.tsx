import { useState, useEffect, useRef } from "react";
import { platform } from "@tauri-apps/plugin-os";
import { AnchoredDropdown } from "../../../shared/components/AnchoredDropdown";

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

export function PropertySelector({
  options,
  onSelect,
  onClose,
  anchorRef,
}: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = platform() === "ios";

  useEffect(() => {
    // Délai pour laisser l'animation BottomSheet démarrer avant le focus
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
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
          style={isMobile ? { fontSize: 16 } : undefined}
          className="w-full text-gray-700 outline-none placeholder:text-gray-400"
        />
      </div>
      <div
        className="overflow-y-auto"
        style={{ maxHeight: isMobile ? "50vh" : 192 }}
      >
        {filtered.length === 0 ? (
          <p
            className={`px-4 text-gray-400 ${isMobile ? "py-4 text-base" : "py-2 text-xs"}`}
          >
            Aucune propriété
          </p>
        ) : (
          filtered.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                onSelect(opt.key);
                onClose();
              }}
              className={`w-full text-left text-gray-700 font-mono active:bg-gray-50 transition-colors border-b border-gray-50 last:border-none ${
                isMobile
                  ? "px-4 py-3.5 text-base"
                  : "px-3 py-1.5 text-xs hover:bg-gray-50"
              }`}
            >
              {opt.displayName}
            </button>
          ))
        )}
      </div>
    </AnchoredDropdown>
  );
}
