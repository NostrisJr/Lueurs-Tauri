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
  inboxAbsPathAtom,
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
  const inboxPath = useAtomValue(inboxAbsPathAtom);
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

  function countFilesInFolder(node: TreeNode): number {
    if (node.kind === "file") return 1;
    if (node.kind === "folder")
      return node.children.reduce(
        (sum: number, child: TreeNode) => sum + countFilesInFolder(child),
        0
      );
    return 0;
  }

  // Étape de confirmation seule, sans mutation — permet au swipe mobile de
  // résoudre le dialogue AVANT de jouer l'animation de suppression (sinon la
  // rangée disparaissait visuellement puis "revenait" si l'utilisateur annulait).
  async function confirmDeleteFolder(node: TreeNode): Promise<boolean> {
    const fileCount = node.kind === "folder" ? countFilesInFolder(node) : 0;
    if (fileCount === 0) return true;
    return await ask("Voulez-vous supprimer ce dossier et tout son contenu ?", {
      title: "Suppression de dossier",
      kind: "warning",
    });
  }

  // Suppression effective, en supposant la confirmation déjà obtenue (cf.
  // confirmDeleteFolder) — appelée après l'animation de fermeture côté swipe.
  async function commitDeleteFolder(node: TreeNode) {
    const fileCount = node.kind === "folder" ? countFilesInFolder(node) : 0;

    if (fileCount === 0) {
      await deleteFolder(node.id, false);
      return;
    }

    const notesInFolder = [...notesById.values()].filter((n) =>
      n.id.startsWith(`${node.id}/`)
    );
    const newTabIds = openTabIds.filter((id) => !id.startsWith(`${node.id}/`));
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

  // Tout-en-un (confirmation + suppression) — pour les endroits sans animation
  // à orchestrer autour (ex: bouton "Supprimer" du menu contextuel).
  async function handleDeleteFolder(node: TreeNode) {
    const confirmed = await confirmDeleteFolder(node);
    if (!confirmed) return;
    await commitDeleteFolder(node);
  }

  async function handleCreateNote() {
    if (!folderPath) return;
    const newNote = await createNote(inboxPath ?? folderPath, activeSpace);
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

  // Retourne true si la fermeture laisse plus aucune note active (dernier onglet
  // fermé) — permet à l'appelant mobile de revenir à la hiérarchie plutôt que
  // d'afficher un éditeur vide.
  function handleCloseTab(tabId: string): boolean {
    const newTabIds = openTabIds.filter((id) => id !== tabId);
    setOpenTabIds(newTabIds);

    const newHistory = tabHistory.filter((id) => id !== tabId);
    setTabHistory(newHistory);

    // Si c'est l'onglet actif (note ou média), revenir au dernier onglet visité encore ouvert
    if (activeNoteId === tabId) {
      const newActive =
        [...newHistory].reverse().find((id) => newTabIds.includes(id)) ?? null;
      setActiveNoteId(newActive);
      return newActive === null;
    }
    return false;
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
    confirmDeleteFolder,
    commitDeleteFolder,
    handleCreateNote,
    handleCreateFolder,
    handleRename,
    handleCloseTab,
    handleCloseAllTabs,
    pushHistory,
  };
}
