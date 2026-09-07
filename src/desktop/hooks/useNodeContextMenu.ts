// Menu contextuel natif au clic droit sur un nœud du file tree.
// Items : Révéler dans le Finder / Importer / — / Espaces (si applicable) / — / Mettre à la poubelle
// La destination de l'import dépend du nœud : dossier → le dossier lui-même,
// note ou média → le dossier parent.
//
// La suppression passe par handleDeleteNote / handleDeleteFolder (même chemin
// que le bouton 🗑️ du file tree) : onglets, navigation, nettoyage des
// références (cf. useFileReferences), writingPathsRegistry et mise à jour
// optimiste de l'arbre sont tous gérés.

import { invoke } from "@tauri-apps/api/core";
import {
  CheckMenuItem,
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu";
import { save as saveFilePicker } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { Command } from "@tauri-apps/plugin-shell";
import { useStore } from "jotai";
import { useCallback, useRef } from "react";
import { useNote } from "../../shared/hooks/useNote";
import {
  fileRedoStackAtom,
  fileUndoStackAtom,
  folderPathAtom,
  infoAuteurAtom,
  notesByIdAtom,
  treeAtom,
  vaultConfigAtom,
} from "../../shared/lib/atoms";
import { resolveAndBuildBundle } from "../../shared/lib/bundle/bundleShare";
import { findNodeById, toArray } from "../../shared/lib/fileTreeHelpers";
import {
  redoLastFileAction,
  undoLastFileAction,
} from "../../shared/lib/fileTreeUndo";
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

      // Annuler/Rétablir la dernière opération du file tree (suppression,
      // renommage, déplacement) — global, pas spécifique au nœud cliqué :
      // c'est le seul menu associé au file tree sur desktop (pas de menu
      // "global" séparé comme le "..." mobile), d'où le libellé qui rappelle
      // l'action concernée plutôt qu'un simple "Annuler".
      const undoStack = store.get(fileUndoStackAtom);
      const redoStack = store.get(fileRedoStackAtom);
      const undoItem = await MenuItem.new({
        text:
          undoStack.length > 0
            ? `Annuler : ${undoStack[undoStack.length - 1].label}`
            : "Annuler",
        enabled: undoStack.length > 0,
        action: async () => {
          await undoLastFileAction(store);
        },
      });
      const redoItem = await MenuItem.new({
        text:
          redoStack.length > 0
            ? `Rétablir : ${redoStack[redoStack.length - 1].label}`
            : "Rétablir",
        enabled: redoStack.length > 0,
        action: async () => {
          await redoLastFileAction(store);
        },
      });
      const undoSep = await PredefinedMenuItem.new({ item: "Separator" });

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

      const shareItem = await MenuItem.new({
        text: "Partager…",
        action: async () => {
          const vaultPath = store.get(folderPathAtom);
          const node = findNodeById(store.get(treeAtom), nodeId);
          if (!vaultPath || !node) return;
          try {
            const result = await resolveAndBuildBundle(
              store,
              node,
              vaultPath,
              store.get(infoAuteurAtom),
              store.get(treeAtom)
            );
            if (!result) return; // annulé depuis le dialogue de résolution
            const dest = await saveFilePicker({
              defaultPath: result.suggestedFileName,
            });
            if (!dest) return;
            await writeFile(dest, result.bytes);
            log.info("bundle exporté via Partager", { nodeId, dest });
          } catch (err) {
            log.error("échec partage depuis le menu contextuel", {
              nodeId,
              err,
            });
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
        items: [
          undoItem,
          redoItem,
          undoSep,
          revealItem,
          importItem,
          shareItem,
          ...spacesItems,
          sep,
          trashItem,
        ],
      });
      await menu.popup();
    },
    [store]
  );

  return showContextMenu;
}
