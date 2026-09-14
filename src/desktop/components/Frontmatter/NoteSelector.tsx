import clsx from "clsx";
import { useState } from "react";
import { AnchoredDropdown } from "../../../shared/components/AnchoredDropdown";
import type { NoteFile } from "../../../shared/hooks/useFileTree";
import { isMobile } from "../../../shared/lib/platform";

interface NoteSelectorProps {
  notes: NoteFile[];
  onSelect: (note: NoteFile) => void;
  onClose: () => void;
  anchorRef: { current: HTMLElement | HTMLButtonElement | null };
  placeholder?: string;
  /** cf. AnchoredDropdownProps.zIndex — à surclasser si rendu dans un popup déjà empilé. */
  zIndex?: number;
}

export function NoteSelector({
  notes,
  onSelect,
  onClose,
  anchorRef,
  placeholder = "Rechercher une note...",
  zIndex,
}: NoteSelectorProps) {
  const [query, setQuery] = useState("");

  const filtered = notes.filter((n) =>
    n.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <AnchoredDropdown
      anchorRef={anchorRef}
      onClose={onClose}
      className="max-w-130"
      zIndex={zIndex}
    >
      <div className={clsx("px-2 py-1.5 border-b", "border-line")}>
        <input
          ref={(el) => el?.focus()}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          placeholder={placeholder}
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
            Aucune note trouvée
          </p>
        ) : (
          filtered.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => {
                onSelect(note);
                onClose();
              }}
              className={clsx(
                "w-full text-left text-ink-2 active:bg-surface-2 transition-colors border-b border-line last:border-none",
                isMobile
                  ? "px-4 py-3.5 text-base"
                  : "px-3 py-1.5 text-xs hover:bg-surface-2"
              )}
            >
              <span className="font-medium">{note.name}</span>
              <span
                className={clsx(
                  "ml-2 text-ink-4",
                  isMobile ? "text-sm" : "text-[10px]"
                )}
              >
                {note.id.split("/").slice(-2, -1)[0]}
              </span>
              {note.type && (
                <span
                  className={clsx(
                    "ml-2 text-ink-5 font-mono",
                    isMobile ? "text-sm" : "text-[10px]"
                  )}
                >
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
