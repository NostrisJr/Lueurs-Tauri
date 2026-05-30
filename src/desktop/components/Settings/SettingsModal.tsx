import { invoke } from "@tauri-apps/api/core";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import {
  defaultDisplayModeAtom,
  defaultHighlightColorAtom,
  documentMapDistinguishedTypesAtom,
  documentMapShowListsAtom,
  documentMapShowNavigatorAtom,
  documentMapShowTextAtom,
  folderPathAtom,
  settingsOpenAtom,
  textJustificationAtom,
} from "../../../shared/lib/atoms";
import { DISPLAY_MODES } from "../../../shared/lib/displayModes";
import {
  ALL_MAP_BLOCK_TYPES,
  BLOCK_TYPE_COLORS,
  BLOCK_TYPE_LABELS,
} from "../../../shared/lib/documentMapConfig";
import { HIGHLIGHT_COLORS } from "../../../shared/plugins/highlight/colors";

export function SettingsModal() {
  const [open, setOpen] = useAtom(settingsOpenAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const [defaultDisplayMode, setDefaultDisplayMode] = useAtom(
    defaultDisplayModeAtom
  );
  const [defaultHighlightColor, setDefaultHighlightColor] = useAtom(
    defaultHighlightColorAtom
  );
  const [textJustification, setTextJustification] = useAtom(
    textJustificationAtom
  );
  const [distinguishedTypes, setDistinguishedTypes] = useAtom(
    documentMapDistinguishedTypesAtom
  );
  const [showNavigator, setShowNavigator] = useAtom(
    documentMapShowNavigatorAtom
  );
  const [showLists, setShowLists] = useAtom(documentMapShowListsAtom);
  const [showText, setShowText] = useAtom(documentMapShowTextAtom);
  const { pickFolder, switchVault } = useFileTree();

  function toggleBlockType(type: string) {
    setDistinguishedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  // null = absent, undefined = en cours de vérification, string = chemin trouvé
  const [icloudPath, setIcloudPath] = useState<string | null | undefined>(
    undefined
  );

  useEffect(() => {
    invoke<string | null>("get_icloud_path_macos").then(setIcloudPath);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const icloudAvailable = typeof icloudPath === "string";
  const icloudAlreadyActive = icloudAvailable && folderPath === icloudPath;

  async function handleUseIcloud() {
    if (!icloudPath) return;
    await switchVault(icloudPath);
    setOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/20"
      onClick={() => setOpen(false)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[480px] max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Paramètres</h2>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Mode de lecture par défaut */}
          <section>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              Éditeur
            </h3>
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">
                Mode de lecture par défaut
              </p>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                {DISPLAY_MODES.map(({ value, Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDefaultDisplayMode(value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all cursor-default ${
                      defaultDisplayMode === value
                        ? "bg-white shadow-sm text-gray-800 font-medium"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                Appliqué aux nouvelles notes et aux notes sans mode défini.
              </p>
            </div>

            {/* Justification du texte en mode livre */}
            <div className="space-y-1.5 pt-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={textJustification}
                  onChange={() => setTextJustification((v) => !v)}
                  className="rounded accent-gray-800 cursor-pointer"
                />
                <span className="text-sm text-gray-700">
                  Justifier le texte en mode livre
                </span>
              </label>
            </div>

            {/* Couleur de surlignage par défaut */}
            <div className="space-y-1.5 pt-3">
              <p className="text-xs text-gray-500">
                Couleur de surlignage par défaut (raccourci ⌘⇧L)
              </p>
              <div className="flex gap-2 flex-wrap">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.label}
                    onClick={() => setDefaultHighlightColor(c.id)}
                    className="relative w-6 h-6 rounded-full border-2 transition-all cursor-default"
                    style={{
                      background: c.solid,
                      borderColor:
                        defaultHighlightColor === c.id
                          ? "#374151"
                          : "transparent",
                      transform:
                        defaultHighlightColor === c.id ? "scale(1.15)" : "",
                    }}
                  >
                    {defaultHighlightColor === c.id && (
                      <span className="absolute inset-0 flex items-center justify-center text-white text-[9px] font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Navigateur de hiérarchie */}
          <section>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              Navigateur
            </h3>
            <div className="space-y-3">
              {/* Visibilité globale */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showNavigator}
                  onChange={() => setShowNavigator((v) => !v)}
                  className="rounded accent-gray-800 cursor-pointer"
                />
                <span className="text-sm text-gray-700">
                  Afficher le navigateur
                </span>
              </label>

              {showNavigator && (
                <>
                  {/* Affichage des blocs génériques */}
                  <div className="space-y-1.5 pl-1">
                    <p className="text-xs text-gray-400">Contenu général</p>
                    <div className="space-y-2 pt-0.5">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showLists}
                          onChange={() => setShowLists((v) => !v)}
                          className="rounded accent-gray-800 cursor-pointer"
                        />
                        <span className="text-sm text-gray-700">
                          Listes &amp; to-do
                        </span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showText}
                          onChange={() => setShowText((v) => !v)}
                          className="rounded accent-gray-800 cursor-pointer"
                        />
                        <span className="text-sm text-gray-700">Texte</span>
                      </label>
                    </div>
                  </div>

                  {/* Types de blocs distingués */}
                  <div className="space-y-1.5 pl-1">
                    <p className="text-xs text-gray-400">
                      Blocs à distinguer (les autres comptent comme du texte)
                    </p>
                    <div className="space-y-2 pt-0.5">
                      {ALL_MAP_BLOCK_TYPES.map((type) => (
                        <label
                          key={type}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={distinguishedTypes.includes(type)}
                            onChange={() => toggleBlockType(type)}
                            className="rounded accent-gray-800 cursor-pointer"
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: BLOCK_TYPE_COLORS[type] }}
                          />
                          <span className="text-sm text-gray-700">
                            {BLOCK_TYPE_LABELS[type]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              Vault
            </h3>
            <div className="space-y-3">
              {/* Dossier courant */}
              <div className="space-y-1.5">
                <p className="text-xs text-gray-500">Dossier racine</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 text-sm text-gray-700 font-mono bg-gray-50 rounded-md px-3 py-2 truncate">
                    {folderPath ?? "–"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      pickFolder();
                      setOpen(false);
                    }}
                    className="px-3 py-2 text-xs font-medium rounded-md bg-gray-900 text-white hover:bg-gray-700 transition-colors cursor-pointer shrink-0"
                  >
                    Changer
                  </button>
                </div>
              </div>

              {/* Option iCloud */}
              <div className="space-y-1.5">
                <p
                  className={`text-xs ${icloudAvailable ? "text-gray-500" : "text-gray-300"}`}
                >
                  Vault iCloud (partagé avec l'app iOS)
                </p>
                {icloudAvailable ? (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-sm text-gray-500 font-mono bg-gray-50 rounded-md px-3 py-2 truncate">
                      {icloudPath}
                    </span>
                    <button
                      type="button"
                      onClick={handleUseIcloud}
                      disabled={icloudAlreadyActive}
                      className={`px-3 py-2 text-xs font-medium rounded-md shrink-0 transition-colors ${
                        icloudAlreadyActive
                          ? "bg-gray-100 text-gray-400 cursor-default"
                          : "bg-blue-600 text-white hover:bg-blue-500 cursor-pointer"
                      }`}
                    >
                      {icloudAlreadyActive ? "Vault actif" : "Utiliser"}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2">
                    <span className="flex-1 text-xs text-gray-400">
                      {icloudPath === undefined
                        ? "Vérification…"
                        : "Installez et lancez l'app iOS Lueurs pour activer cette option"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
