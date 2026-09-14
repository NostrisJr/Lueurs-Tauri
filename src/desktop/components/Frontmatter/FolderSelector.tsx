import clsx from "clsx";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { AnchoredDropdown } from "../../../shared/components/AnchoredDropdown";
import type { FolderNode } from "../../../shared/hooks/useFileTree";
import { allFoldersAtom, folderPathAtom } from "../../../shared/lib/atoms";
import { isMobile } from "../../../shared/lib/platform";

interface FolderSelectorProps {
  onSelect: (absolutePath: string) => void;
  onClose: () => void;
  anchorRef: { current: HTMLElement | HTMLButtonElement | null };
}

export function FolderSelector({
  onSelect,
  onClose,
  anchorRef,
}: FolderSelectorProps) {
  const [query, setQuery] = useState("");
  const folderPath = useAtomValue(folderPathAtom);
  const allFolders = useAtomValue(allFoldersAtom);

  function relLabel(folder: FolderNode) {
    return folderPath ? folder.id.slice(folderPath.length + 1) : folder.id;
  }

  const filtered = allFolders.filter((f) =>
    relLabel(f).toLowerCase().includes(query.toLowerCase())
  );

  const showRoot =
    !!folderPath && "racine du vault".includes(query.toLowerCase());

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
          placeholder="Rechercher un dossier..."
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
        {!showRoot && filtered.length === 0 ? (
          <p
            className={clsx(
              "px-4 text-ink-4",
              isMobile ? "py-4 text-base" : "py-2 text-xs"
            )}
          >
            Aucun dossier trouvé
          </p>
        ) : (
          <>
            {showRoot && folderPath && (
              <button
                type="button"
                onClick={() => {
                  onSelect(folderPath);
                  onClose();
                }}
                className={clsx(
                  "w-full text-left text-ink-2 italic active:bg-surface-2 transition-colors border-b border-line last:border-none",
                  isMobile
                    ? "px-4 py-3.5 text-base"
                    : "px-3 py-1.5 text-xs hover:bg-surface-2"
                )}
              >
                Racine du vault
              </button>
            )}
            {filtered.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => {
                  onSelect(folder.id);
                  onClose();
                }}
                className={clsx(
                  "w-full text-left text-ink-2 active:bg-surface-2 transition-colors border-b border-line last:border-none",
                  isMobile
                    ? "px-4 py-3.5 text-base"
                    : "px-3 py-1.5 text-xs hover:bg-surface-2"
                )}
              >
                <span className="font-medium">{relLabel(folder)}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </AnchoredDropdown>
  );
}
