import { invoke } from "@tauri-apps/api/core";
import { documentDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { watchImmediate } from "@tauri-apps/plugin-fs";
import { platform } from "@tauri-apps/plugin-os";
import type { useStore } from "jotai";

import type { FolderNode, NoteFile } from "../hooks/useFileTree";
import {
  activeNoteIdAtom,
  errorAtom,
  folderPathAtom,
  loadingAtom,
  treeAtom,
  writingPathsRegistry,
} from "./atoms";
import {
  type Frontmatter,
  addNodeInTree,
  deleteNodeInTree,
  ensureType,
  extractTags,
  extractTitle,
  findNextAvailableNumber,
  flattenTree,
  renameNodeInTree,
  serializeFrontmatter,
  updateFolderInTree,
  updateNodeInTree,
} from "./fileTreeHelpers";
import { createLogger } from "./logger";
import { NoteType } from "./noteTypes";
import { isAndroid } from "./platform";
import { ensureVaultConfig, findVaultRoot } from "./vaultConfig";
import {
  allowVaultScope,
  applyAllTemplates,
  loadTree,
  relativizePathFields,
  resolveDestName,
  vaultIO,
} from "./vaultIO";

type JotaiStore = ReturnType<typeof useStore>;

const DEBOUNCE_MS = 1000;
const log = createLogger("fileTreeMutations");

// ── Singletons partagés entre toutes les instances de useFileTree ──────────
// Indispensable : chaque appel à useFileTree() crée son propre hook mais
// debounceTimers/reloadTimer/unwatcher doivent être uniques au niveau process
// pour éviter les races d'écriture (cf. Audit C1).

const debounceTimers = new Map<
  string,
  { timer: ReturnType<typeof setTimeout>; flush: () => Promise<void> }
>();
let reloadTimer: ReturnType<typeof setTimeout> | null = null;
let unwatcher: (() => void) | null = null;

// ── Helpers URI ────────────────────────────────────────────────────────────
// Extraient le nom de fichier et le dossier parent depuis un chemin POSIX
// ou un URI SAF Android (content://.../.../document/primary%3ANotes%2FNote.md).

function uriBaseName(uri: string): string {
  const last = decodeURIComponent(uri.split("/").pop() ?? "");
  const name = last.includes("/") ? (last.split("/").pop() ?? last) : last;
  return name.replace(/\.md$/, "");
}

function uriParentName(uri: string): string {
  const last = decodeURIComponent(uri.split("/").pop() ?? "");
  if (last.includes("/")) {
    const parts = last.split("/");
    return parts[parts.length - 2] ?? "";
  }
  const parts = uri.split("/");
  return parts[parts.length - 2] ?? "";
}

// ── Chargement ─────────────────────────────────────────────────────────────

export async function reload(store: JotaiStore, path: string): Promise<void> {
  store.set(loadingAtom, true);
  store.set(errorAtom, null);
  try {
    const nodes = await loadTree(path, path);
    const finalNodes = await applyAllTemplates(nodes, path);
    store.set(treeAtom, finalNodes);
  } catch (e) {
    store.set(
      errorAtom,
      `Impossible de lire le dossier : ${e instanceof Error ? e.message : String(e)}`
    );
    store.set(treeAtom, []);
  } finally {
    store.set(loadingAtom, false);
  }
}

// ── Watcher FS ─────────────────────────────────────────────────────────────

export async function startWatcher(
  store: JotaiStore,
  path: string
): Promise<void> {
  // Android : pas de watcher FS (SAF ne supporte pas inotify)
  if (isAndroid) return;

  if (unwatcher) {
    unwatcher();
    unwatcher = null;
  }

  try {
    const unwatch = await watchImmediate(
      path,
      (event) => {
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
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
          reloadTimer = null;
          reload(store, path);
        }, 300);
      },
      { recursive: true }
    );
    unwatcher = unwatch;
    log.info("watcher FS démarré", { path });
  } catch (err) {
    log.warn("watcher FS indisponible", { err });
  }
}

export function stopWatcher(): void {
  if (unwatcher) {
    unwatcher();
    unwatcher = null;
  }
  if (reloadTimer) {
    clearTimeout(reloadTimer);
    reloadTimer = null;
  }
}

// ── Init / switch vault ────────────────────────────────────────────────────

/**
 * Résout la racine "officielle" du vault depuis un chemin sélectionné par l'utilisateur :
 *  - walk-up à la recherche de `.lueurs/config.json` → racine = ce parent
 *  - sinon racine = chemin sélectionné, et on crée le marqueur (init silencieux)
 *
 * Sur Android, on garde le path tel quel (SAF ne permet pas de walker au-dessus du
 * dossier permissionné). Retourne le path final à utiliser comme `folderPathAtom`.
 */
async function resolveVaultRoot(selectedPath: string): Promise<string> {
  if (isAndroid) return selectedPath;
  const found = await findVaultRoot(selectedPath);
  if (found) return found;
  await ensureVaultConfig(selectedPath);
  return selectedPath;
}

export async function initFolder(store: JotaiStore): Promise<void> {
  const folderPath = store.get(folderPathAtom);
  if (!folderPath) return;
  log.info("restauration vault au démarrage", { folderPath });
  await allowVaultScope(folderPath);
  // Migration : si le marqueur n'existe pas encore (vault pré-marqueur), le créer
  // au niveau du folderPath actuel — comportement strictement identique à avant.
  if (!isAndroid) await ensureVaultConfig(folderPath);
  await reload(store, folderPath);
  await startWatcher(store, folderPath);
}

export async function autoInitFolder(store: JotaiStore): Promise<void> {
  const icloudPath = await invoke<string | null>("get_icloud_path");
  if (!icloudPath) return;
  // Re-vérification après l'await : Jotai peut avoir hydraté folderPathAtom depuis
  // localStorage pendant l'invoke. Si un chemin est déjà là, on ne l'écrase pas.
  if (store.get(folderPathAtom)) return;
  const resolved = await resolveVaultRoot(icloudPath);
  log.info("vault iCloud auto-initialisé", { icloudPath, resolved });
  await allowVaultScope(resolved);
  store.set(activeNoteIdAtom, null);
  store.set(errorAtom, null);
  store.set(folderPathAtom, resolved);
  await reload(store, resolved);
  await startWatcher(store, resolved);
}

export async function switchVault(
  store: JotaiStore,
  path: string
): Promise<void> {
  // Résout vers le vrai vault root via le marqueur si présent, sinon initialise.
  // Permet de pointer le picker sur n'importe quel sous-dossier d'un vault existant.
  const resolved = await resolveVaultRoot(path);
  if (resolved !== path) {
    log.info("vault root résolu via marqueur", { picked: path, resolved });
  }
  await allowVaultScope(resolved);
  store.set(activeNoteIdAtom, null);
  store.set(errorAtom, null);
  store.set(folderPathAtom, resolved);
  await reload(store, resolved);
  await startWatcher(store, resolved);
}

export async function pickFolder(store: JotaiStore): Promise<void> {
  let selected: string;

  const currentPlatform = platform();
  if (currentPlatform === "ios") {
    const icloudPath = await invoke<string | null>("get_icloud_path");
    selected = icloudPath ?? (await documentDir());
    log.info("vault iOS", { selected, icloud: !!icloudPath });
  } else if (currentPlatform === "android") {
    const result = await vaultIO.pickRoot();
    if (!result) {
      log.info("vault Android: sélection annulée");
      return;
    }
    log.info("vault Android sélectionné", { uri: result });
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
      log.info("dialog open résultat", {
        result,
        type: typeof result,
        platform: currentPlatform,
      });
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

  await switchVault(store, selected);
}

// ── Note __folder__ ────────────────────────────────────────────────────────

export async function openFolderNote(
  store: JotaiStore,
  folderNode: FolderNode
): Promise<NoteFile> {
  const folderName = folderNode.name;

  const existing = folderNode.children.find(
    (n): n is NoteFile => n.kind === "file" && n.name === folderName
  );
  if (existing) return existing;

  const frontmatter: Frontmatter = { __Type__: NoteType.FOLDER };
  const body = "";
  const raw = serializeFrontmatter(frontmatter, body);

  let filePath: string;
  if (isAndroid) {
    filePath = await vaultIO.createFile(folderNode.id, `${folderName}.md`);
    await vaultIO.writeFile(filePath, raw);
  } else {
    filePath = `${folderNode.id}/${folderName}.md`;
    await vaultIO.writeFile(filePath, raw);
  }
  log.info("création note __folder__", { path: filePath });

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

  const folderPath = store.get(folderPathAtom);
  store.set(treeAtom, (prev) =>
    addNodeInTree(prev, folderNode.id, newNote, folderPath ?? undefined)
  );
  return newNote;
}

// ── Écriture ────────────────────────────────────────────────────────────────

export function updateNote(
  store: JotaiStore,
  fileId: string,
  body: string,
  frontmatter: Frontmatter,
  onPersisted?: () => void
): void {
  // Extraction du nom compatible avec les URI SAF Android et les chemins POSIX
  const noteName = uriBaseName(fileId);
  const parentFolderName = uriParentName(fileId);
  const safeFrontmatter = ensureType(frontmatter, noteName, parentFolderName);

  // Mémoire : paths absolus. Disque : paths relatifs au vault. Sans relativiser
  // ici, les champs __Children__/__Template__/__Base__ partent en absolu sur le
  // disque et cassent les bases au sync cross-plateforme (Mac ↔ iOS via iCloud).
  const vaultPath = store.get(folderPathAtom) ?? undefined;
  const diskFrontmatter = vaultPath
    ? relativizePathFields(safeFrontmatter, vaultPath)
    : safeFrontmatter;
  const raw = serializeFrontmatter(diskFrontmatter, body);

  // Mise à jour mémoire immédiate
  store.set(treeAtom, (prev) =>
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
    await vaultIO.writeFile(fileId, raw);
    writingPathsRegistry.delete(fileId);
    log.info("note persistée", { fileId });
    onPersisted?.();
  };
  const existing = debounceTimers.get(fileId);
  if (existing) clearTimeout(existing.timer);
  debounceTimers.set(fileId, {
    timer: setTimeout(async () => {
      debounceTimers.delete(fileId);
      await flush();
    }, DEBOUNCE_MS),
    flush,
  });
}

// Flush immédiat d'un write en attente — à appeler avant tout rename/move
export async function flushPendingWrite(fileId: string): Promise<void> {
  const entry = debounceTimers.get(fileId);
  if (!entry) return;
  clearTimeout(entry.timer);
  debounceTimers.delete(fileId);
  await entry.flush();
}

// ── Création ────────────────────────────────────────────────────────────────

export async function createNote(
  store: JotaiStore,
  dirPath: string
): Promise<NoteFile> {
  const entries = await vaultIO.readDir(dirPath);
  const number = await findNextAvailableNumber(entries, "Nouvelle note", false);
  const fileName = `Nouvelle note ${number}.md`;
  const frontmatter: Frontmatter = { __Type__: NoteType.NOTE };
  const body = "";
  const content = serializeFrontmatter(frontmatter, body);

  let filePath: string;
  if (isAndroid) {
    // SAF : créer d'abord le fichier pour obtenir l'URI, puis écrire le contenu
    filePath = await vaultIO.createFile(dirPath, fileName);
    await vaultIO.writeFile(filePath, content);
  } else {
    filePath = `${dirPath}/${fileName}`;
    await vaultIO.writeFile(filePath, content);
  }

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

  const folderPath = store.get(folderPathAtom);
  store.set(treeAtom, (prev) =>
    addNodeInTree(prev, dirPath, newNote, folderPath ?? undefined)
  );
  return newNote;
}

export async function createFolder(
  store: JotaiStore,
  dirPath: string
): Promise<void> {
  const entries = await vaultIO.readDir(dirPath);
  const number = await findNextAvailableNumber(
    entries,
    "Nouveau dossier",
    true
  );
  const name = `Nouveau dossier ${number}`;
  const fullPath = await vaultIO.createDir(dirPath, name);

  const newNode: FolderNode = {
    kind: "folder",
    id: fullPath,
    name,
    children: [],
  };
  const folderPath = store.get(folderPathAtom);
  store.set(treeAtom, (prev) =>
    addNodeInTree(prev, dirPath, newNode, folderPath ?? undefined)
  );
}

// ── Suppression ────────────────────────────────────────────────────────────

export async function deleteNote(
  store: JotaiStore,
  fileId: string
): Promise<void> {
  writingPathsRegistry.add(fileId);
  store.set(treeAtom, (prev) => deleteNodeInTree(prev, fileId));
  await vaultIO.delete(fileId);
  writingPathsRegistry.delete(fileId);
}

export async function deleteFolder(
  store: JotaiStore,
  folderId: string,
  recursive = false
): Promise<void> {
  if (!recursive) {
    const entries = await vaultIO.readDir(folderId);
    if (entries.filter((e) => !e.name.startsWith(".")).length > 0)
      throw new Error("Le dossier n'est pas vide.");
  }
  writingPathsRegistry.add(folderId);
  store.set(treeAtom, (prev) => deleteNodeInTree(prev, folderId));
  await vaultIO.delete(folderId);
  writingPathsRegistry.delete(folderId);
}

// ── Renommage ──────────────────────────────────────────────────────────────

export async function renameNode(
  store: JotaiStore,
  oldPath: string,
  newName: string,
  isFolder: boolean
): Promise<string> {
  const newFileName = isFolder ? newName : `${newName}.md`;

  if (!isFolder) await flushPendingWrite(oldPath);

  const folderPath = store.get(folderPathAtom);

  if (isAndroid) {
    if (isFolder) {
      // Essayer de renommer la note __folder__ interne avant le dossier
      const oldFolderName = uriBaseName(oldPath);
      try {
        const innerEntries = await vaultIO.readDir(oldPath);
        const folderNote = innerEntries.find(
          (e) => !e.isDir && e.name === `${oldFolderName}.md`
        );
        if (folderNote) await vaultIO.rename(folderNote.uri, `${newName}.md`);
      } catch {
        log.info("pas de note __folder__ à renommer (Android)", {
          folder: oldPath,
        });
      }
      const newPath = await vaultIO.rename(oldPath, newFileName);
      // Les URI SAF des enfants ont changé — recharger l'arbre complet
      if (folderPath) await reload(store, folderPath);
      return newPath;
    }
    const newPath = await vaultIO.rename(oldPath, newFileName);
    store.set(treeAtom, (prev) =>
      renameNodeInTree(prev, oldPath, newPath, newName)
    );
    return newPath;
  }

  // Non-Android : manipulation POSIX classique
  const parts = oldPath.split("/");
  const oldName = parts[parts.length - 1];
  parts[parts.length - 1] = newFileName;
  const newPath = parts.join("/");

  if (isFolder) {
    try {
      await vaultIO.rename(`${oldPath}/${oldName}.md`, `${newName}.md`);
    } catch {
      log.info("pas de note __folder__ à renommer", { folder: oldPath });
    }
    await vaultIO.rename(oldPath, newFileName);
    const updatedChildren = await loadTree(newPath, folderPath ?? undefined);
    store.set(treeAtom, (prev) =>
      updateFolderInTree(prev, oldPath, newPath, newName, updatedChildren)
    );
  } else {
    await vaultIO.rename(oldPath, newFileName);
    store.set(treeAtom, (prev) =>
      renameNodeInTree(prev, oldPath, newPath, newName)
    );
  }

  return newPath;
}

// ── Déplacement d'un nœud vers un autre dossier ────────────────────────────

export async function moveNode(
  store: JotaiStore,
  sourceId: string,
  targetFolderPath: string
): Promise<string | null> {
  // Déplacement non supporté sur Android (SAF ne propose pas de moveDocument unifié)
  if (isAndroid) {
    log.warn("moveNode non supporté sur Android");
    return null;
  }

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
    await vaultIO.rename(sourceId, destName);
  } finally {
    writingPathsRegistry.delete(sourceId);
  }

  const isFolder = !sourceId.endsWith(".md");
  const folderPath = store.get(folderPathAtom);

  if (!isFolder) {
    const note = flattenTree(store.get(treeAtom)).find(
      (n) => n.id === sourceId
    );
    if (note) {
      const movedNote: NoteFile = { ...note, id: newPath };
      store.set(treeAtom, (prev) =>
        addNodeInTree(
          deleteNodeInTree(prev, sourceId),
          targetFolderPath,
          movedNote,
          folderPath ?? undefined
        )
      );
    }
  } else if (folderPath) {
    await reload(store, folderPath);
  }

  log.info("nœud déplacé", { sourceId, newPath, isFolder });
  return newPath;
}
