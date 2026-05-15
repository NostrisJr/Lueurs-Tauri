import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import type { TreeNode } from "../../../shared/hooks/useFileTree";
import { useNote } from "../../../shared/hooks/useNote";
import { folderPathAtom, mobileContextMenuAtom } from "../../../shared/lib/Atoms";
import { createLogger } from "../../../shared/lib/logger";
import { hapticImpact } from "../../lib/haptics";

const log = createLogger("MobileContextMenu");

const ACTIONS = [
  "Renommer",
  "Supprimer",
  "Afficher dans les Fichiers",
  "Partager",
] as const;

export function MobileContextMenu() {
  const [target, setTarget] = useAtom(mobileContextMenuAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const { handleRename, handleDeleteNote, handleDeleteFolder } = useNote();

  // activeRef empêche une double invocation si l'atom est mis à jour
  // (nouvelle référence objet) pendant que le menu est déjà affiché.
  const activeRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: seul target déclenche le menu ; les handlers sont stables
  useEffect(() => {
    if (!target || activeRef.current) return;
    activeRef.current = true;

    const t = target;

    async function show() {
      hapticImpact("light");

      const idx = await invoke<number>("show_action_sheet", {
        title: t.name,
        actions: [...ACTIONS],
      });

      if (idx !== -1) {
        switch (idx) {
          case 0: {
            const newName = await invoke<string | null>("show_rename_prompt", {
              title: t.isFolder ? "Renommer le dossier" : "Renommer la note",
              placeholder: t.name,
              current: t.name,
            });
            if (newName && newName !== t.name) {
              log.info("rename", { id: t.id, newName });
              await handleRename(t.id, newName, t.isFolder);
            }
            break;
          }
          case 1: {
            hapticImpact("medium");
            log.info("delete", { id: t.id, isFolder: t.isFolder });
            if (t.isFolder) {
              const node: TreeNode = {
                kind: "folder",
                id: t.id,
                name: t.name,
                children: [],
              };
              await handleDeleteFolder(node);
            } else {
              await handleDeleteNote(t.id);
            }
            break;
          }
          case 2: {
            if (folderPath) {
              const prefix = folderPath.endsWith("/")
                ? folderPath
                : `${folderPath}/`;
              const abs = `${prefix}${t.id}`;
              const parent = abs.substring(0, abs.lastIndexOf("/"));
              await openPath(parent).catch((err) =>
                log.error("impossible d'ouvrir dans les Fichiers", err)
              );
            }
            break;
          }
          case 3: {
            if (folderPath && navigator.share) {
              const prefix = folderPath.endsWith("/")
                ? folderPath
                : `${folderPath}/`;
              const abs = `${prefix}${t.id}`;
              await navigator
                .share({ title: t.name, text: abs })
                .catch(() => {});
            }
            break;
          }
        }
      }

      activeRef.current = false;
      setTarget(null);
    }

    show();
  }, [target]);

  return null;
}
