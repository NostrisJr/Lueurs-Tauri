import { useAtomValue, useSetAtom } from "jotai";
import {
  flattenTree,
  type NoteFile,
  type TreeNode,
  type FolderNode,
  useFileTree,
  type Frontmatter,
} from "./useFileTree";
import { useMemo } from "react";
import { createLogger } from "../lib/logger";
import { ask } from "@tauri-apps/plugin-dialog";
import { useFrontmatter } from "../../desktop/components/Frontmatter/hooks/useFrontmatter";
import { useTemplateSync } from "../../desktop/hooks/useTemplateSync";
import { usePathPropagation } from "./usePathPropagation";
import {
  activeNoteAtom,
  activeNoteIdAtom,
  openTabIdsAtom,
  savingAtom,
  searchAtom,
  treeAtom,
  folderPathAtom,
  tabHistoryAtom,
} from "../lib/Atoms";

const log = createLogger("useNote");

export function useNote() {
  const activeNote = useAtomValue(activeNoteAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
  const openTabIds = useAtomValue(openTabIdsAtom);
  const setOpenTabIds = useSetAtom(openTabIdsAtom);
  const setSaving = useSetAtom(savingAtom);
  const setSearch = useSetAtom(searchAtom);
  const tree = useAtomValue(treeAtom);
  const folderPath = useAtomValue(folderPathAtom);

  const tabHistory = useAtomValue(tabHistoryAtom);
  const setTabHistory = useSetAtom(tabHistoryAtom);

  const {
    updateNote,
    deleteNote,
    deleteFolder,
    createNote,
    createFolder,
    renameNode,
    openFolderNote,
  } = useFileTree();
  const { onFrontmatterChange, cleanupNoteFromBases } = useFrontmatter();
  const { onTemplateChange } = useTemplateSync();
  const { propagateNoteRename, propagateFolderRename } = usePathPropagation();

  // Enregistre une visite dans l'historique (dédupliqué, plus récent en dernier)
  function pushHistory(id: string) {
    setTabHistory((prev) => [...prev.filter((x) => x !== id), id]);
  }

  const allNotes = useMemo(() => flattenTree(tree), [tree]);

  function handleChange(body: string, frontmatter: Frontmatter) {
    if (!activeNote) return;
    setSaving(true);

    const frontmatterChanged =
      JSON.stringify(frontmatter) !== JSON.stringify(activeNote.frontmatter);
    if (frontmatterChanged) {
      onFrontmatterChange(
        activeNote.id,
        activeNote.frontmatter,
        frontmatter
      ).catch((err) => {
        log.error("erreur onFrontmatterChange", err);
      });
    }

    const isTemplate = activeNote.type === "__template__";
    const prevFrontmatter = activeNote.frontmatter;
    const noteId = activeNote.id;

    // onTemplateChange après persistance disque — Rust doit lire les fichiers à jour
    updateNote(
      activeNote.id,
      body,
      frontmatter,
      isTemplate && frontmatterChanged
        ? () => {
            log.info("template persisté, propagation des changements", {
              noteId,
            });
            onTemplateChange(noteId, prevFrontmatter, frontmatter).catch(
              (err) => {
                log.error("erreur onTemplateChange", err);
              }
            );
          }
        : undefined
    );

    setTimeout(() => setSaving(false), 1200);
  }

  function handleSelectNote(note: NoteFile, openInNewTab = false) {
    if (openInNewTab) {
      // Cmd+clic : ajouter un nouvel onglet si pas déjà présent
      if (!openTabIds.includes(note.id)) {
        setOpenTabIds([...openTabIds, note.id]);
      }
    } else if (openTabIds.includes(note.id)) {
      // Note déjà ouverte : juste l'activer
    } else if (activeNote) {
      // Remplacer l'onglet actif
      setOpenTabIds(
        openTabIds.map((id) => (id === activeNote.id ? note.id : id))
      );
    } else {
      // Aucun onglet actif : créer le premier
      setOpenTabIds([note.id]);
    }
    setActiveNoteId(note.id);
    pushHistory(note.id);
    setSearch("");
  }

  async function handleOpenFolder(
    folderNode: FolderNode,
    openInNewTab = false
  ) {
    const note = await openFolderNote(folderNode);

    if (openInNewTab) {
      if (!openTabIds.includes(note.id)) {
        setOpenTabIds([...openTabIds, note.id]);
      }
    } else if (openTabIds.includes(note.id)) {
      // Déjà ouverte : juste l'activer
    } else if (activeNote) {
      setOpenTabIds(
        openTabIds.map((id) => (id === activeNote.id ? note.id : id))
      );
    } else {
      setOpenTabIds([note.id]);
    }

    setActiveNoteId(note.id);
    pushHistory(note.id);
    setSearch("");
  }

  async function handleDeleteNote(fileId: string) {
    const newTabIds = openTabIds.filter((id) => id !== fileId);
    setOpenTabIds(newTabIds);

    if (activeNote?.id === fileId) {
      const idx = openTabIds.indexOf(fileId);
      const newActive = newTabIds[idx - 1] ?? newTabIds[idx] ?? null;
      setActiveNoteId(newActive);
    }

    log.info("suppression note", { fileId });
    await cleanupNoteFromBases(fileId);
    await deleteNote(fileId);
    log.info("suppression terminée", { fileId });
  }

  async function handleDeleteFolder(node: TreeNode) {
    const countFiles = (n: TreeNode): number => {
      if (n.kind === "file") return 1;
      return n.children.reduce((sum, child) => sum + countFiles(child), 0);
    };

    const fileCount = node.kind === "folder" ? countFiles(node) : 0;

    if (fileCount === 0) {
      await deleteFolder(node.id, false);
    } else {
      const answer = await ask(
        "Voulez-vous supprimer ce dossier et tout son contenu ?",
        {
          title: "Suppression de dossier",
          kind: "warning",
        }
      );
      if (answer) {
        const notesInFolder = allNotes.filter((n) =>
          n.id.startsWith(`${node.id}/`)
        );
        const newTabIds = openTabIds.filter(
          (id) => !id.startsWith(`${node.id}/`)
        );
        setOpenTabIds(newTabIds);

        for (const n of notesInFolder) {
          await cleanupNoteFromBases(n.id);
        }

        if (activeNote?.id.startsWith(node.id)) {
          const newActive = newTabIds.length > 0 ? newTabIds[0] : null;
          setActiveNoteId(newActive);
        }

        await deleteFolder(node.id, true);
      }
    }
  }

  async function handleCreateNote() {
    if (!folderPath) return;
    const newNote = await createNote(folderPath);
    setOpenTabIds([...openTabIds, newNote.id]);
    setActiveNoteId(newNote.id);
    pushHistory(newNote.id);
  }

  async function handleCreateFolder() {
    if (!folderPath) return;
    await createFolder(folderPath);
  }

  async function handleRename(
    oldPath: string,
    newName: string,
    isFolder: boolean
  ) {
    const note = !isFolder ? allNotes.find((n) => n.id === oldPath) : null;
    const isFolderNote =
      note?.type === "__folder__" &&
      note.name === oldPath.split("/").slice(-2, -1)[0];

    if (isFolderNote) {
      const folderPath = oldPath.split("/").slice(0, -1).join("/");
      return handleRename(folderPath, newName, true);
    }

    const newPath = await renameNode(oldPath, newName, isFolder);

    if (!isFolder) {
      await propagateNoteRename(oldPath, newPath);
      if (activeNote?.id === oldPath) setActiveNoteId(newPath);
      // Mettre à jour les onglets ouverts
      if (openTabIds.includes(oldPath)) {
        setOpenTabIds(openTabIds.map((id) => (id === oldPath ? newPath : id)));
      }
    } else {
      await propagateFolderRename(oldPath, newPath);
      // Mettre à jour les onglets des notes du dossier
      const newTabIds = openTabIds.map((id) =>
        id.startsWith(`${oldPath}/`) ? id.replace(oldPath, newPath) : id
      );
      setOpenTabIds(newTabIds);
    }

    if (isFolder && activeNote) {
      const oldFolderNoteId = `${oldPath}/${oldPath.split("/").pop()}.md`;
      const newFolderNoteId = `${newPath}/${newName}.md`;

      if (activeNote.id === oldFolderNoteId) {
        setActiveNoteId(newFolderNoteId);
      } else if (activeNote.id.startsWith(`${oldPath}/`)) {
        setActiveNoteId(activeNote.id.replace(oldPath, newPath));
      }
    }

    return newPath;
  }

  function handleCloseTab(tabId: string) {
    const newTabIds = openTabIds.filter((id) => id !== tabId);
    setOpenTabIds(newTabIds);

    const newHistory = tabHistory.filter((id) => id !== tabId);
    setTabHistory(newHistory);

    // Si c'est l'onglet actif, revenir au dernier onglet visité encore ouvert
    if (activeNote?.id === tabId) {
      const newActive =
        [...newHistory].reverse().find((id) => newTabIds.includes(id)) ?? null;
      setActiveNoteId(newActive);
    }
  }

  return {
    handleChange,
    handleSelectNote,
    handleOpenFolder,
    handleDeleteNote,
    handleDeleteFolder,
    handleCreateNote,
    handleCreateFolder,
    handleRename,
    handleCloseTab,
    pushHistory,
  };
}
