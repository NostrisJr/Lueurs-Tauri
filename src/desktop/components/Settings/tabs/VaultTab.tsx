import { invoke } from "@tauri-apps/api/core";
import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useFileTree } from "../../../../shared/hooks/useFileTree";
import {
  MAILBOX_DEFAULT_FOLDER_NAME,
  type MailboxMode,
  allFoldersAtom,
  dictaphoneRelPathAtom,
  folderPathAtom,
  inboxRelPathAtom,
  mailboxCustomRelPathAtom,
  mailboxModeAtom,
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
  const [inboxRelPath, setInboxRelPath] = useAtom(inboxRelPathAtom);
  const [dictaphoneRelPath, setDictaphoneRelPath] = useAtom(
    dictaphoneRelPathAtom
  );
  const [mailboxMode, setMailboxMode] = useAtom(mailboxModeAtom);
  const [mailboxCustomRelPath, setMailboxCustomRelPath] = useAtom(
    mailboxCustomRelPathAtom
  );
  const allFolders = useAtomValue(allFoldersAtom);
  const tree = useAtomValue(treeAtom);
  const [, setOpen] = useAtom(settingsOpenAtom);
  const { pickFolder, switchVault, reload } = useFileTree();

  const [cleanStatus, setCleanStatus] = useState<CleanStatus>(null);
  const [icloudPath, setIcloudPath] = useState<string | null | undefined>(
    undefined
  );

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
          const entries = await vaultIO.readDir(
            `${folderPath}/resources/${sub}`
          );
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
        <p className="text-xs text-ink-3">Dossier racine</p>
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "flex-1 min-w-0 text-sm font-mono rounded-md px-3 py-2 truncate",
              "text-ink-2 bg-surface-2"
            )}
          >
            {folderPath ?? "–"}
          </span>
          <button
            type="button"
            onClick={() => {
              pickFolder();
              setOpen(false);
            }}
            className={clsx(
              "px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer shrink-0",
              "bg-inverse text-on-inverse",
              "hover:bg-inverse-2"
            )}
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
            className="rounded accent-ink cursor-pointer"
          />
          <span className="text-sm text-ink-2">
            Afficher les ressources dans le vault
          </span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCleanResources}
            disabled={cleanStatus === "running" || !folderPath}
            className={clsx(
              "px-3 py-2 text-xs font-medium rounded-md disabled:opacity-50 disabled:cursor-default transition-colors cursor-pointer",
              "bg-surface-3 text-ink-2",
              "hover:bg-surface-4"
            )}
          >
            {cleanStatus === "running"
              ? "Nettoyage…"
              : "Nettoyer les ressources"}
          </button>
          {cleanStatus !== null && cleanStatus !== "running" && (
            <span className="text-xs text-ink-3">
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
        <p
          className={clsx(
            "text-xs",
            icloudAvailable ? "text-ink-3" : "text-ink-5"
          )}
        >
          Vault iCloud (partagé avec l'app iOS)
        </p>
        {icloudAvailable ? (
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                "flex-1 min-w-0 text-sm font-mono rounded-md px-3 py-2 truncate",
                "text-ink-3 bg-surface-2"
              )}
            >
              {icloudPath}
            </span>
            <button
              type="button"
              onClick={handleUseIcloud}
              disabled={icloudAlreadyActive}
              className={clsx(
                "px-3 py-2 text-xs font-medium rounded-md shrink-0 transition-colors",
                icloudAlreadyActive
                  ? "bg-surface-3 text-ink-4 cursor-default"
                  : "bg-info text-on-inverse hover:bg-info cursor-pointer"
              )}
            >
              {icloudAlreadyActive ? "Vault actif" : "Utiliser"}
            </button>
          </div>
        ) : (
          <div
            className={clsx(
              "flex items-center gap-2 rounded-md px-3 py-2",
              "bg-surface-2"
            )}
          >
            <span className="flex-1 text-xs text-ink-4">
              {icloudPath === undefined
                ? "Vérification…"
                : "Installez et lancez l'app iOS Lueurs pour activer cette option"}
            </span>
          </div>
        )}
      </div>

      <FolderPickerRow
        label="Dossier inbox"
        description="Notes créées via le bouton + ou le raccourci clavier."
        folderPath={folderPath}
        allFolders={allFolders}
        value={inboxRelPath}
        onChange={setInboxRelPath}
      />

      <FolderPickerRow
        label="Dossier dictaphone"
        description="Notes créées depuis le Centre de contrôle ou le dictaphone."
        folderPath={folderPath}
        allFolders={allFolders}
        value={dictaphoneRelPath}
        onChange={setDictaphoneRelPath}
      />

      <div className="space-y-2">
        <p className="text-xs text-ink-3">Boîte aux lettres</p>
        <div className={clsx("flex gap-1 rounded-full p-0.75", "bg-surface-3")}>
          {(
            [
              ["recus", `Dossier "${MAILBOX_DEFAULT_FOLDER_NAME}"`],
              ["racine", "Racine du vault"],
              ["custom", "Personnalisé"],
            ] as [MailboxMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMailboxMode(mode)}
              className={clsx(
                "flex-1 px-2 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer",
                mailboxMode === mode
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-4 hover:bg-surface-4"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {mailboxMode === "custom" && (
          <select
            value={mailboxCustomRelPath ?? ""}
            onChange={(e) => setMailboxCustomRelPath(e.target.value || null)}
            className={clsx(
              "w-full text-sm rounded-md px-3 py-2 ring-1 focus:outline-none focus:ring-2 cursor-pointer",
              "text-ink-2 bg-surface-2 ring-line-2",
              "focus:ring-accent-2"
            )}
          >
            <option value="">Racine du vault</option>
            {allFolders.map((folder) => {
              const rel = folderPath
                ? folder.id.slice(folderPath.length + 1)
                : folder.id;
              return (
                <option key={folder.id} value={rel}>
                  {rel}
                </option>
              );
            })}
          </select>
        )}
        <p className="text-xs text-ink-4">
          Destination des notes, dossiers et médias reçus par bundle partagé
          (.lueurs), en local comme via l'association de fichier.
        </p>
      </div>
    </div>
  );
}

function FolderPickerRow({
  label,
  description,
  folderPath,
  allFolders,
  value,
  onChange,
}: {
  label: string;
  description: string;
  folderPath: string | null;
  allFolders: import("../../../../shared/hooks/useFileTree").FolderNode[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-3">{label}</p>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={clsx(
          "w-full text-sm rounded-md px-3 py-2 ring-1 focus:outline-none focus:ring-2 cursor-pointer",
          "text-ink-2 bg-surface-2 ring-line-2",
          "focus:ring-accent-2"
        )}
      >
        <option value="">Racine du vault</option>
        {allFolders.map((folder) => {
          const rel = folderPath
            ? folder.id.slice(folderPath.length + 1)
            : folder.id;
          return (
            <option key={folder.id} value={rel}>
              {rel}
            </option>
          );
        })}
      </select>
      <p className="text-xs text-ink-4">{description}</p>
    </div>
  );
}
