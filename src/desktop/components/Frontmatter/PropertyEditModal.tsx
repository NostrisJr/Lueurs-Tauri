/**
 * PropertyEditModal — modal pour renommer une clé de propriété.
 * Sur une note __template__ : le renommage est propagé aux héritiers.
 */
import { platform } from "@tauri-apps/plugin-os";
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
  const isMobile = platform() === "ios";
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
      <p className={`text-gray-400 uppercase tracking-wide mb-2 ${isMobile ? "text-sm px-1" : "text-[10px]"}`}>
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
        className={`w-full border rounded mb-2 outline-none transition-colors
          ${isMobile ? "px-3 py-2" : "px-2 py-1"}
          ${isDuplicate ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-gray-400"}`}
      />
      {isDuplicate && (
        <p className={`text-red-400 mb-2 ${isMobile ? "text-sm px-1" : "text-[10px]"}`}>
          Ce nom est déjà utilisé.
        </p>
      )}
      {isTemplate && !isDuplicate && !isUnchanged && trimmed && (
        <p className={`text-amber-500 mb-2 ${isMobile ? "text-sm px-1" : "text-[10px]"}`}>
          Sera propagé à toutes les notes héritières.
        </p>
      )}
      <div className={`flex gap-2 justify-end ${isMobile ? "mt-2" : ""}`}>
        <button
          type="button"
          onClick={onClose}
          className={`text-gray-400 hover:text-gray-600 cursor-pointer ${isMobile ? "text-base px-3 py-2" : "text-xs"}`}
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={`rounded transition-colors
            ${isMobile ? "text-base px-4 py-2" : "text-xs px-2 py-1"}
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
