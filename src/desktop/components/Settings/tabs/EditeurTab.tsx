import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import {
  SPELLCHECK_ENGINES,
  defaultDisplayModeAtom,
  defaultHighlightColorAtom,
  ignoredWordsAtom,
  pageFormatAtom,
  spellcheckEngineAtom,
  textJustificationAtom,
} from "../../../../shared/lib/atoms";
import { DISPLAY_MODES } from "../../../../shared/lib/displayModes";
import {
  PAGE_FORMATS,
  type PageFormat,
} from "../../../../shared/lib/pageMetrics";
import { HIGHLIGHT_COLORS } from "../../../../shared/plugins/highlight/colors";
import { IgnoredWordsView } from "./IgnoredWordsView";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  Icon?: React.FC<{ className?: string }>;
}

// Sélecteur à choix exclusif (pills), réutilisé pour mode de lecture / correcteur / format de page.
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
      {options.map(({ value: v, label, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all cursor-default ${
            value === v
              ? "bg-white shadow-sm text-gray-800 font-medium"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {Icon && <Icon className="size-3.5" aria-hidden="true" />}
          {label}
        </button>
      ))}
    </div>
  );
}

export function EditeurTab() {
  const [defaultDisplayMode, setDefaultDisplayMode] = useAtom(
    defaultDisplayModeAtom
  );
  const [defaultHighlightColor, setDefaultHighlightColor] = useAtom(
    defaultHighlightColorAtom
  );
  const [textJustification, setTextJustification] = useAtom(
    textJustificationAtom
  );
  const [spellcheckEngine, setSpellcheckEngine] = useAtom(spellcheckEngineAtom);
  const [pageFormat, setPageFormat] = useAtom(pageFormatAtom);
  const ignoredWords = useAtomValue(ignoredWordsAtom);
  const [showIgnored, setShowIgnored] = useState(false);

  // Vue dédiée des mots ignorés — remplace le contenu de l'onglet (liste longue).
  if (showIgnored)
    return <IgnoredWordsView onBack={() => setShowIgnored(false)} />;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs text-gray-500">Mode de lecture par défaut</p>
        <SegmentedControl
          options={DISPLAY_MODES}
          value={defaultDisplayMode}
          onChange={setDefaultDisplayMode}
        />
        <p className="text-xs text-gray-400">
          Appliqué aux nouvelles notes et aux notes sans mode défini.
        </p>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={textJustification}
          onChange={() => setTextJustification((v) => !v)}
          className="rounded accent-gray-800 cursor-pointer"
        />
        <span className="text-sm text-gray-700">
          Justifier le texte en mode livre
        </span>
      </label>

      <div className="space-y-2">
        <p className="text-xs text-gray-500">
          Correcteur orthographique et grammatical
        </p>
        <SegmentedControl
          options={SPELLCHECK_ENGINES}
          value={spellcheckEngine}
          onChange={setSpellcheckEngine}
        />
      </div>

      {spellcheckEngine === "hugo" && (
        <button
          type="button"
          onClick={() => setShowIgnored(true)}
          className="flex w-fit items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition-colors cursor-default hover:bg-gray-50"
        >
          Consulter les mots ignorés
          <span className="text-xs text-gray-400">{ignoredWords.length}</span>
        </button>
      )}

      <div className="space-y-2">
        <p className="text-xs text-gray-500">
          Couleur de surlignage par défaut (raccourci ⌘⇧L)
        </p>
        <div className="flex gap-2 flex-wrap">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              onClick={() => setDefaultHighlightColor(c.id)}
              className="relative w-6 h-6 rounded-full border-2 transition-all cursor-default"
              style={{
                background: c.solid,
                borderColor:
                  defaultHighlightColor === c.id ? "#374151" : "transparent",
                transform: defaultHighlightColor === c.id ? "scale(1.15)" : "",
              }}
            >
              {defaultHighlightColor === c.id && (
                <span className="absolute inset-0 flex items-center justify-center text-white text-[9px] font-bold">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-gray-500">
          Format de référence de l'indicateur de pages
        </p>
        <SegmentedControl
          options={(Object.keys(PAGE_FORMATS) as PageFormat[]).map((value) => ({
            value,
            label: PAGE_FORMATS[value].label,
          }))}
          value={pageFormat}
          onChange={setPageFormat}
        />
      </div>
    </div>
  );
}
