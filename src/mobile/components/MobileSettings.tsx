import { useAtom } from "jotai";
import { defaultDisplayModeAtom } from "../../shared/lib/Atoms";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { BottomSheet } from "./BottomSheet";
import { DISPLAY_MODES } from "../../shared/lib/displayModes";

const descriptions: Record<string, string> = {
  normal: "Sans empattement, aligné à gauche",
  livre: "Serif, justifié, indentation",
};

interface Props {
  onClose: () => void;
}

export function MobileSettings({ onClose }: Props) {
  const [defaultDisplayMode, setDefaultDisplayMode] = useAtom(defaultDisplayModeAtom);

  return (
    <BottomSheet onClose={onClose} title="Réglages">
      <div className="px-4 py-2">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
          Mode de lecture par défaut
        </p>
        <div className="rounded-xl overflow-hidden border border-gray-100">
          {DISPLAY_MODES.map(({ value, icon, label }, i) => (
            <button
              key={value}
              type="button"
              onClick={() => setDefaultDisplayMode(value)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors ${
                i < DISPLAY_MODES.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              <SFIcon icon={icon} className="size-5 text-gray-400 shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{label}</p>
                <p className="text-xs text-gray-400">{descriptions[value]}</p>
              </div>
              {defaultDisplayMode === value && (
                <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Appliqué aux nouvelles notes et aux notes sans mode défini.
        </p>
      </div>
    </BottomSheet>
  );
}
