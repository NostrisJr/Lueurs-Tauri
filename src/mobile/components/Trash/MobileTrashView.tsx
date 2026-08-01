import { ask } from "@tauri-apps/plugin-dialog";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconArrowUturnLeft,
  IconChevronLeft,
  IconTrash,
} from "../../../shared/components/PlatformIcon";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import type {
  FolderNode,
  NoteFile,
  TreeNode,
} from "../../../shared/hooks/useFileTree";
import { folderPathAtom, mobileGoBackAtom } from "../../../shared/lib/atoms";
import { sortNodes } from "../../../shared/lib/fileTreeHelpers";
import { createLogger } from "../../../shared/lib/logger";
import {
  emptyTrash,
  loadTrashTree,
  permanentlyDeleteFromTrash,
  restoreFromTrash,
} from "../../../shared/lib/trashIO";
import { hapticImpact } from "../../lib/haptics";
import { MobileRowGestures, NodePreviewCard } from "../Row";
import { TrashNotePreview } from "./TrashNotePreview";
import { TrashRow } from "./TrashRow";

const log = createLogger("MobileTrashView");

// Nom réel sur disque (avec extension) — node.name a l'extension retirée pour
// les notes/médias, mais les clés du manifeste de corbeille en ont besoin.
function diskName(node: TreeNode): string {
  return node.id.split("/").pop() as string;
}

export function MobileTrashView() {
  const vaultPath = useAtomValue(folderPathAtom);
  const goBack = useSetAtom(mobileGoBackAtom);
  const { reload: reloadVault } = useFileTree();

  const [trashTree, setTrashTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [folderStack, setFolderStack] = useState<FolderNode[]>([]);
  const [previewNote, setPreviewNote] = useState<NoteFile | null>(null);

  const refresh = useCallback(async () => {
    if (!vaultPath) return;
    const tree = await loadTrashTree(vaultPath);
    setTrashTree(tree);
    // Resynchronise la pile avec les données fraîches (les FolderNode capturés
    // peuvent référencer des enfants obsolètes après une restauration/suppression).
    setFolderStack((prev) => {
      let nodes = tree;
      const next: FolderNode[] = [];
      for (const f of prev) {
        const found = nodes.find(
          (n): n is FolderNode => n.kind === "folder" && n.id === f.id
        );
        if (!found) break;
        next.push(found);
        nodes = found.children;
      }
      return next;
    });
  }, [vaultPath]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
    // biome-ignore lint/correctness/useExhaustiveDependencies: refresh dépend de vaultPath, déjà couvert
  }, [vaultPath]);

  const currentFolder = folderStack[folderStack.length - 1] ?? null;
  const currentNodes = currentFolder ? currentFolder.children : trashTree;
  const sortedNodes = useMemo(() => sortNodes(currentNodes), [currentNodes]);

  function handleBack() {
    hapticImpact("light");
    if (folderStack.length > 0) {
      setFolderStack((prev) => prev.slice(0, -1));
    } else {
      goBack();
    }
  }

  function handleDrillIn(folder: FolderNode) {
    hapticImpact("light");
    setFolderStack((prev) => [...prev, folder]);
  }

  function handleOpenNote(note: NoteFile) {
    setPreviewNote(note);
  }

  async function handleRestore(node: TreeNode) {
    if (!vaultPath) return;
    const trashName = diskName(node);
    hapticImpact("medium");
    try {
      await restoreFromTrash(vaultPath, trashName);
      // Deux arbres indépendants (corbeille et vault) : rechargés en parallèle.
      await Promise.all([refresh(), reloadVault()]);
    } catch (err) {
      log.error("échec restauration", { trashName, err });
    }
  }

  // Confirmation via dialogue natif : contrairement au swipe (geste franc et
  // délibéré), un tap dans un menu se déclenche trop facilement pour une action
  // irréversible.
  async function handlePermanentDelete(node: TreeNode) {
    if (!vaultPath) return;
    const trashName = diskName(node);
    const confirmed = await ask(
      node.kind === "folder"
        ? "Ce dossier et tout son contenu seront supprimés définitivement. Cette action est irréversible."
        : "Cet élément sera supprimé définitivement. Cette action est irréversible.",
      { title: node.name, kind: "warning" }
    );
    if (!confirmed) return;
    hapticImpact("medium");
    try {
      await permanentlyDeleteFromTrash(vaultPath, trashName);
      await refresh();
    } catch (err) {
      log.error("échec suppression définitive", { trashName, err });
    }
  }

  async function handleEmptyTrash() {
    if (!vaultPath) return;
    hapticImpact("medium");
    const confirmed = await ask(
      "Voulez-vous supprimer définitivement tout le contenu de la corbeille ? Cette action est irréversible.",
      { title: "Vider la corbeille", kind: "warning" }
    );
    if (!confirmed) return;
    try {
      await emptyTrash(vaultPath);
      await refresh();
    } catch (err) {
      log.error("échec vidage de la corbeille", { err });
    }
  }

  // Swipe → suppression définitive immédiate (même mécanique que la fermeture
  // d'onglet), sans passer par la confirmation du menu long-press.
  async function handleSwipeDelete(node: TreeNode) {
    if (!vaultPath) return;
    const trashName = diskName(node);
    try {
      await permanentlyDeleteFromTrash(vaultPath, trashName);
      await refresh();
    } catch (err) {
      log.error("échec suppression définitive (swipe)", { trashName, err });
    }
  }

  return (
    <div className="flex flex-col h-full w-full fixed bg-gray-200">
      <div className="flex items-center w-full justify-center px-2 py-2 border-b bg-gray-100 border-gray-200 fixed top-0 pt-14 z-30">
        <button
          type="button"
          onClick={handleBack}
          className="flex-1 justify-start fixed left-1 items-center gap-1 px-2 py-1.5 rounded-lg text-gray-500 active:bg-gray-200 transition-colors z-10"
        >
          <IconChevronLeft className="size-4" />
          <span className="text-base">
            {folderStack.length > 0 ? "Retour" : "Réglages"}
          </span>
        </button>
        <h1 className="justify-center text-2xl font-semibold text-gray-600">
          {currentFolder ? currentFolder.name : "Corbeille"}
        </h1>
        {folderStack.length === 0 && trashTree.length > 0 && (
          <button
            type="button"
            onClick={handleEmptyTrash}
            className="flex-1 justify-end fixed right-2 items-center gap-1 px-2 py-1.5 rounded-lg text-red-500 active:bg-gray-200 transition-colors z-10 text-base"
          >
            Tout supprimer
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto pt-28 px-4 pb-8">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">Chargement…</p>
        ) : sortedNodes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">
            {folderStack.length > 0 ? "Dossier vide" : "Corbeille vide"}
          </p>
        ) : (
          <div className="flex flex-col gap-2 w-full">
            {sortedNodes.map((node) => {
              const row = (
                <TrashRow
                  node={node}
                  onDrillIn={handleDrillIn}
                  onOpenNote={handleOpenNote}
                />
              );
              // Restaurer/supprimer définitivement n'a de sens qu'à la racine
              // de la corbeille : un élément niché dans un dossier trashé n'a
              // pas d'entrée de manifeste propre, il se restaure avec le
              // dossier entier. Plus bas, la rangée est donc inerte.
              return (
                <div key={node.id} className="w-11/12 mx-auto">
                  {folderStack.length === 0 ? (
                    <MobileRowGestures
                      onDelete={() => handleSwipeDelete(node)}
                      onActivate={() => {
                        if (node.kind === "folder") handleDrillIn(node);
                        else if (node.kind === "file") handleOpenNote(node);
                      }}
                      menu={{
                        preview: <NodePreviewCard node={node} muted />,
                        primary: [
                          {
                            id: "restore",
                            label: "Restaurer",
                            icon: IconArrowUturnLeft,
                            onPress: () => handleRestore(node),
                          },
                          {
                            id: "delete",
                            label: "Supprimer",
                            icon: IconTrash,
                            destructive: true,
                            onPress: () => handlePermanentDelete(node),
                          },
                        ],
                      }}
                    >
                      {row}
                    </MobileRowGestures>
                  ) : (
                    row
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {previewNote && (
        <TrashNotePreview
          note={previewNote}
          onClose={() => setPreviewNote(null)}
        />
      )}
    </div>
  );
}
