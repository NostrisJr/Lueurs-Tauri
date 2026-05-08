import { useEffect, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import {
  settingsOpenAtom,
  folderPathAtom,
  defaultDisplayModeAtom,
} from "../../../shared/lib/Atoms";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { DISPLAY_MODES } from "../../../shared/lib/displayModes";

export function SettingsModal() {
  const [open, setOpen] = useAtom(settingsOpenAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const [defaultDisplayMode, setDefaultDisplayMode] = useAtom(
    defaultDisplayModeAtom
  );
  const { pickFolder, switchVault } = useFileTree();

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
                {DISPLAY_MODES.map(({ value, icon, label }) => (
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
                    <SFIcon
                      icon={icon}
                      className="size-3.5"
                      aria-hidden="true"
                    />
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                Appliqué aux nouvelles notes et aux notes sans mode défini.
              </p>
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
