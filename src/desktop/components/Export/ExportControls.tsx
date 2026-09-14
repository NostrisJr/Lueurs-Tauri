import clsx from "clsx";
import { IconChevronDown } from "../../../shared/components/PlatformIcon";

export function PillGroup<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  labels?: readonly string[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-ink-3">{label}</span>
      <div className={clsx("flex gap-1 rounded-full p-0.5", "bg-surface-3")}>
        {options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={clsx(
              "flex-1 text-xs py-0.5 rounded-full transition-all cursor-pointer",
              value === opt
                ? "bg-surface shadow-sm text-ink font-medium"
                : "text-ink-3 hover:text-ink-2"
            )}
          >
            {labels ? labels[i] : opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({
  label,
  value,
  onChange,
  indent = false,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={clsx(
        "flex items-center gap-2 cursor-pointer group",
        indent ? "pl-4" : ""
      )}
    >
      <div
        className={clsx(
          "w-8 h-4 rounded-full transition-colors shrink-0",
          value ? "bg-info" : "bg-surface-4"
        )}
      >
        <div
          className={clsx(
            "w-3.5 h-3.5 bg-surface rounded-full shadow transition-transform mt-0.25",
            value ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </div>
      <span
        className={clsx(
          "text-xs text-left",
          "text-ink-2",
          "group-hover:text-ink"
        )}
      >
        {label}
      </span>
    </button>
  );
}

export function Slider({
  label,
  min,
  max,
  value,
  valueLabel,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  valueLabel?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-ink-3">{label}</span>
        <span className="text-xs font-medium text-ink-2">
          {valueLabel ?? value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: "var(--color-ink)" }}
      />
    </div>
  );
}

export function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggle}
        className={clsx(
          "flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors",
          "text-ink-2",
          "hover:text-ink"
        )}
      >
        <IconChevronDown
          className={clsx(
            "size-2 transition-transform duration-150",
            open ? "" : "-rotate-90"
          )}
        />
        {title}
      </button>
      {open && <div className="flex flex-col gap-2 pl-1">{children}</div>}
    </div>
  );
}
