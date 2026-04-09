import { useState, useRef } from "react";
import { BottomSheet } from "../BottomSheet";

interface RenameTarget {
  id: string;
  name: string;
  isFolder: boolean;
}

interface Props {
  target: RenameTarget | null;
  onClose: () => void;
  onCommit: (id: string, newName: string, isFolder: boolean) => Promise<void>;
}

export function RenameSheet({ target, onClose, onCommit }: Props) {
  const [draft, setDraft] = useState(target?.name ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!target) return null;

  // Focus auto à l'ouverture
  setTimeout(() => inputRef.current?.focus(), 300);

  async function handleCommit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== target!.name) {
      await onCommit(target!.id, trimmed, target!.isFolder);
    }
    onClose();
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-4 pt-1 pb-3 shrink-0">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
          {target.isFolder ? "Renommer le dossier" : "Renommer la note"}
        </p>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCommit();
            if (e.key === "Escape") onClose();
          }}
          style={{ fontSize: 16 }}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 outline-none focus:border-blue-400 transition-colors"
        />
      </div>
      <div className="flex gap-2 px-4 pt-1 pb-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 text-base text-gray-500 active:bg-gray-100 rounded-xl transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleCommit}
          className="flex-1 py-2.5 text-base text-white bg-blue-500 active:bg-blue-600 rounded-xl transition-colors font-medium"
        >
          Renommer
        </button>
      </div>
    </BottomSheet>
  );
}
