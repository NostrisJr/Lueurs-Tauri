import { mkdir, readDir, rename, writeTextFile } from "@tauri-apps/plugin-fs";
import { watchImmediate } from "@tauri-apps/plugin-fs";
import { useStore } from "jotai";
import { useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";

import { invoke } from "@tauri-apps/api/core";
import { documentDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { platform } from "@tauri-apps/plugin-os";
import {
  activeNoteIdAtom,
  errorAtom,
  folderPathAtom,
  loadingAtom,
  treeAtom,
  writingPathsRegistry,
} from "../lib/Atoms";
import {
  type Frontmatter,
  addNodeInTree,
  deleteNodeInTree,
  ensureType,
  extractTags,
  extractTitle,
  findNextAvailableNumber,
  flattenTree,
  moveToTrash,
  renameNodeInTree,
  serializeFrontmatter,
  updateFolderInTree,
  updateNodeInTree,
} from "../lib/fileTreeHelpers";
import { createLogger } from "../lib/logger";
import { NoteType } from "../lib/noteTypes";
import {
  allowVaultScope,
  applyAllTemplates,
  loadTree,
  resolveDestName,
} from "../lib/vaultIO";

// ── Types ──────────────────────────────────────────────────────────────────

export interface NoteFile {
  kind: "file";
  id: string;
  name: string;
  type: string | null;
  title: string;
  body: string;
  frontmatter: Frontmatter;
  tags: string[];
  updatedAt: Date;
}

export interface FolderNode {
  kind: "folder";
  id: string;
  name: string;
  children: TreeNode[];
}

export type TreeNode = NoteFile | FolderNode;

export { flattenTree };
export type { Frontmatter };

// ── Constante ─────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 1000;
const log = createLogger("useFileTree");

// ── Hook ───────────────────────────────────────────────────────────────────

export function useFileTree() {
  const [folderPath, setFolderPath] = useAtom(folderPathAtom);
  const setTree = useSetAtom(treeAtom);
  const store = useStore();
  const setLoading = useSetAtom(loadingAtom);
  const setError = useSetAtom(errorAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);

  const debounceTimers = useRef<
    Map<
      string,
      { timer: ReturnType<typeof setTimeout>; flush: () => Promise<void> }
    >
  >(new Map());
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unwatchRef = useRef<(() => void) | null>(null);

  // ── Watcher FS ──────────────────────────────────────────────────────────

  const startWatcher = useCallback(async (path: string) => {
    // Arrêter le watcher précédent si besoin
    if (unwatchRef.current) {
      unwatchRef.current();
      unwatchRef.current = null;
    }

    try {
      const unwatch = await watchImmediate(
        path,
        (event) => {
          // Ignorer les events sur les ressources et config
          const paths = Array.isArray(event.paths) ? event.paths : [];
          const relevant = paths.filter(
            (p: string) =>
              !p.includes("/resources/") &&
              !p.includes("/config/") &&
              !p.includes("/.") &&
              p.endsWith(".md") &&
              !writingPathsRegistry.has(p)
          );
          if (relevant.length === 0) return;

          log.info("changement FS détecté", { paths: relevant });
          // Debounce le reload pour ne pas spammer si plusieurs fichiers changent
          if (reloadTimer.current) clearTimeout(reloadTimer.current);
          reloadTimer.current = setTimeout(() => {
            reloadTimer.current = null;
            reload(path);
          }, 300);
        },
        { recursive: true }
      );
      unwatchRef.current = unwatch;
      log.info("watcher FS démarré", { path });
    } catch (err) {
      log.warn("watcher FS indisponible", { err });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (unwatchRef.current) unwatchRef.current();
    };
  }, []);

  // ── Chargement ──────────────────────────────────────────────────────────

  async function reload(path: string) {
    setLoading(true);
    setError(null);
    try {
      const nodes = await loadTree(path, path);
      const finalNodes = await applyAllTemplates(nodes, path);
      setTree(finalNodes);
    } catch (e) {
      setError(
        `Impossible de lire le dossier : ${e instanceof Error ? e.message : String(e)}`
      );
      setTree([]);
    } finally {
      setLoading(false);
    }
  }

  async function initFolder() {
    if (!folderPath) return;
    log.info("restauration vault au démarrage", { folderPath });
    await allowVaultScope(folderPath);
    await reload(folderPath);
    await startWatcher(folderPath);
  }

  async function autoInitFolder() {
    const icloudPath = await invoke<string | null>("get_icloud_path");
    if (!icloudPath) return;
    // Re-vérification après l'await : Jotai peut avoir hydraté folderPathAtom depuis
    // localStorage pendant l'invoke. Si un chemin est déjà là, on ne l'écrase pas.
    if (store.get(folderPathAtom)) return;
    log.info("vault macOS iCloud auto-initialisé", { icloudPath });
    await allowVaultScope(icloudPath);
    setActiveNoteId(null);
    setError(null);
    setFolderPath(icloudPath);
    await reload(icloudPath);
    await startWatcher(icloudPath);
  }

  async function switchVault(path: string) {
    await allowVaultScope(path);
    setActiveNoteId(null);
    setError(null);
    setFolderPath(path);
    await reload(path);
    await startWatcher(path);
  }

  async function pickFolder() {
    let selected: string;

    const currentPlatform = platform();
    if (currentPlatform === "ios") {
      const icloudPath = await invoke<string | null>("get_icloud_path");
      selected = icloudPath ?? (await documentDir());
      log.info("vault iOS", { selected, icloud: !!icloudPath });
    } else if (currentPlatform === "android") {
      const result = await invoke<string | null>("pick_android_folder");
      if (!result) {
        log.info("vault Android: sélection annulée");
        return;
      }
      log.info("vault Android sélectionné", { path: result });
      selected = result;
    } else {
      // Sur macOS, positionner le picker sur le conteneur iCloud s'il existe
      let defaultPath: string | undefined;
      if (currentPlatform === "macos") {
        const icloudPath = await invoke<string | null>("get_icloud_path_macos");
        defaultPath = icloudPath ?? undefined;
      }
      let result: unknown;
      try {
        result = await open({ directory: true, multiple: false, defaultPath });
        log.info("dialog open résultat", { result, type: typeof result, platform: currentPlatform });
      } catch (err) {
        log.error("dialog open échoué", { err, platform: currentPlatform });
        return;
      }
      if (!result || typeof result !== "string") {
        log.warn("dialog open: résultat invalide ou annulé", { result });
        return;
      }
      selected = result;
    }

    await switchVault(selected);
  }

  // ── Note __folder__ ─────────────────────────────────────────────────────

  async function openFolderNote(folderNode: FolderNode): Promise<NoteFile> {
    const folderName = folderNode.name;
    const filePath = `${folderNode.id}/${folderName}.md`;

    const existing = folderNode.children.find(
      (n): n is NoteFile => n.kind === "file" && n.name === folderName
    );
    if (existing) return existing;

    log.info("création note __folder__", { path: filePath });
    const frontmatter: Frontmatter = { __Type__: NoteType.FOLDER };
    const body = "";
    const raw = serializeFrontmatter(frontmatter, body);
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    await writeTextFile(filePath, raw, { baseDir: null } as any);

    const newNote: NoteFile = {
      kind: "file",
      id: filePath,
      name: folderName,
      type: NoteType.FOLDER,
      title: folderName,
      body,
      frontmatter,
      tags: [],
      updatedAt: new Date(),
    };

    setTree((prev) =>
      addNodeInTree(prev, folderNode.id, newNote, folderPath ?? undefined)
    );
    return newNote;
  }

  // ── Écriture ────────────────────────────────────────────────────────────

  function updateNote(
    fileId: string,
    body: string,
    frontmatter: Frontmatter,
    onPersisted?: () => void
  ) {
    const noteName = fileId.split("/").pop()?.replace(/\.md$/, "") ?? "";
    const parentFolderName = fileId.split("/").slice(-2, -1)[0] ?? "";
    const safeFrontmatter = ensureType(frontmatter, noteName, parentFolderName);
    const raw = serializeFrontmatter(safeFrontmatter, body);

    // Mise à jour mémoire immédiate
    setTree((prev) =>
      updateNodeInTree(prev, fileId, {
        body,
        frontmatter: safeFrontmatter,
        type: (safeFrontmatter.__Type__ as string) ?? null,
        title: extractTitle(body),
        tags: extractTags(raw),
        updatedAt: new Date(),
      })
    );

    // Persistance debouncée — absorbe les frappes clavier dans le corps de la note
    const flush = async () => {
      writingPathsRegistry.add(fileId);
      // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
      await writeTextFile(fileId, raw, { baseDir: null } as any);
      writingPathsRegistry.delete(fileId);
      log.info("note persistée", { fileId });
      onPersisted?.();
    };
    const existing = debounceTimers.current.get(fileId);
    if (existing) clearTimeout(existing.timer);
    debounceTimers.current.set(fileId, {
      timer: setTimeout(async () => {
        debounceTimers.current.delete(fileId);
        await flush();
      }, DEBOUNCE_MS),
      flush,
    });
  }

  // ── Création ────────────────────────────────────────────────────────────

  async function createNote(dirPath: string): Promise<NoteFile> {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const entries = await readDir(dirPath, { baseDir: null } as any);
    const number = await findNextAvailableNumber(
      entries,
      "Nouvelle note",
      false
    );
    const fileName = `Nouvelle note ${number}.md`;
    const filePath = `${dirPath}/${fileName}`;
    const frontmatter: Frontmatter = { __Type__: NoteType.NOTE };
    const body = "";

    await writeTextFile(filePath, serializeFrontmatter(frontmatter, body));

    const newNote: NoteFile = {
      kind: "file",
      id: filePath,
      name: `Nouvelle note ${number}`,
      type: NoteType.NOTE,
      title: "Nouvelle note",
      body,
      frontmatter,
      tags: [],
      updatedAt: new Date(),
    };

    setTree((prev) =>
      addNodeInTree(prev, dirPath, newNote, folderPath ?? undefined)
    );
    return newNote;
  }

  async function createFolder(dirPath: string) {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const entries = await readDir(dirPath, { baseDir: null } as any);
    const number = await findNextAvailableNumber(
      entries,
      "Nouveau dossier",
      true
    );
    const name = `Nouveau dossier ${number}`;
    const fullPath = `${dirPath}/${name}`;
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    await mkdir(fullPath, { baseDir: null } as any);

    const newNode: FolderNode = {
      kind: "folder",
      id: fullPath,
      name,
      children: [],
    };
    setTree((prev) =>
      addNodeInTree(prev, dirPath, newNode, folderPath ?? undefined)
    );
  }

  // ── Suppression ─────────────────────────────────────────────────────────

  async function deleteNote(fileId: string) {
    // Masquer dans le watcher le temps que le cleanup disque soit terminé
    writingPathsRegistry.add(fileId);
    setTree((prev) => deleteNodeInTree(prev, fileId));
    await moveToTrash(fileId);
    writingPathsRegistry.delete(fileId);
  }

  async function deleteFolder(folderId: string, recursive = false) {
    if (!recursive) {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const entries = await readDir(folderId, { baseDir: null } as any);
      if (entries.filter((e) => e.name && !e.name.startsWith(".")).length > 0)
        throw new Error("Le dossier n'est pas vide.");
    }
    writingPathsRegistry.add(folderId);
    setTree((prev) => deleteNodeInTree(prev, folderId));
    await moveToTrash(folderId);
    writingPathsRegistry.delete(folderId);
  }

  // ── Renommage ────────────────────────────────────────────────────────────

  // Flush immédiat d'un write en attente — à appeler avant tout rename/move
  async function flushPendingWrite(fileId: string) {
    const entry = debounceTimers.current.get(fileId);
    if (!entry) return;
    clearTimeout(entry.timer);
    debounceTimers.current.delete(fileId);
    await entry.flush();
  }

  async function renameNode(
    oldPath: string,
    newName: string,
    isFolder: boolean
  ) {
    const parts = oldPath.split("/");
    const oldName = parts[parts.length - 1];
    parts[parts.length - 1] = isFolder ? newName : `${newName}.md`;
    const newPath = parts.join("/");

    // Flush tout write en attente avant de renommer — sinon le debounce
    // recrée le fichier à l'ancien chemin après le rename disque.
    if (!isFolder) {
      await flushPendingWrite(oldPath);
    }

    if (isFolder) {
      // Renommer la note __folder__ avant le dossier (oldPath encore valide)
      try {
        await rename(`${oldPath}/${oldName}.md`, `${oldPath}/${newName}.md`, {
          baseDir: null,
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        } as any);
      } catch {
        log.info("pas de note __folder__ à renommer", { folder: oldPath });
      }
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      await rename(oldPath, newPath, { baseDir: null } as any);
      const updatedChildren = await loadTree(newPath, folderPath ?? undefined);
      setTree((prev) =>
        updateFolderInTree(prev, oldPath, newPath, newName, updatedChildren)
      );
    } else {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      await rename(oldPath, newPath, { baseDir: null } as any);
      setTree((prev) => renameNodeInTree(prev, oldPath, newPath, newName));
    }

    return newPath;
  }

  // ── Déplacement d'un nœud vers un autre dossier ────────────────────────

  async function moveNode(
    sourceId: string,
    targetFolderPath: string
  ): Promise<string | null> {
    // Guards
    if (sourceId === targetFolderPath) return null;
    if (targetFolderPath.startsWith(`${sourceId}/`)) return null;
    const currentParent = sourceId.split("/").slice(0, -1).join("/");
    if (currentParent === targetFolderPath) return null;

    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    const sourceName = sourceId.split("/").pop()!;
    const destName = await resolveDestName(targetFolderPath, sourceName);
    const newPath = `${targetFolderPath}/${destName}`;

    writingPathsRegistry.add(sourceId);
    try {
      // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
      await rename(sourceId, newPath, { baseDir: null } as any);
    } finally {
      writingPathsRegistry.delete(sourceId);
    }

    const isFolder = !sourceId.endsWith(".md");

    if (!isFolder) {
      const note = flattenTree(store.get(treeAtom)).find(
        (n) => n.id === sourceId
      );
      if (note) {
        const movedNote: NoteFile = { ...note, id: newPath };
        setTree((prev) =>
          addNodeInTree(
            deleteNodeInTree(prev, sourceId),
            targetFolderPath,
            movedNote,
            folderPath ?? undefined
          )
        );
      }
    } else if (folderPath) {
      // Recharger l'arbre complet : plus sûr pour les déplacements de dossiers
      await reload(folderPath);
    }

    log.info("nœud déplacé", { sourceId, newPath, isFolder });
    return newPath;
  }

  // ── API ──────────────────────────────────────────────────────────────────

  return {
    pickFolder,
    switchVault,
    initFolder,
    autoInitFolder,
    reload: () => folderPath && reload(folderPath),
    createNote,
    createFolder,
    updateNote,
    deleteNote,
    deleteFolder,
    renameNode,
    openFolderNote,
    moveNode,
    flushPendingWrite,
  };
}
