import SFIcon from "@bradleyhodges/sfsymbols-react";
import { useAtom } from "jotai";
import { displayModeAtom, type DisplayMode } from "../../lib/Atoms";
import { DISPLAY_MODES } from "../../lib/displayModes";

interface Props {
  onModeChange: (mode: DisplayMode) => void;
}

export function DisplayModeSelector({ onModeChange }: Props) {
  const [mode, setMode] = useAtom(displayModeAtom);

  function handleSelect(value: DisplayMode) {
    setMode(value);
    onModeChange(value);
  }

  return (
    <div
      className="fixed z-50 top-3 right-4 flex gap-0.5 bg-gray-100/80 backdrop-blur rounded-full px-1.5 py-1"
      style={{ transition: "opacity 0.2s" }}
    >
      {DISPLAY_MODES.map(({ value, icon, label: title }) => (
        <button
          key={value}
          type="button"
          title={title}
          onClick={() => handleSelect(value)}
          className={[
            "px-3 py-1 rounded-full transition-all cursor-default",
            mode === value
              ? "bg-white shadow-sm text-gray-700"
              : "text-gray-400 hover:text-gray-500",
          ].join(" ")}
        >
          <SFIcon icon={icon} className="size-4.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
