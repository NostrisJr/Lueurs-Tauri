import clsx from "clsx";
import { useAtomValue } from "jotai";
import { type DisplayMode, displayModeAtom } from "../../lib/atoms";
import { DISPLAY_MODES } from "../../lib/displayModes";

interface Props {
  onModeChange: (mode: DisplayMode) => void;
}

export function DisplayModeSelector({ onModeChange }: Props) {
  const mode = useAtomValue(displayModeAtom);

  function handleSelect(value: DisplayMode) {
    onModeChange(value);
  }

  return (
    <div
      className={clsx(
        "flex gap-0.5 h-10 rounded-full p-0.75 transition",
        "bg-track/80"
      )}
    >
      {DISPLAY_MODES.map(({ value, Icon, label: title }) => (
        <button
          key={value}
          type="button"
          title={title}
          onClick={() => handleSelect(value)}
          className={clsx(
            "px-4 py-1 rounded-full transition-all cursor-default flex items-center justify-center",
            mode === value
              ? "bg-control shadow-sm text-ink-2"
              : "text-ink-4 hover:text-ink-3"
          )}
        >
          <Icon className="size-4.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
