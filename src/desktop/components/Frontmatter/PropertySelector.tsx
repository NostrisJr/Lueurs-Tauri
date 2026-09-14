import clsx from "clsx";
import { useState } from "react";
import { AnchoredDropdown } from "../../../shared/components/AnchoredDropdown";
import { isMobile } from "../../../shared/lib/platform";
import type { PropertyOption } from "./lib/frontmatterUtils";

export type { PropertyOption };

interface Props {
  options: PropertyOption[];
  onSelect: (key: string) => void;
  onClose: () => void;
  anchorRef: { current: HTMLElement | null };
  /** cf. AnchoredDropdownProps.zIndex — à surclasser si rendu dans un popup déjà empilé. */
  zIndex?: number;
}

export function PropertySelector({
  options,
  onSelect,
  onClose,
  anchorRef,
  zIndex,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = options.filter((o) =>
    o.displayName.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <AnchoredDropdown anchorRef={anchorRef} onClose={onClose} zIndex={zIndex}>
      <div className={clsx("px-2 py-1.5 border-b", "border-line")}>
        <input
          ref={(el) => el?.focus()}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          placeholder="Propriété..."
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          style={isMobile ? { fontSize: 16 } : undefined}
          className={clsx(
            "w-full outline-none",
            "text-ink-2",
            "placeholder:text-ink-4"
          )}
        />
      </div>
      <div
        className="overflow-y-auto"
        style={{ maxHeight: isMobile ? "50vh" : 192 }}
      >
        {filtered.length === 0 ? (
          <p
            className={clsx(
              "px-4 text-ink-4",
              isMobile ? "py-4 text-base" : "py-2 text-xs"
            )}
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
              className={clsx(
                "w-full text-left text-ink-2 font-mono active:bg-surface-2 transition-colors border-b border-line last:border-none",
                isMobile
                  ? "px-4 py-3.5 text-base"
                  : "px-3 py-1.5 text-xs hover:bg-surface-2"
              )}
            >
              {opt.displayName}
            </button>
          ))
        )}
      </div>
    </AnchoredDropdown>
  );
}
