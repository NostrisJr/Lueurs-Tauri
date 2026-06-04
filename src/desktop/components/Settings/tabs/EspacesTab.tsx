import { useAtom, useAtomValue } from "jotai";
import { folderPathAtom, vaultConfigAtom } from "../../../../shared/lib/atoms";
import { type VaultSpace, writeVaultConfig } from "../../../../shared/lib/vaultConfig";
import { EmojiPicker } from "../EmojiPicker";

export function EspacesTab() {
  const folderPath = useAtomValue(folderPathAtom);
  const [vaultConfig, setVaultConfig] = useAtom(vaultConfigAtom);

  if (!vaultConfig) return <p className="text-sm text-gray-400">Aucun vault chargé.</p>;

  async function updateSpaces(spaces: VaultSpace[]) {
    if (!folderPath || !vaultConfig) return;
    const updated = { ...vaultConfig, spaces };
    await writeVaultConfig(folderPath, updated);
    setVaultConfig(updated);
  }

  function handleAddSpace() {
    updateSpaces([
      ...(vaultConfig?.spaces ?? []),
      { id: crypto.randomUUID(), name: "Nouvel espace" },
    ]);
  }

  function handleNameChange(index: number, name: string) {
    const spaces = [...(vaultConfig?.spaces ?? [])];
    spaces[index] = { ...spaces[index], name };
    updateSpaces(spaces);
  }

  function handleIconChange(index: number, icon: string) {
    const spaces = [...(vaultConfig?.spaces ?? [])];
    const updated = { ...spaces[index], icon: icon || undefined };
    if (!icon) updated.iconOnly = undefined;
    spaces[index] = updated;
    updateSpaces(spaces);
  }

  function handleColorChange(index: number, color: string) {
    const spaces = [...(vaultConfig?.spaces ?? [])];
    spaces[index] = { ...spaces[index], color: color || undefined };
    updateSpaces(spaces);
  }

  function handleIconOnlyChange(index: number, iconOnly: boolean) {
    const spaces = [...(vaultConfig?.spaces ?? [])];
    spaces[index] = { ...spaces[index], iconOnly: iconOnly || undefined };
    updateSpaces(spaces);
  }

  function handleDelete(index: number) {
    updateSpaces((vaultConfig?.spaces ?? []).filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {vaultConfig.spaces.map((space, i) => (
        <div key={space.id} className="space-y-1">
          <div className="flex items-center gap-2">
            <EmojiPicker value={space.icon} onChange={(emoji) => handleIconChange(i, emoji)} />
            <div className="flex items-center gap-1 shrink-0">
              <label
                className="relative cursor-pointer group"
                title="Couleur de l'espace"
                aria-label="Couleur de l'espace"
              >
                <span
                  className="block w-[34px] h-[34px] rounded-md border-2 border-white shadow ring-1 ring-gray-200 group-hover:ring-gray-400 transition-all"
                  style={{
                    background: space.color
                      ? `linear-gradient(135deg, ${space.color}, ${space.color}99)`
                      : "linear-gradient(135deg, #e5e7eb, #d1d5db)",
                  }}
                />
                <input
                  type="color"
                  value={space.color ?? "#6366f1"}
                  onChange={(e) => handleColorChange(i, e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </label>
              {space.color && (
                <button
                  type="button"
                  onClick={() => handleColorChange(i, "")}
                  title="Pas de couleur"
                  aria-label="Supprimer la couleur"
                  className="w-5 h-5 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer text-base leading-none"
                >
                  ×
                </button>
              )}
            </div>
            <input
              type="text"
              value={space.name}
              onChange={(e) => handleNameChange(i, e.target.value)}
              className="flex-1 text-sm border border-gray-200 rounded-md px-2.5 py-1.5 outline-none focus:border-gray-400"
              placeholder="Nom de l'espace"
              aria-label="Nom de l'espace"
            />
            <button
              type="button"
              onClick={() => handleDelete(i)}
              className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none cursor-pointer px-1"
              aria-label="Supprimer l'espace"
            >
              ×
            </button>
          </div>
          {space.icon && (
            <label className="flex items-center gap-2 pl-1 cursor-pointer">
              <input
                type="checkbox"
                checked={!!space.iconOnly}
                onChange={(e) => handleIconOnlyChange(i, e.target.checked)}
                className="rounded accent-gray-800 cursor-pointer"
              />
              <span className="text-xs text-gray-500">Afficher l'icône uniquement</span>
            </label>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={handleAddSpace}
        disabled={!folderPath}
        className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 transition-colors cursor-pointer"
      >
        + Ajouter un espace
      </button>
      <p className="text-xs text-gray-400">
        Taguez vos notes avec{" "}
        <code className="font-mono bg-gray-100 px-1 rounded">__space__</code>{" "}
        pour les associer à un espace.
      </p>
    </div>
  );
}
