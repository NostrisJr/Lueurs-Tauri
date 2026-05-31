// Menu contextuel natif au clic droit sur un nœud du file tree.
// Items : Révéler dans le Finder / Importer / — / Mettre à la poubelle
// La destination de l'import dépend du nœud : dossier → le dossier lui-même,
// note ou média → le dossier parent.
//
// La suppression passe par handleDeleteNote / handleDeleteFolder (même chemin
// que le bouton 🗑️ du file tree) : onglets, navigation, cleanupNoteFromBases,
// writingPathsRegistry et mise à jour optimiste de l'arbre sont tous gérés.

import { invoke } from "@tauri-apps/api/core";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { Command } from "@tauri-apps/plugin-shell";
import { useStore } from "jotai";
import { useCallback, useRef } from "react";
import type { FolderNode } from "../../shared/hooks/useFileTree";
import { useNote } from "../../shared/hooks/useNote";
import { treeAtom } from "../../shared/lib/atoms";
import { createLogger } from "../../shared/lib/logger";
import { importPaths } from "../../shared/lib/importUtils";
import type { TreeNode } from "../../shared/hooks/useFileTree";

const log = createLogger("useNodeContextMenu");

export type NodeKind = "file" | "folder" | "media";

function findFolderById(nodes: TreeNode[], id: string): FolderNode | null {
  for (const node of nodes) {
    if (node.kind === "folder") {
      if (node.id === id) return node;
      const found = findFolderById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function useNodeContextMenu() {
  const store = useStore();
  const { handleDeleteNote, handleDeleteFolder } = useNote();

  const cbRef = useRef({ handleDeleteNote, handleDeleteFolder });
  cbRef.current = { handleDeleteNote, handleDeleteFolder };

  const showContextMenu = useCallback(
    async (nodeId: string, nodeKind: NodeKind) => {
      const targetFolderPath =
        nodeKind === "folder"
          ? nodeId
          : nodeId.split("/").slice(0, -1).join("/");

      const escaped = nodeId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

      const revealItem = await MenuItem.new({
        text: "Révéler dans le Finder",
        action: async () => {
          try {
            await Command.create("osascript", [
              "-e",
              `tell application "Finder" to reveal POSIX file "${escaped}"`,
              "-e",
              'tell application "Finder" to activate',
            ]).execute();
          } catch (err) {
            log.error("révélation Finder échouée", err);
          }
        },
      });

      const importItem = await MenuItem.new({
        text: "Importer des fichiers ou dossiers…",
        action: async () => {
          try {
            const paths = await invoke<string[]>("open_import_picker");
            if (!paths.length) return;
            await importPaths(targetFolderPath, paths);
            // reload déclenché automatiquement par le watcher FS après écriture
            log.info("import contextuel terminé", { count: paths.length, targetFolderPath });
          } catch (err) {
            log.error("import contextuel échoué", err);
          }
        },
      });

      const sep = await PredefinedMenuItem.new({ item: "Separator" });

      const trashItem = await MenuItem.new({
        text: "Mettre à la poubelle",
        action: async () => {
          try {
            if (nodeKind === "folder") {
              // Même chemin que le bouton 🗑️ : confirmation si non vide, nettoyage bases
              const folderNode = findFolderById(store.get(treeAtom), nodeId);
              if (folderNode) {
                await cbRef.current.handleDeleteFolder(folderNode);
              }
            } else {
              // Même chemin que le bouton 🗑️ : tabs, navigation, cleanupNoteFromBases
              await cbRef.current.handleDeleteNote(nodeId);
            }
            log.info("nœud supprimé via menu contextuel", { nodeId, nodeKind });
          } catch (err) {
            log.error("suppression via menu contextuel échouée", err);
          }
        },
      });

      const menu = await Menu.new({
        items: [revealItem, importItem, sep, trashItem],
      });
      await menu.popup();
    },
    [store]
  );

  return showContextMenu;
}
