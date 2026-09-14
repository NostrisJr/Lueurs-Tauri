import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import { SegmentedControl } from "../../../../shared/components/SegmentedControl";
import {
  SPELLCHECK_ENGINES,
  defaultDisplayModeAtom,
  defaultHighlightColorAtom,
  ignoredWordsAtom,
  pageFormatAtom,
  spellcheckEngineAtom,
  textJustificationAtom,
  themePreferenceAtom,
} from "../../../../shared/lib/atoms";
import { DISPLAY_MODES } from "../../../../shared/lib/displayModes";
import {
  PAGE_FORMATS,
  type PageFormat,
} from "../../../../shared/lib/pageMetrics";
import { THEME_OPTIONS } from "../../../../shared/lib/theme";
import {
  HIGHLIGHT_COLORS,
  getHighlightSolid,
} from "../../../../shared/plugins/highlight/colors";
import { IgnoredWordsView } from "./IgnoredWordsView";

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
  const [themePreference, setThemePreference] = useAtom(themePreferenceAtom);
  const ignoredWords = useAtomValue(ignoredWordsAtom);
  const [showIgnored, setShowIgnored] = useState(false);

  // Vue dédiée des mots ignorés — remplace le contenu de l'onglet (liste longue).
  if (showIgnored)
    return <IgnoredWordsView onBack={() => setShowIgnored(false)} />;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs text-ink-3">Apparence</p>
        <SegmentedControl
          options={THEME_OPTIONS}
          value={themePreference}
          onChange={setThemePreference}
        />
        <p className="text-xs text-ink-4">
          « Système » suit le réglage clair/sombre de macOS.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-ink-3">Mode de lecture par défaut</p>
        <SegmentedControl
          options={DISPLAY_MODES}
          value={defaultDisplayMode}
          onChange={setDefaultDisplayMode}
        />
        <p className="text-xs text-ink-4">
          Appliqué aux nouvelles notes et aux notes sans mode défini.
        </p>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={textJustification}
          onChange={() => setTextJustification((v) => !v)}
          className="rounded accent-ink cursor-pointer"
        />
        <span className="text-sm text-ink-2">
          Justifier le texte en mode livre
        </span>
      </label>

      <div className="space-y-2">
        <p className="text-xs text-ink-3">
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
          className={clsx(
            "flex w-fit items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors cursor-default",
            "border-line-2 text-ink-2",
            "hover:bg-surface-2"
          )}
        >
          Consulter les mots ignorés
          <span className="text-xs text-ink-4">{ignoredWords.length}</span>
        </button>
      )}

      <div className="space-y-2">
        <p className="text-xs text-ink-3">
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
                background: getHighlightSolid(c.id),
                borderColor:
                  defaultHighlightColor === c.id
                    ? "var(--color-ink-2)"
                    : "transparent",
                transform: defaultHighlightColor === c.id ? "scale(1.15)" : "",
              }}
            >
              {defaultHighlightColor === c.id && (
                <span
                  className={clsx(
                    "absolute inset-0 flex items-center justify-center text-[9px] font-bold",
                    "text-on-inverse"
                  )}
                >
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-ink-3">
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
