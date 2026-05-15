import { sfChevronLeft } from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { useAtom } from "jotai";
import { useSetAtom } from "jotai";
import { defaultDisplayModeAtom } from "../../../shared/lib/Atoms";
import { mobileGoBackAtom } from "../../../shared/lib/Atoms";
import { DISPLAY_MODES } from "../../../shared/lib/displayModes";
import { hapticImpact } from "../../lib/haptics";

const descriptions: Record<string, string> = {
  normal: "Sans empattement, aligné à gauche",
  livre: "Serif, justifié, indentation",
};

export function MobileSettingsView() {
  const [defaultDisplayMode, setDefaultDisplayMode] = useAtom(
    defaultDisplayModeAtom
  );
  const goBack = useSetAtom(mobileGoBackAtom);

  return (
    <div className="flex flex-col h-full w-full fixed bg-gray-100">
      {/* Header */}
      <div className="flex items-center w-full justify-between px-2 py-2 border-b bg-white border-gray-100 fixed top-0 pt-12 z-30">
        <button
          type="button"
          onClick={() => {
            hapticImpact("light");
            goBack();
          }}
          className="flex-1 justify-start flex items-center gap-1 px-2 py-1.5 rounded-lg text-amber-500 active:bg-gray-100 transition-colors"
        >
          <SFIcon icon={sfChevronLeft} className="size-4" />
          <span className="text-base">Notes</span>
        </button>
        <h1 className="flex-1 text-center text-base font-semibold text-gray-900 pr-16">
          Réglages
        </h1>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-auto pt-28 px-4 pb-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-1">
          Mode de lecture par défaut
        </p>
        <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-xs">
          {DISPLAY_MODES.map(({ value, icon, label }, i) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                hapticImpact("light");
                setDefaultDisplayMode(value);
              }}
              className={`w-full flex items-center gap-3 px-4 py-4 text-left active:bg-gray-50 transition-colors ${
                i < DISPLAY_MODES.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              <SFIcon
                icon={icon}
                className="size-5 text-gray-400 shrink-0"
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <p className="text-base text-gray-900">{label}</p>
                <p className="text-sm text-gray-400">{descriptions[value]}</p>
              </div>
              {defaultDisplayMode === value && (
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400 px-1">
          Appliqué aux nouvelles notes et aux notes sans mode défini.
        </p>
      </div>
    </div>
  );
}
