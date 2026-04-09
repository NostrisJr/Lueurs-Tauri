import { useState, useEffect, useRef } from "react";
import { platform } from "@tauri-apps/plugin-os";
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
  const isMobile = platform() === "ios";

  useEffect(() => {
    // Délai pour laisser l'animation BottomSheet démarrer avant le focus
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const filtered = notes.filter((n) =>
    n.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <AnchoredDropdown
      anchorRef={anchorRef}
      onClose={onClose}
      className="max-w-130"
    >
      <div className="px-2 py-1.5 border-b border-gray-100">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          placeholder={placeholder}
          style={isMobile ? { fontSize: 16 } : undefined}
          className="w-full text-gray-700 outline-none placeholder:text-gray-400"
        />
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: isMobile ? "50vh" : 192 }}>
        {filtered.length === 0 ? (
          <p className={`px-4 text-gray-400 ${isMobile ? "py-4 text-base" : "py-2 text-xs"}`}>
            Aucune note trouvée
          </p>
        ) : (
          filtered.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => { onSelect(note); onClose(); }}
              className={`w-full text-left text-gray-700 active:bg-gray-50 transition-colors border-b border-gray-50 last:border-none ${
                isMobile ? "px-4 py-3.5 text-base" : "px-3 py-1.5 text-xs hover:bg-gray-50"
              }`}
            >
              <span className="font-medium">{note.name}</span>
              <span className={`ml-2 text-gray-400 ${isMobile ? "text-sm" : "text-[10px]"}`}>
                {note.id.split("/").slice(-2, -1)[0]}
              </span>
              {note.type && (
                <span className={`ml-2 text-gray-300 font-mono ${isMobile ? "text-sm" : "text-[10px]"}`}>
                  {note.type.replace(/^__|__$/g, "")}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </AnchoredDropdown>
  );
}
