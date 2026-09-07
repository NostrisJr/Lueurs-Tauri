import { platform } from "@tauri-apps/plugin-os";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { AnchoredDropdown } from "../../../shared/components/AnchoredDropdown";
import type { FolderNode } from "../../../shared/hooks/useFileTree";
import { allFoldersAtom, folderPathAtom } from "../../../shared/lib/atoms";

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
  const isMobile = platform() === "ios";
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
      <div className="px-2 py-1.5 border-b border-gray-100">
        <input
          ref={(el) => el?.focus()}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          placeholder="Rechercher un dossier..."
          style={isMobile ? { fontSize: 16 } : undefined}
          className="w-full text-gray-700 outline-none placeholder:text-gray-400"
        />
      </div>
      <div
        className="overflow-y-auto flex-col flex"
        style={{ maxHeight: isMobile ? "50vh" : 192 }}
      >
        {!showRoot && filtered.length === 0 ? (
          <p
            className={`px-4 text-gray-400 ${isMobile ? "py-4 text-base" : "py-2 text-xs"}`}
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
                className={`w-full text-left text-gray-700 italic active:bg-gray-50 transition-colors border-b border-gray-50 last:border-none ${
                  isMobile
                    ? "px-4 py-3.5 text-base"
                    : "px-3 py-1.5 text-xs hover:bg-gray-50"
                }`}
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
                className={`w-full text-left text-gray-700 active:bg-gray-50 transition-colors border-b border-gray-50 last:border-none ${
                  isMobile
                    ? "px-4 py-3.5 text-base"
                    : "px-3 py-1.5 text-xs hover:bg-gray-50"
                }`}
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
