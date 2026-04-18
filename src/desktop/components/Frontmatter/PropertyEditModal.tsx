/**
 * PropertyEditModal — modal pour renommer une clé de propriété.
 * Sur une note __template__ : le renommage est propagé aux héritiers.
 */
import { useState } from "react";
import { AnchoredDropdown } from "../../../shared/components/AnchoredDropdown";

interface PropertyEditModalProps {
  propKey: string;
  isTemplate: boolean;
  existingKeys: string[];
  anchorRef: { current: HTMLElement | null };
  onClose: () => void;
  onRename: (oldKey: string, newKey: string) => void;
}

export function PropertyEditModal({
  propKey,
  isTemplate,
  existingKeys,
  anchorRef,
  onClose,
  onRename,
}: PropertyEditModalProps) {
  const [keyDraft, setKeyDraft] = useState(propKey);

  const trimmed = keyDraft.trim();
  const isUnchanged = trimmed === propKey;
  const isDuplicate = !isUnchanged && existingKeys.includes(trimmed);
  const canSave = trimmed !== "" && !isUnchanged && !isDuplicate;

  function handleSave() {
    if (!canSave) return;
    onRename(propKey, trimmed);
    onClose();
  }

  return (
    <AnchoredDropdown
      anchorRef={anchorRef}
      onClose={onClose}
      className="w-48 p-3"
    >
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">
        Renommer la propriété
      </p>
      <input
        // biome-ignore lint/a11y/noAutofocus: le but est de se mettre automatiquement en mode édition quand on ouvre ce menu d'édition, pas de multiplier les clics
        autoFocus
        value={keyDraft}
        onChange={(e) => setKeyDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") onClose();
        }}
        style={{ fontSize: 16 }}
        className={`w-full border rounded px-2 py-1 mb-2 outline-none transition-colors
          ${isDuplicate ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-gray-400"}`}
      />
      {isDuplicate && (
        <p className="text-[10px] text-red-400 mb-2">
          Ce nom est déjà utilisé.
        </p>
      )}
      {isTemplate && !isDuplicate && !isUnchanged && trimmed && (
        <p className="text-[10px] text-amber-500 mb-2">
          Sera propagé à toutes les notes héritières.
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={`text-xs px-2 py-1 rounded transition-colors
            ${
              canSave
                ? "bg-gray-800 text-white hover:bg-gray-700 cursor-pointer"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
        >
          Renommer
        </button>
      </div>
    </AnchoredDropdown>
  );
}
