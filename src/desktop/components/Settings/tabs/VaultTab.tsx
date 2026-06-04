import { invoke } from "@tauri-apps/api/core";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useFileTree } from "../../../../shared/hooks/useFileTree";
import {
  folderPathAtom,
  settingsOpenAtom,
  showResourcesAtom,
  treeAtom,
} from "../../../../shared/lib/atoms";
import { flattenTree } from "../../../../shared/lib/fileTreeHelpers";
import { vaultIO } from "../../../../shared/lib/vaultIO";

type CleanStatus = null | "running" | { count: number } | "error";

export function VaultTab() {
  const folderPath = useAtomValue(folderPathAtom);
  const [showResources, setShowResources] = useAtom(showResourcesAtom);
  const tree = useAtomValue(treeAtom);
  const [, setOpen] = useAtom(settingsOpenAtom);
  const { pickFolder, switchVault, reload } = useFileTree();

  const [cleanStatus, setCleanStatus] = useState<CleanStatus>(null);
  const [icloudPath, setIcloudPath] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    invoke<string | null>("get_icloud_path_macos").then(setIcloudPath);
  }, []);

  const icloudAvailable = typeof icloudPath === "string";
  const icloudAlreadyActive = icloudAvailable && folderPath === icloudPath;

  async function handleCleanResources() {
    if (!folderPath) return;
    setCleanStatus("running");
    try {
      const notes = flattenTree(tree);
      const referenced = new Set<string>();
      const RE = /resources\/(?:images|audio)\/([^)\s"'\]\\]+)/g;
      for (const note of notes) {
        for (const m of note.body.matchAll(RE)) referenced.add(m[1]);
      }
      let count = 0;
      for (const sub of ["images", "audio"] as const) {
        try {
          const entries = await vaultIO.readDir(`${folderPath}/resources/${sub}`);
          for (const e of entries) {
            if (!e.isDir && !referenced.has(e.name)) {
              await vaultIO.delete(e.uri);
              count++;
            }
          }
        } catch {
          /* dossier absent */
        }
      }
      setCleanStatus({ count });
    } catch {
      setCleanStatus("error");
    }
  }

  async function handleUseIcloud() {
    if (!icloudPath) return;
    await switchVault(icloudPath);
    setOpen(false);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
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

      <div className="space-y-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={showResources}
            onChange={() => {
              setShowResources((v) => !v);
              reload();
            }}
            className="rounded accent-gray-800 cursor-pointer"
          />
          <span className="text-sm text-gray-700">Afficher les ressources dans le vault</span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCleanResources}
            disabled={cleanStatus === "running" || !folderPath}
            className="px-3 py-2 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-default transition-colors cursor-pointer"
          >
            {cleanStatus === "running" ? "Nettoyage…" : "Nettoyer les ressources"}
          </button>
          {cleanStatus !== null && cleanStatus !== "running" && (
            <span className="text-xs text-gray-500">
              {cleanStatus === "error"
                ? "Erreur lors du nettoyage"
                : cleanStatus.count === 0
                  ? "Rien à nettoyer"
                  : `${cleanStatus.count} fichier${cleanStatus.count > 1 ? "s" : ""} supprimé${cleanStatus.count > 1 ? "s" : ""}`}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className={`text-xs ${icloudAvailable ? "text-gray-500" : "text-gray-300"}`}>
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
  );
}
