// Menu contextuel natif au clic droit sur un nœud du file tree.
// Items : Révéler dans le Finder / Importer / — / Espaces (si applicable) / — / Mettre à la poubelle
// La destination de l'import dépend du nœud : dossier → le dossier lui-même,
// note ou média → le dossier parent.
//
// La suppression passe par handleDeleteNote / handleDeleteFolder (même chemin
// que le bouton 🗑️ du file tree) : onglets, navigation, cleanupNoteFromBases,
// writingPathsRegistry et mise à jour optimiste de l'arbre sont tous gérés.

import { invoke } from "@tauri-apps/api/core";
import {
  CheckMenuItem,
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu";
import { Command } from "@tauri-apps/plugin-shell";
import { useStore } from "jotai";
import { useCallback, useRef } from "react";
import type { FolderNode, NoteFile } from "../../shared/hooks/useFileTree";
import type { TreeNode } from "../../shared/hooks/useFileTree";
import { useNote } from "../../shared/hooks/useNote";
import {
  notesByIdAtom,
  treeAtom,
  vaultConfigAtom,
  writingPathsRegistry,
} from "../../shared/lib/atoms";
import {
  serializeFrontmatter,
  toArray,
  updateNodeInTree,
} from "../../shared/lib/fileTreeHelpers";
import { importPaths } from "../../shared/lib/importUtils";
import { createLogger } from "../../shared/lib/logger";
import { SystemField } from "../../shared/lib/noteTypes";
import { vaultIO } from "../../shared/lib/vaultIO";

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

function findFolderNote(tree: TreeNode[], folderId: string): NoteFile | null {
  const folder = findFolderById(tree, folderId);
  if (!folder) return null;
  return (
    folder.children.find(
      (c): c is NoteFile => c.kind === "file" && c.name === folder.name
    ) ?? null
  );
}

async function toggleNoteSpace(
  store: ReturnType<typeof useStore>,
  note: NoteFile,
  spaceName: string
): Promise<void> {
  const current = toArray(note.frontmatter[SystemField.SPACE]);
  const updated = current.includes(spaceName)
    ? current.filter((s) => s !== spaceName)
    : [...current, spaceName];

  const newFrontmatter = { ...note.frontmatter };
  if (updated.length > 0) {
    newFrontmatter[SystemField.SPACE] = updated;
  } else {
    delete newFrontmatter[SystemField.SPACE];
  }

  const raw = serializeFrontmatter(newFrontmatter, note.body);
  writingPathsRegistry.add(note.id);
  try {
    await vaultIO.writeFile(note.id, raw);
    store.set(treeAtom, (prev) =>
      updateNodeInTree(prev, note.id, { frontmatter: newFrontmatter })
    );
    log.info("espace togglé sur note", {
      noteId: note.id,
      spaceName,
      action: current.includes(spaceName) ? "retiré" : "ajouté",
    });
  } finally {
    writingPathsRegistry.delete(note.id);
  }
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
            log.info("import contextuel terminé", {
              count: paths.length,
              targetFolderPath,
            });
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
              const folderNode = findFolderById(store.get(treeAtom), nodeId);
              if (folderNode) {
                await cbRef.current.handleDeleteFolder(folderNode);
              }
            } else {
              await cbRef.current.handleDeleteNote(nodeId);
            }
            log.info("nœud supprimé via menu contextuel", { nodeId, nodeKind });
          } catch (err) {
            log.error("suppression via menu contextuel échouée", err);
          }
        },
      });

      // ── Sous-menu espaces (notes et dossiers uniquement) ───────────────────
      const spacesItems: (typeof sep)[] = [];

      if (nodeKind !== "media") {
        const spaces = store.get(vaultConfigAtom)?.spaces ?? [];

        if (spaces.length > 0) {
          // Résout la note cible : note directe ou note-dossier
          const targetNote: NoteFile | null =
            nodeKind === "file"
              ? (store.get(notesByIdAtom).get(nodeId) ?? null)
              : findFolderNote(store.get(treeAtom), nodeId);

          if (targetNote) {
            const currentSpaces = toArray(
              targetNote.frontmatter[SystemField.SPACE]
            );

            const spaceCheckItems = await Promise.all(
              spaces.map((space) =>
                CheckMenuItem.new({
                  text: space.icon
                    ? `${space.icon}  ${space.name}`
                    : space.name,
                  checked: currentSpaces.includes(space.name),
                  action: async () => {
                    // Relit la note depuis le store pour avoir la version la plus récente
                    const freshNote =
                      nodeKind === "file"
                        ? (store.get(notesByIdAtom).get(nodeId) ?? targetNote)
                        : (findFolderNote(store.get(treeAtom), nodeId) ??
                          targetNote);
                    await toggleNoteSpace(store, freshNote, space.name);
                  },
                })
              )
            );

            const spacesSubmenu = await Submenu.new({
              text: "Espaces",
              items: spaceCheckItems,
            });

            const sepSpaces = await PredefinedMenuItem.new({
              item: "Separator",
            });
            spacesItems.push(sepSpaces, spacesSubmenu as unknown as typeof sep);
          }
        }
      }

      const menu = await Menu.new({
        items: [revealItem, importItem, ...spacesItems, sep, trashItem],
      });
      await menu.popup();
    },
    [store]
  );

  return showContextMenu;
}
