import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { activeNoteAtom, folderPathAtom, savingAtom, searchAtom, treeAtom } from "../lib/Atoms";
import { flattenTree, NoteFile, TreeNode, useFileTree } from "./useFileTree";
import { useMemo } from "react";
import { ask } from '@tauri-apps/plugin-dialog';


export function useNote() {
    const [activeNote, setActiveNote] = useAtom(activeNoteAtom)
    const setSaving = useSetAtom(savingAtom)
    const setSearch = useSetAtom(searchAtom)
    const tree = useAtomValue(treeAtom)
    const folderPath = useAtomValue(folderPathAtom)

    const { updateNote, deleteNote, deleteFolder, createNote, createFolder, renameNode } = useFileTree();

    const allNotes = useMemo(() => flattenTree(tree), [tree]);

    function handleChange(markdown: string) {
        if (!activeNote) return;
        setSaving(true);
        updateNote(activeNote.id, markdown);
        // L'indicateur "saving" s'éteint après le debounce + un peu de marge
        setTimeout(() => setSaving(false), 1200);
    }

    function handleSelectNote(note: NoteFile) {
        setActiveNote(note);
        setSearch("");
    }

    async function handleDeleteNote(fileId: string) {
        await deleteNote(fileId);
        if (activeNote?.id === fileId) setActiveNote(null);
    }

    async function handleDeleteFolder(node: TreeNode) {
        // Vérifier si le dossier contient des fichiers
        const countFiles = (node: TreeNode): number => {
            if (node.kind === "file") return 1;
            return node.children.reduce((sum, child) => sum + countFiles(child), 0);
        };

        const fileCount = node.kind === "folder" ? countFiles(node) : 0;

        if (fileCount === 0) {
            // Dossier vide, suppression directe
            await deleteFolder(node.id, false);
        } else {
            const answer = await ask("Voulez-vous supprimer ce dossier et tout son contenu ?", {
                title: 'Suppression de dossier',
                kind: 'warning',
            });

            if (answer) {
                await deleteFolder(node.id, true);

                // Si la note active était dans ce dossier, la désélectionner
                if (activeNote && activeNote.id.startsWith(node.id)) {
                    setActiveNote(null);
                }
            }
        }
    }

    async function handleCreateNote() {
        if (!folderPath) return;

        const targetDir = folderPath;
        const filePath = await createNote(targetDir);

        // Sélectionne la nouvelle note après rechargement
        const newNote = allNotes.find((n) => n.id === filePath);
        if (newNote) setActiveNote(newNote);
    }

    async function handleCreateFolder() {
        if (!folderPath) return;

        const targetDir = folderPath;
        await createFolder(targetDir);
    }

    async function handleRename(oldPath: string, newName: string, isFolder: boolean) {
        const newPath = await renameNode(oldPath, newName, isFolder);

        if (!isFolder && activeNote?.id === oldPath) {
            setActiveNote({ ...activeNote, id: newPath, name: newName });
        }

        return newPath;
    }

    return {
        handleChange,
        handleSelectNote,
        handleDeleteNote,
        handleDeleteFolder,
        handleCreateNote,
        handleCreateFolder,
        handleRename,
    }
}