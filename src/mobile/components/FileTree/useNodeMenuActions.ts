import { open as openFilePicker } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import {
  IconFolder,
  IconLock,
  IconLockOpen,
  IconPencil,
  IconSquareAndArrowDown,
  IconSquareAndArrowUp,
  IconTag,
  IconTrash,
} from "../../../shared/components/PlatformIcon";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import type { TreeNode } from "../../../shared/hooks/useFileTree";
import { useNote } from "../../../shared/hooks/useNote";
import {
  mobileContextMenuAtom,
  notesByIdAtom,
  treeAtom,
  vaultConfigAtom,
} from "../../../shared/lib/atoms";
import { importPaths } from "../../../shared/lib/importUtils";
import { createLogger } from "../../../shared/lib/logger";
import { isNoteReadOnly } from "../../../shared/lib/noteTypes";
import {
  resolveTargetNote,
  toggleNoteReadOnly,
} from "../../../shared/lib/spaceAssignment";
import { hapticImpact } from "../../lib/haptics";
import type { RowMenuAction } from "../Row";

const log = createLogger("useNodeMenuActions");

/**
 * Actions du menu contextuel d'une rangée du file tree.
 * Renommer et Espaces sont à deux temps : ils délèguent à la bottom sheet
 * (MobileContextMenu), les autres agissent directement.
 */
export function useNodeMenuActions() {
  const store = useStore();
  const vaultConfig = useAtomValue(vaultConfigAtom);
  const tree = useAtomValue(treeAtom);
  const notesById = useAtomValue(notesByIdAtom);
  const openSheet = useSetAtom(mobileContextMenuAtom);
  const { handleDeleteNote, handleDeleteMedia, handleDeleteFolder } = useNote();
  const { reload } = useFileTree();

  const hasSpaces = (vaultConfig?.spaces?.length ?? 0) > 0;

  // Pas de mémoïsation : les actions capturent le nœud, qui change à chaque
  // rechargement de l'arbre — une closure figée agirait sur un chemin périmé.
  return (
    node: TreeNode
  ): { primary: RowMenuAction[]; items: RowMenuAction[] } => {
    const isFolder = node.kind === "folder";
    const target = { id: node.id, name: node.name, isFolder };
    // Dossier cible pour l'import : le dossier lui-même, ou le parent de la note.
    const importTargetPath = isFolder
      ? node.id
      : node.id.split("/").slice(0, -1).join("/");

    // Note cible pour la lecture seule : note directe ou note-dossier (média exclu)
    const readOnlyTarget = resolveTargetNote(
      tree,
      notesById,
      node.id,
      node.kind
    );
    const readOnlyLocked = isNoteReadOnly(readOnlyTarget?.frontmatter);

    const primary: RowMenuAction[] = [
      ...(readOnlyLocked
        ? []
        : [
            {
              id: "rename",
              label: "Renommer",
              icon: IconPencil,
              onPress: () => openSheet({ ...target, step: "rename" }),
            },
          ]),
      ...(hasSpaces
        ? [
            {
              id: "spaces",
              label: "Espaces",
              icon: IconTag,
              onPress: () => openSheet({ ...target, step: "spaces" }),
            },
          ]
        : []),
      {
        id: "delete",
        label: "Supprimer",
        icon: IconTrash,
        destructive: true,
        onPress: async () => {
          hapticImpact("medium");
          log.info("suppression depuis le menu contextuel", { id: node.id });
          try {
            if (node.kind === "folder") await handleDeleteFolder(node);
            else if (node.kind === "media") await handleDeleteMedia(node.id);
            else await handleDeleteNote(node.id);
          } catch (err) {
            log.error("échec suppression", { id: node.id, err });
          }
        },
      },
    ];

    const items: RowMenuAction[] = [
      ...(readOnlyTarget
        ? [
            {
              id: "readonly",
              label: readOnlyLocked ? "Déverrouiller" : "Verrouiller",
              icon: readOnlyLocked ? IconLockOpen : IconLock,
              onPress: async () => {
                try {
                  await toggleNoteReadOnly(store, readOnlyTarget);
                  log.info("lecture seule togglée depuis le menu contextuel", {
                    id: node.id,
                  });
                } catch (err) {
                  log.error("échec toggle lecture seule", {
                    id: node.id,
                    err,
                  });
                }
              },
            },
          ]
        : []),
      {
        id: "import",
        label: "Importer des fichiers…",
        icon: IconSquareAndArrowDown,
        onPress: async () => {
          try {
            const selected = await openFilePicker({ multiple: true });
            if (!selected) return;
            const paths = Array.isArray(selected) ? selected : [selected];
            await importPaths(importTargetPath, paths);
            reload();
            log.info("import mobile terminé", {
              count: paths.length,
              importTargetPath,
            });
          } catch (err) {
            log.error("import mobile échoué", err);
          }
        },
      },
      {
        id: "reveal",
        label: "Afficher dans les Fichiers",
        icon: IconFolder,
        onPress: async () => {
          // node.id EST déjà le chemin absolu (cf. vaultIO.loadTree, qui pose
          // `id: entry.uri`) : le préfixer du chemin du vault donnait un
          // chemin doublé, et l'ouverture échouait en silence.
          const parent = node.id.substring(0, node.id.lastIndexOf("/"));
          await openPath(parent).catch((err) =>
            log.error("impossible d'ouvrir dans les Fichiers", err)
          );
        },
      },
      {
        id: "share",
        label: "Partager",
        icon: IconSquareAndArrowUp,
        onPress: async () => {
          if (!navigator.share) return;
          await navigator
            .share({ title: node.name, text: node.id })
            .catch(() => {});
        },
      },
    ];

    return { primary, items };
  };
}
