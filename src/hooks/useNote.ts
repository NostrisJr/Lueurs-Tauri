import { useAtomValue, useSetAtom } from "jotai";
import { activeNoteAtom, activeNoteIdAtom, folderPathAtom, savingAtom, searchAtom, treeAtom } from "../lib/atoms";
import { flattenTree, type NoteFile, type TreeNode, type FolderNode, useFileTree, type Frontmatter } from "../components/FileTree/useFileTree";
import { useMemo } from "react";
import { createLogger } from "../lib/logger";
import { ask } from '@tauri-apps/plugin-dialog';
import { useFrontmatter } from '../components/Frontmatter/hooks/useFrontmatter';
import { useTemplateSync } from './useTemplateSync';

const log = createLogger("useNote");

export function useNote() {
    const activeNote = useAtomValue(activeNoteAtom);
    const setActiveNoteId = useSetAtom(activeNoteIdAtom);
    const setSaving = useSetAtom(savingAtom);
    const setSearch = useSetAtom(searchAtom);
    const tree = useAtomValue(treeAtom);
    const folderPath = useAtomValue(folderPathAtom);

    const { updateNote, deleteNote, deleteFolder, createNote, createFolder, renameNode, openFolderNote } = useFileTree();
    const { onFrontmatterChange, refreshBaseChildren, cleanupNoteFromBases } = useFrontmatter();
    const { onTemplateChange } = useTemplateSync();

    const allNotes = useMemo(() => flattenTree(tree), [tree]);

    function handleChange(body: string, frontmatter: Frontmatter) {
        if (!activeNote) return;
        setSaving(true);

        const frontmatterChanged = JSON.stringify(frontmatter) !== JSON.stringify(activeNote.frontmatter);
        if (frontmatterChanged) {
            onFrontmatterChange(activeNote.id, activeNote.frontmatter, frontmatter).catch((err) => {
                log.error("erreur onFrontmatterChange", err);
            });
        }

        const isTemplate = activeNote.type === "__template__";
        const prevFrontmatter = activeNote.frontmatter;
        const noteId = activeNote.id;

        // onTemplateChange après persistance disque — Rust doit lire les fichiers à jour
        updateNote(activeNote.id, body, frontmatter, isTemplate && frontmatterChanged ? () => {
            log.info("template persisté, propagation des changements", { noteId });
            onTemplateChange(noteId, prevFrontmatter, frontmatter).catch((err) => {
                log.error("erreur onTemplateChange", err);
            });
        } : undefined);

        setTimeout(() => setSaving(false), 1200);
    }

    function handleSelectNote(note: NoteFile) {
        setActiveNoteId(note.id);
        setSearch("");
    }

    async function handleOpenFolder(folderNode: FolderNode) {
        const note = await openFolderNote(folderNode);
        setActiveNoteId(note.id);
        setSearch("");
    }

    async function handleDeleteNote(fileId: string) {
        if (activeNote?.id === fileId) setActiveNoteId(null);
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
            const answer = await ask("Voulez-vous supprimer ce dossier et tout son contenu ?", {
                title: 'Suppression de dossier',
                kind: 'warning',
            });
            if (answer) {
                const notesInFolder = allNotes.filter((n) => n.id.startsWith(`${node.id}/`));
                for (const n of notesInFolder) {
                    await cleanupNoteFromBases(n.id);
                }
                if (activeNote?.id.startsWith(node.id)) setActiveNoteId(null);
                await deleteFolder(node.id, true);
            }
        }
    }

    async function handleCreateNote() {
        if (!folderPath) return;
        const newNote = await createNote(folderPath);
        setActiveNoteId(newNote.id);
    }

    async function handleCreateFolder() {
        if (!folderPath) return;
        await createFolder(folderPath);
    }

    async function handleRename(oldPath: string, newName: string, isFolder: boolean) {
        const note = !isFolder ? allNotes.find((n) => n.id === oldPath) : null;
        const isFolderNote = note?.type === "__folder__" && note.name === oldPath.split("/").slice(-2, -1)[0];

        if (isFolderNote) {
            const folderPath = oldPath.split("/").slice(0, -1).join("/");
            return handleRename(folderPath, newName, true);
        }

        const newPath = await renameNode(oldPath, newName, isFolder);

        if (!isFolder && activeNote?.id === oldPath) {
            setActiveNoteId(newPath);
        } else if (isFolder && activeNote) {
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

    return {
        handleChange,
        refreshBaseChildren,
        handleSelectNote,
        handleOpenFolder,
        handleDeleteNote,
        handleDeleteFolder,
        handleCreateNote,
        handleCreateFolder,
        handleRename,
    };
}