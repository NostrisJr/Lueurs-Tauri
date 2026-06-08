import { useAtomValue, useSetAtom } from "jotai";
import { useMemo, useState } from "react";
import { IconChevronLeft } from "../../../../shared/components/PlatformIcon";
import {
  ignoredWordsAtom,
  updateIgnoredWordsAtom,
} from "../../../../shared/lib/atoms";

interface Props {
  onBack: () => void;
}

/**
 * Vue dédiée (plein panneau réglages) listant les mots ignorés par le correcteur.
 * Lecture + suppression uniquement — l'ajout se fait via le popover de correction.
 * Synchronisée avec `.lueurs/config.json` via updateIgnoredWordsAtom.
 */
export function IgnoredWordsView({ onBack }: Props) {
  const ignoredWords = useAtomValue(ignoredWordsAtom);
  const updateIgnoredWords = useSetAtom(updateIgnoredWordsAtom);
  const [query, setQuery] = useState("");

  // Tri alphabétique stable, puis filtre par recherche (insensible à la casse).
  const filtered = useMemo(() => {
    const sorted = [...ignoredWords].sort((a, b) =>
      a.localeCompare(b, "fr", { sensitivity: "base" })
    );
    const q = query.trim().toLowerCase();
    return q ? sorted.filter((w) => w.toLowerCase().includes(q)) : sorted;
  }, [ignoredWords, query]);

  function removeWord(word: string) {
    updateIgnoredWords((prev) => prev.filter((x) => x !== word));
  }

  return (
    <div className="flex h-full flex-col">
      {/* En-tête fixe */}
      <div className="flex items-center gap-2 shrink-0 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="flex size-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-default"
          aria-label="Retour"
        >
          <IconChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium text-gray-700">Mots ignorés</span>
        <span className="text-xs text-gray-400">{ignoredWords.length}</span>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher…"
        className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:border-gray-400"
      />

      {/* Liste scrollable */}
      <div className="mt-3 flex-1 overflow-y-auto">
        {ignoredWords.length === 0 ? (
          <p className="text-xs text-gray-400">Aucun mot ignoré.</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-gray-400">Aucun résultat.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((word) => (
              <li
                key={word}
                className="flex items-center justify-between py-1.5 text-sm text-gray-700"
              >
                <span className="truncate">{word}</span>
                <button
                  type="button"
                  onClick={() => removeWord(word)}
                  title="Retirer"
                  className="ml-2 flex size-5 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-700 cursor-default"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
