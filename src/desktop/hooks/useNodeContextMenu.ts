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
import { useNote } from "../../shared/hooks/useNote";
import {
  notesByIdAtom,
  treeAtom,
  vaultConfigAtom,
} from "../../shared/lib/atoms";
import { toArray } from "../../shared/lib/fileTreeHelpers";
import { importPaths } from "../../shared/lib/importUtils";
import { createLogger } from "../../shared/lib/logger";
import { SystemField, isNoteReadOnly } from "../../shared/lib/noteTypes";
import {
  type NodeKind,
  findFolderById,
  resolveTargetNote,
  toggleNoteReadOnly,
  toggleNoteSpace,
} from "../../shared/lib/spaceAssignment";

const log = createLogger("useNodeContextMenu");

export type { NodeKind };

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

      // ── Espaces + lecture seule (notes et dossiers uniquement) ─────────────
      const spacesItems: (typeof sep)[] = [];

      // Ajoute un item précédé de son séparateur (les deux IPC natifs n'ayant
      // pas de dépendance entre eux, ils sont créés en parallèle).
      async function pushSection(itemPromise: Promise<unknown>) {
        const [sepItem, resolvedItem] = await Promise.all([
          PredefinedMenuItem.new({ item: "Separator" }),
          itemPromise,
        ]);
        spacesItems.push(sepItem, resolvedItem as typeof sep);
      }

      const targetNote = resolveTargetNote(
        store.get(treeAtom),
        store.get(notesByIdAtom),
        nodeId,
        nodeKind
      );

      if (targetNote) {
        const freshTargetNote = () =>
          resolveTargetNote(
            store.get(treeAtom),
            store.get(notesByIdAtom),
            nodeId,
            nodeKind
          ) ?? targetNote;

        const spaces = store.get(vaultConfigAtom)?.spaces ?? [];
        if (spaces.length > 0) {
          const currentSpaces = toArray(
            targetNote.frontmatter[SystemField.SPACE]
          );

          const spaceCheckItems = await Promise.all(
            spaces.map((space) =>
              CheckMenuItem.new({
                text: space.icon ? `${space.icon}  ${space.name}` : space.name,
                checked: currentSpaces.includes(space.name),
                action: async () => {
                  await toggleNoteSpace(store, freshTargetNote(), space.name);
                },
              })
            )
          );

          await pushSection(
            Submenu.new({ text: "Espaces", items: spaceCheckItems })
          );
        }

        await pushSection(
          CheckMenuItem.new({
            text: "Lecture seule",
            checked: isNoteReadOnly(targetNote.frontmatter),
            action: async () => {
              await toggleNoteReadOnly(store, freshTargetNote());
            },
          })
        );
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
