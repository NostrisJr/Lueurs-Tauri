import clsx from "clsx";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { AnchoredDropdown } from "../../../shared/components/AnchoredDropdown";
import { vaultConfigAtom } from "../../../shared/lib/atoms";
import { isMobile } from "../../../shared/lib/platform";

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
  const vaultConfig = useAtomValue(vaultConfigAtom);
  const spaces = vaultConfig?.spaces ?? [];

  const filtered = spaces
    .filter((s) => !currentSpaces.includes(s.name))
    .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <AnchoredDropdown
      anchorRef={anchorRef}
      onClose={onClose}
      className="max-w-130"
    >
      <div className={clsx("px-2 py-1.5 border-b", "border-line")}>
        <input
          ref={(el) => el?.focus()}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          placeholder="Rechercher un espace..."
          style={isMobile ? { fontSize: 16 } : undefined}
          className={clsx(
            "w-full outline-none",
            "text-ink-2",
            "placeholder:text-ink-4"
          )}
        />
      </div>
      <div
        className="overflow-y-auto flex-col flex"
        style={{ maxHeight: isMobile ? "50vh" : 192 }}
      >
        {filtered.length === 0 ? (
          <p
            className={clsx(
              "px-4 text-ink-4",
              isMobile ? "py-4 text-base" : "py-2 text-xs"
            )}
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
              className={clsx(
                "w-full text-left text-ink-2 active:bg-surface-2 transition-colors border-b border-line last:border-none flex items-center gap-2",
                isMobile
                  ? "px-4 py-3.5 text-base"
                  : "px-3 py-1.5 text-xs hover:bg-surface-2"
              )}
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
