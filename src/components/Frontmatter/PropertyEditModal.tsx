/**
 * PropertyEditModal — modal pour renommer une clé de propriété.
 * Sur une note __template__ : le renommage est propagé aux héritiers.
 */
import { useState } from "react";
import { AnchoredDropdown } from "./AnchoredDropdown";

interface PropertyEditModalProps {
  propKey: string;
  isTemplate: boolean;
  anchorRef: { current: HTMLElement | null };
  onClose: () => void;
  onRename: (oldKey: string, newKey: string) => void;
}

export function PropertyEditModal({
  propKey,
  isTemplate,
  anchorRef,
  onClose,
  onRename,
}: PropertyEditModalProps) {
  const [keyDraft, setKeyDraft] = useState(propKey);

  function handleSave() {
    if (keyDraft.trim() && keyDraft !== propKey) {
      onRename(propKey, keyDraft.trim());
    }
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
        className="w-full text-xs border border-gray-200 rounded px-2 py-1 mb-2 outline-none focus:border-gray-400"
      />
      {isTemplate && keyDraft !== propKey && keyDraft.trim() && (
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
          className="text-xs bg-gray-800 text-white px-2 py-1 rounded hover:bg-gray-700 cursor-pointer"
        >
          Renommer
        </button>
      </div>
    </AnchoredDropdown>
  );
}
