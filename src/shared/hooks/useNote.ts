import { ask } from "@tauri-apps/plugin-dialog";
import { useAtomValue, useSetAtom } from "jotai";
import { useRef } from "react";
import { useFrontmatter } from "../../desktop/components/Frontmatter/hooks/useFrontmatter";
import { useTemplateSync } from "../../desktop/hooks/useTemplateSync";
import {
  activeNoteAtom,
  activeNoteIdAtom,
  activeSpaceAtom,
  folderPathAtom,
  notesByIdAtom,
  openTabIdsAtom,
  savingAtom,
  searchAtom,
  tabHistoryAtom,
} from "../lib/atoms";
import { frontmatterEqual } from "../lib/fileTreeHelpers";
import { createLogger } from "../lib/logger";
import { NoteType } from "../lib/noteTypes";
import {
  type FolderNode,
  type Frontmatter,
  type MediaFile,
  type NoteFile,
  type TreeNode,
  useFileTree,
} from "./useFileTree";
import { usePathPropagation } from "./usePathPropagation";

const log = createLogger("useNote");

export function useNote() {
  const activeNote = useAtomValue(activeNoteAtom);
  const activeNoteId = useAtomValue(activeNoteIdAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
  const openTabIds = useAtomValue(openTabIdsAtom);
  const setOpenTabIds = useSetAtom(openTabIdsAtom);
  const setSaving = useSetAtom(savingAtom);
  const setSearch = useSetAtom(searchAtom);
  const notesById = useAtomValue(notesByIdAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const activeSpace = useAtomValue(activeSpaceAtom);

  const tabHistory = useAtomValue(tabHistoryAtom);
  const setTabHistory = useSetAtom(tabHistoryAtom);

  // État du template figé au début d'une rafale d'édition (par noteId), pour que
  // le diff de propagation porte sur le changement complet et non la dernière frappe.
  const templatePrevRef = useRef<Map<string, Frontmatter>>(new Map());

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

  function handleChange(body: string, frontmatter: Frontmatter) {
    if (!activeNote) return;

    const frontmatterChanged = !frontmatterEqual(
      frontmatter,
      activeNote.frontmatter
    );
    const bodyChanged = body !== activeNote.body;
    // Early return critique : sinon un appel sans changement (typiquement
    // commit(rows) déclenché par le blur du champ valeur) reset le debounce
    // d'updateNote sans callback, annulant la propagation template en attente.
    if (!frontmatterChanged && !bodyChanged) return;

    setSaving(true);
    if (frontmatterChanged) {
      onFrontmatterChange(
        activeNote.id,
        activeNote.frontmatter,
        frontmatter
      ).catch((err) => {
        log.error("erreur onFrontmatterChange", err);
      });
    }

    const isTemplate = activeNote.type === NoteType.TEMPLATE;
    const noteId = activeNote.id;

    // updateNote met l'arbre à jour à chaque frappe (activeNote.frontmatter avance)
    // et le debounce ne conserve que le dernier callback. On fige l'état d'avant-rafale
    // pour que le diff voie le changement complet — sinon un renommage de valeur étalé
    // sur plusieurs frappes n'est jamais détecté (l'old_value ne correspond plus).
    if (
      isTemplate &&
      frontmatterChanged &&
      !templatePrevRef.current.has(noteId)
    ) {
      templatePrevRef.current.set(noteId, activeNote.frontmatter);
    }

    // onTemplateChange après persistance disque — Rust doit lire les fichiers à jour
    updateNote(
      activeNote.id,
      body,
      frontmatter,
      isTemplate && frontmatterChanged
        ? () => {
            const prev =
              templatePrevRef.current.get(noteId) ?? activeNote.frontmatter;
            templatePrevRef.current.delete(noteId);
            log.info("template persisté, propagation des changements", {
              noteId,
            });
            onTemplateChange(noteId, prev, frontmatter).catch((err) => {
              log.error("erreur onTemplateChange", err);
            });
          }
        : undefined
    );

    setTimeout(() => setSaving(false), 1200);
  }

  // Ouvre une note ou un média dans les onglets (logique partagée).
  function handleSelectNote(node: NoteFile | MediaFile, openInNewTab = false) {
    if (openInNewTab) {
      // Cmd+clic : ajouter un nouvel onglet si pas déjà présent
      if (!openTabIds.includes(node.id)) {
        setOpenTabIds([...openTabIds, node.id]);
      }
    } else if (openTabIds.includes(node.id)) {
      // Déjà ouvert : juste l'activer
    } else if (activeNoteId) {
      // Remplacer l'onglet actif (note ou média)
      setOpenTabIds(
        openTabIds.map((id) => (id === activeNoteId ? node.id : id))
      );
    } else {
      // Aucun onglet actif : créer le premier
      setOpenTabIds([node.id]);
    }
    setActiveNoteId(node.id);
    pushHistory(node.id);
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

  async function handleDeleteMedia(fileId: string) {
    const newTabIds = openTabIds.filter((id) => id !== fileId);
    setOpenTabIds(newTabIds);

    if (activeNoteId === fileId) {
      const idx = openTabIds.indexOf(fileId);
      const newActive = newTabIds[idx - 1] ?? newTabIds[idx] ?? null;
      setActiveNoteId(newActive);
    }

    log.info("suppression média", { fileId });
    await deleteNote(fileId);
    log.info("suppression média terminée", { fileId });
  }

  async function handleDeleteFolder(node: TreeNode) {
    const countFiles = (n: TreeNode): number => {
      if (n.kind === "file") return 1;
      if (n.kind === "folder")
        return n.children.reduce(
          (sum: number, child: TreeNode) => sum + countFiles(child),
          0
        );
      return 0;
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
        const notesInFolder = [...notesById.values()].filter((n) =>
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
    const newNote = await createNote(folderPath, activeSpace);
    setOpenTabIds([...openTabIds, newNote.id]);
    setActiveNoteId(newNote.id);
    pushHistory(newNote.id);
  }

  async function handleCreateFolder() {
    if (!folderPath) return;
    await createFolder(folderPath, activeSpace);
  }

  async function handleRename(
    oldPath: string,
    newName: string,
    isFolder: boolean
  ) {
    const note = !isFolder ? (notesById.get(oldPath) ?? null) : null;
    //TODO: pouprquoi ne pas utiliser les vrais types ?
    const isFolderNote =
      note?.type === NoteType.FOLDER &&
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

    // Si c'est l'onglet actif (note ou média), revenir au dernier onglet visité encore ouvert
    if (activeNoteId === tabId) {
      const newActive =
        [...newHistory].reverse().find((id) => newTabIds.includes(id)) ?? null;
      setActiveNoteId(newActive);
    }
  }

  function handleCloseAllTabs() {
    setOpenTabIds([]);
    setTabHistory([]);
    setActiveNoteId(null);
  }

  return {
    handleChange,
    handleSelectNote,
    handleOpenFolder,
    handleDeleteNote,
    handleDeleteMedia,
    handleDeleteFolder,
    handleCreateNote,
    handleCreateFolder,
    handleRename,
    handleCloseTab,
    handleCloseAllTabs,
    pushHistory,
  };
}
