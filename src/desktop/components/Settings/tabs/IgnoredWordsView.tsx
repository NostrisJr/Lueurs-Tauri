import clsx from "clsx";
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
          className={clsx(
            "flex size-7 items-center justify-center rounded-full cursor-default",
            "text-ink-4",
            "hover:bg-surface-3 hover:text-ink-2"
          )}
          aria-label="Retour"
        >
          <IconChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium text-ink-2">Mots ignorés</span>
        <span className="text-xs text-ink-4">{ignoredWords.length}</span>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher…"
        className={clsx(
          "shrink-0 rounded-md border px-2 py-1 text-sm outline-none",
          "border-line-2",
          "focus:border-line-3"
        )}
      />

      {/* Liste scrollable */}
      <div className="mt-3 flex-1 overflow-y-auto">
        {ignoredWords.length === 0 ? (
          <p className="text-xs text-ink-4">Aucun mot ignoré.</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-ink-4">Aucun résultat.</p>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((word) => (
              <li
                key={word}
                className={clsx(
                  "flex items-center justify-between py-1.5 text-sm",
                  "text-ink-2"
                )}
              >
                <span className="truncate">{word}</span>
                <button
                  type="button"
                  onClick={() => removeWord(word)}
                  title="Retirer"
                  className={clsx(
                    "ml-2 flex size-5 shrink-0 items-center justify-center rounded-full cursor-default",
                    "text-ink-4",
                    "hover:bg-surface-4 hover:text-ink-2"
                  )}
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
