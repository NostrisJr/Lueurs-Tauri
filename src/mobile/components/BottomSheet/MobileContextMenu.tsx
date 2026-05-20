import { openPath } from "@tauri-apps/plugin-opener";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import type { TreeNode } from "../../../shared/hooks/useFileTree";
import { useNote } from "../../../shared/hooks/useNote";
import {
  folderPathAtom,
  mobileContextMenuAtom,
} from "../../../shared/lib/atoms";
import { createLogger } from "../../../shared/lib/logger";
import { hapticImpact } from "../../lib/haptics";
import { BottomSheet } from "./BottomSheet";

const log = createLogger("MobileContextMenu");

type Step = "menu" | "rename";

export function MobileContextMenu() {
  const [target, setTarget] = useAtom(mobileContextMenuAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const { handleRename, handleDeleteNote, handleDeleteFolder } = useNote();

  const [step, setStep] = useState<Step>("menu");
  const [renameValue, setRenameValue] = useState("");

  if (!target) return null;

  function close() {
    setTarget(null);
    setStep("menu");
    setRenameValue("");
  }

  async function handleAction(idx: number) {
    if (!target) return;
    switch (idx) {
      case 0:
        setRenameValue(target.name);
        setStep("rename");
        break;
      case 1:
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
        break;
      case 2:
        if (folderPath) {
          const prefix = folderPath.endsWith("/")
            ? folderPath
            : `${folderPath}/`;
          const abs = `${prefix}${target.id}`;
          const parent = abs.substring(0, abs.lastIndexOf("/"));
          await openPath(parent).catch((err) =>
            log.error("impossible d'ouvrir dans les Fichiers", err)
          );
        }
        close();
        break;
      case 3:
        if (folderPath && navigator.share) {
          const prefix = folderPath.endsWith("/")
            ? folderPath
            : `${folderPath}/`;
          const abs = `${prefix}${target.id}`;
          await navigator
            .share({ title: target.name, text: abs })
            .catch(() => {});
        }
        close();
        break;
    }
  }

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

  const actions = [
    "Renommer",
    "Supprimer",
    "Afficher dans les Fichiers",
    "Partager",
  ] as const;

  return (
    <BottomSheet onClose={close} title={target.name}>
      <div className="flex flex-col divide-y divide-gray-100">
        {actions.map((label, idx) => (
          <button
            key={label}
            type="button"
            onClick={() => handleAction(idx)}
            className={`w-full px-4 py-4 text-left text-base active:bg-gray-50 transition-colors ${
              idx === 1 ? "text-red-500" : "text-gray-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
