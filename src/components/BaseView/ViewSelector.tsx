import { BaseViewEnum, type BaseViewType } from "../../lib/noteTypes";

interface Props {
  currentView: BaseViewType;
  kanbanAvailable: boolean;
  onChange: (view: BaseViewType) => void;
}

const VIEWS: { value: BaseViewType; label: string }[] = [
  { value: BaseViewEnum.TABLE, label: "Tableau" },
  { value: BaseViewEnum.KANBAN, label: "Kanban" },
];

export function ViewSelector({
  currentView,
  kanbanAvailable,
  onChange,
}: Props) {
  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
      {VIEWS.map(({ value, label }) => {
        const disabled = value === BaseViewEnum.KANBAN && !kanbanAvailable;
        const active = currentView === value;

        return (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(value)}
            title={
              disabled
                ? "Aucune propriété libre disponible pour le Kanban"
                : undefined
            }
            className={`px-3 py-1 rounded-md text-xs font-body transition-colors ${
              active
                ? "bg-white text-gray-800 shadow-sm"
                : disabled
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-500 hover:text-gray-700 cursor-pointer"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
