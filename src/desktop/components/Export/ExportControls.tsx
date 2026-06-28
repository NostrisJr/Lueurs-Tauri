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
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex gap-1 bg-gray-100 rounded-full p-0.5">
        {options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 text-xs py-0.5 rounded-full transition-all cursor-pointer ${
              value === opt
                ? "bg-white shadow-sm text-gray-900 font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
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
      className={`flex items-center gap-2 cursor-pointer group ${indent ? "pl-4" : ""}`}
    >
      <div
        className={`w-8 h-4 rounded-full transition-colors shrink-0 ${
          value ? "bg-blue-500" : "bg-gray-200"
        }`}
      >
        <div
          className={`w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mt-0.25 ${
            value ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
      <span className="text-xs text-gray-700 group-hover:text-gray-900 text-left">
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
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs font-medium text-gray-700">
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
        style={{ accentColor: "#1a1918" }}
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
        className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 cursor-pointer transition-colors"
      >
        <IconChevronDown
          className={`size-2 transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
        />
        {title}
      </button>
      {open && <div className="flex flex-col gap-2 pl-1">{children}</div>}
    </div>
  );
}
