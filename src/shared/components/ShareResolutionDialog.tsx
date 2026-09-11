// Dialogue affiché avant un partage (.lueurs) quand le bundle référence
// des notes hors de sa sélection (wikilinks, ref() de formules) — voir
// shareResolutionAtom / bundleShare.ts. Partagé desktop + mobile (overlay
// centré, sans dépendance de plateforme).

import { useAtom } from "jotai";
import { useState } from "react";
import { shareResolutionAtom } from "../lib/atoms";

type Mode = "asis" | "bake" | "recursive";

const MODES: { value: Mode; label: string; description: string }[] = [
  {
    value: "asis",
    label: "Laisser tel quel",
    description:
      "Les liens/formules concernés resteront inertes chez le destinataire.",
  },
  {
    value: "bake",
    label: "Figer les valeurs",
    description:
      "Remplace les formules concernées par leur résultat actuel ; les liens deviennent du texte simple.",
  },
  {
    value: "recursive",
    label: "Bundler récursivement",
    description:
      "Inclut les notes référencées (et leurs propres ressources) dans le partage.",
  },
];

export function ShareResolutionDialog() {
  const [request, setRequest] = useAtom(shareResolutionAtom);
  const [mode, setMode] = useState<Mode>("asis");
  const [includeChildren, setIncludeChildren] = useState(true);

  if (!request) return null;

  function close(choice: { mode: Mode; includeChildren: boolean } | null) {
    request?.resolve(choice);
    setRequest(null);
    setMode("asis");
    setIncludeChildren(true);
  }

  const { wikilinkCount, formulaCount, hasChildren } = request;

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/30 p-4"
      onClick={() => close(null)}
      onKeyDown={(e) => e.key === "Escape" && close(null)}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Références hors du partage
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {[
              wikilinkCount > 0 &&
                `${wikilinkCount} lien${wikilinkCount > 1 ? "s" : ""} vers une autre note`,
              formulaCount > 0 &&
                `${formulaCount} formule${formulaCount > 1 ? "s" : ""}`,
            ]
              .filter(Boolean)
              .join(" et ")}{" "}
            ne pointe{wikilinkCount + formulaCount > 1 ? "nt" : ""} vers aucune
            note incluse dans ce partage.
          </p>
        </div>

        <div className="space-y-2">
          {MODES.map((m) => (
            <label
              key={m.value}
              className="flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-200 has-checked:border-gray-900 has-checked:bg-gray-50 cursor-pointer"
            >
              <input
                type="radio"
                name="share-resolution-mode"
                className="mt-0.5 accent-gray-900"
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
              />
              <span>
                <span className="block text-sm text-gray-900">{m.label}</span>
                <span className="block text-xs text-gray-400">
                  {m.description}
                </span>
              </span>
            </label>
          ))}
        </div>

        {hasChildren && (
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              className="accent-gray-900"
              checked={includeChildren}
              onChange={(e) => setIncludeChildren(e.target.checked)}
            />
            <span className="text-sm text-gray-700">
              Inclure les enfants de cette base
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => close(null)}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => close({ mode, includeChildren })}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-900 text-white hover:bg-gray-700 transition-colors cursor-pointer"
          >
            Partager
          </button>
        </div>
      </div>
    </div>
  );
}
