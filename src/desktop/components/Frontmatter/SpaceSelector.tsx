import { platform } from "@tauri-apps/plugin-os";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { AnchoredDropdown } from "../../../shared/components/AnchoredDropdown";
import { vaultConfigAtom } from "../../../shared/lib/atoms";

interface SpaceSelectorProps {
  currentSpaces: string[];
  onSelect: (spaceName: string) => void;
  onClose: () => void;
  anchorRef: { current: HTMLElement | HTMLButtonElement | null };
}

export function SpaceSelector({
  currentSpaces,
  onSelect,
  onClose,
  anchorRef,
}: SpaceSelectorProps) {
  const [query, setQuery] = useState("");
  const isMobile = platform() === "ios";
  const vaultConfig = useAtomValue(vaultConfigAtom);
  const spaces = vaultConfig?.spaces ?? [];

  const filtered = spaces
    .filter((s) => !currentSpaces.includes(s.name))
    .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <AnchoredDropdown anchorRef={anchorRef} onClose={onClose} className="max-w-130">
      <div className="px-2 py-1.5 border-b border-gray-100">
        <input
          ref={(el) => el?.focus()}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          placeholder="Rechercher un espace..."
          style={isMobile ? { fontSize: 16 } : undefined}
          className="w-full text-gray-700 outline-none placeholder:text-gray-400"
        />
      </div>
      <div
        className="overflow-y-auto flex-col flex"
        style={{ maxHeight: isMobile ? "50vh" : 192 }}
      >
        {filtered.length === 0 ? (
          <p
            className={`px-4 text-gray-400 ${isMobile ? "py-4 text-base" : "py-2 text-xs"}`}
          >
            Aucun espace disponible
          </p>
        ) : (
          filtered.map((space) => (
            <button
              key={space.id}
              type="button"
              onClick={() => {
                onSelect(space.name);
                onClose();
              }}
              className={`w-full text-left text-gray-700 active:bg-gray-50 transition-colors border-b border-gray-50 last:border-none flex items-center gap-2 ${
                isMobile
                  ? "px-4 py-3.5 text-base"
                  : "px-3 py-1.5 text-xs hover:bg-gray-50"
              }`}
            >
              {space.icon ? (
                <span>{space.icon}</span>
              ) : space.color ? (
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ background: space.color }}
                />
              ) : null}
              <span className="font-medium">{space.name}</span>
            </button>
          ))
        )}
      </div>
    </AnchoredDropdown>
  );
}
