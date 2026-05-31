import { open as openFilePicker } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import type { TreeNode } from "../../../shared/hooks/useFileTree";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import { useNote } from "../../../shared/hooks/useNote";
import {
  folderPathAtom,
  mobileContextMenuAtom,
} from "../../../shared/lib/atoms";
import { importPaths } from "../../../shared/lib/importUtils";
import { createLogger } from "../../../shared/lib/logger";
import { hapticImpact } from "../../lib/haptics";
import { BottomSheet } from "./BottomSheet";

const log = createLogger("MobileContextMenu");

type Step = "menu" | "rename";

export function MobileContextMenu() {
  const [target, setTarget] = useAtom(mobileContextMenuAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const { handleRename, handleDeleteNote, handleDeleteFolder } = useNote();
  const { reload } = useFileTree();

  const [step, setStep] = useState<Step>("menu");
  const [renameValue, setRenameValue] = useState("");

  if (!target) return null;

  function close() {
    setTarget(null);
    setStep("menu");
    setRenameValue("");
  }

  // Dossier cible pour l'import : le dossier lui-même, ou le parent de la note
  const importTargetPath = target.isFolder
    ? target.id
    : target.id.split("/").slice(0, -1).join("/");

  interface Action {
    label: string;
    destructive?: boolean;
    onPress: () => void | Promise<void>;
  }

  const actions: Action[] = [
    {
      label: "Renommer",
      onPress: () => {
        setRenameValue(target.name);
        setStep("rename");
      },
    },
    {
      label: "Importer des fichiers…",
      onPress: async () => {
        close();
        try {
          const selected = await openFilePicker({ multiple: true });
          if (!selected) return;
          const paths = Array.isArray(selected) ? selected : [selected];
          await importPaths(importTargetPath, paths);
          reload();
          log.info("import mobile terminé", { count: paths.length, importTargetPath });
        } catch (err) {
          log.error("import mobile échoué", err);
        }
      },
    },
    {
      label: "Afficher dans les Fichiers",
      onPress: async () => {
        if (folderPath) {
          const prefix = folderPath.endsWith("/") ? folderPath : `${folderPath}/`;
          const abs = `${prefix}${target.id}`;
          const parent = abs.substring(0, abs.lastIndexOf("/"));
          await openPath(parent).catch((err) =>
            log.error("impossible d'ouvrir dans les Fichiers", err)
          );
        }
        close();
      },
    },
    {
      label: "Partager",
      onPress: async () => {
        if (folderPath && navigator.share) {
          const prefix = folderPath.endsWith("/") ? folderPath : `${folderPath}/`;
          const abs = `${prefix}${target.id}`;
          await navigator.share({ title: target.name, text: abs }).catch(() => {});
        }
        close();
      },
    },
    {
      label: "Supprimer",
      destructive: true,
      onPress: async () => {
        hapticImpact("medium");
        log.info("delete", { id: target.id, isFolder: target.isFolder });
        if (target.isFolder) {
          const node: TreeNode = {
            kind: "folder",
            id: target.id,
            name: target.name,
            children: [],
          };
          await handleDeleteFolder(node);
        } else {
          await handleDeleteNote(target.id);
        }
        close();
      },
    },
  ];

  async function handleRenameConfirm() {
    if (!target || !renameValue.trim() || renameValue === target.name) {
      close();
      return;
    }
    log.info("rename", { id: target.id, newName: renameValue });
    await handleRename(target.id, renameValue.trim(), target.isFolder);
    close();
  }

  if (step === "rename") {
    return (
      <BottomSheet
        onClose={close}
        title={target.isFolder ? "Renommer le dossier" : "Renommer la note"}
      >
        <div className="px-2 pt-2 flex flex-col gap-4">
          <input
            // biome-ignore lint/a11y/noAutofocus: focus intentionnel à l'ouverture du rename
            autoFocus
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameConfirm();
              if (e.key === "Escape") close();
            }}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base text-gray-900 bg-gray-50 focus:outline-none focus:border-amber-400"
            placeholder={target.name}
          />
          <button
            type="button"
            onClick={handleRenameConfirm}
            className="w-full py-3.5 rounded-xl bg-amber-500 text-white font-semibold text-base active:bg-amber-600 transition-colors"
          >
            Renommer
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onClose={close} title={target.name}>
      <div className="flex flex-col divide-y divide-gray-100">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onPress}
            className={`w-full px-4 py-4 text-left text-base active:bg-gray-50 transition-colors ${
              action.destructive ? "text-red-500" : "text-gray-900"
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
