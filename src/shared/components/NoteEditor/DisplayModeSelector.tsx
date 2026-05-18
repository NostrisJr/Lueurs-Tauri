import { useAtom } from "jotai";
import { type DisplayMode, displayModeAtom } from "../../lib/Atoms";
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
    <div className="flex gap-0.5 h-10 bg-gray-100/80 rounded-full p-0.75 transition">
      {DISPLAY_MODES.map(({ value, Icon, label: title }) => (
        <button
          key={value}
          type="button"
          title={title}
          onClick={() => handleSelect(value)}
          className={[
            "px-4 py-1 rounded-full transition-all cursor-default flex items-center justify-center",
            mode === value
              ? "bg-white shadow-sm text-gray-700"
              : "text-gray-400 hover:text-gray-500",
          ].join(" ")}
        >
          <Icon className="size-4.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
