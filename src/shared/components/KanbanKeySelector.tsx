import clsx from "clsx";

interface Props {
  availableKeys: string[];
  onSelect: (key: string) => void;
  onCancel: () => void;
}

export function KanbanKeySelector({
  availableKeys,
  onSelect,
  onCancel,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      <div
        className={clsx(
          "rounded-xl p-6 w-80 shadow-sm border",
          "bg-surface border-line-2"
        )}
      >
        <h2
          className={clsx(
            "font-title text-base font-semibold mb-1",
            "text-ink"
          )}
        >
          Configurer le Kanban
        </h2>
        <p className={clsx("font-body text-sm mb-4", "text-ink-3")}>
          Choisissez la propriété utilisée pour grouper les cartes en colonnes.
        </p>
        <div className="flex flex-col gap-2">
          {availableKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={clsx(
                "text-left px-3 py-2 rounded-lg border font-body text-sm transition-colors",
                "border-line-2 text-ink-2 hover:border-line-3 hover:bg-surface-2"
              )}
            >
              {key}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className={clsx(
            "mt-4 w-full text-center font-body text-xs transition-colors",
            "text-ink-4 hover:text-ink-2"
          )}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
