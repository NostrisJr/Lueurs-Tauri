import { useAtom } from "jotai";
import {
  defaultDisplayModeAtom,
  defaultHighlightColorAtom,
  pageFormatAtom,
  textJustificationAtom,
} from "../../../../shared/lib/atoms";
import { DISPLAY_MODES } from "../../../../shared/lib/displayModes";
import { PAGE_FORMATS, type PageFormat } from "../../../../shared/lib/pageMetrics";
import { HIGHLIGHT_COLORS } from "../../../../shared/plugins/highlight/colors";

export function EditeurTab() {
  const [defaultDisplayMode, setDefaultDisplayMode] = useAtom(defaultDisplayModeAtom);
  const [defaultHighlightColor, setDefaultHighlightColor] = useAtom(defaultHighlightColorAtom);
  const [textJustification, setTextJustification] = useAtom(textJustificationAtom);
  const [pageFormat, setPageFormat] = useAtom(pageFormatAtom);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs text-gray-500">Mode de lecture par défaut</p>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {DISPLAY_MODES.map(({ value, Icon, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setDefaultDisplayMode(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all cursor-default ${
                defaultDisplayMode === value
                  ? "bg-white shadow-sm text-gray-800 font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
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
        <span className="text-sm text-gray-700">Justifier le texte en mode livre</span>
      </label>

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
                borderColor: defaultHighlightColor === c.id ? "#374151" : "transparent",
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
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(Object.keys(PAGE_FORMATS) as PageFormat[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPageFormat(value)}
              className={`px-3 py-1.5 rounded-md text-sm transition-all cursor-default ${
                pageFormat === value
                  ? "bg-white shadow-sm text-gray-800 font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {PAGE_FORMATS[value].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
