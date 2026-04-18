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
      <div className="bg-white border border-gray-200 rounded-xl p-6 w-80 shadow-sm">
        <h2 className="font-title text-base font-semibold text-gray-800 mb-1">
          Configurer le Kanban
        </h2>
        <p className="font-body text-sm text-gray-500 mb-4">
          Choisissez la propriété utilisée pour grouper les cartes en colonnes.
        </p>
        <div className="flex flex-col gap-2">
          {availableKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className="text-left px-3 py-2 rounded-lg border border-gray-200 font-body text-sm text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              {key}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full text-center font-body text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
