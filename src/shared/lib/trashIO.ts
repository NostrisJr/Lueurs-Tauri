/**
 * trashIO.ts — Corbeille applicative iOS (<vault>/.trash).
 *
 * macOS utilise la Corbeille Finder, Android supprime définitivement : ce module
 * n'est chargé que par la branche iOS de vaultIO.delete().
 *
 * Le manifeste (.trash/trash-manifest.json) associe chaque élément trashé à son
 * emplacement d'origine, pour permettre une restauration exacte. Un élément
 * présent dans .trash sans entrée de manifeste (dépôt manuel via l'app Fichiers,
 * ou corbeille créée avant ce mécanisme) se restaure à la racine du vault.
 *
 * Le nom du manifeste ne commence volontairement pas par un point : le scope FS
 * Tauri autorise un seul niveau de préfixe point (**\/.* et **\/.*\/**), pas un
 * fichier point imbriqué dans un dossier point — .trash/.manifest.json est donc
 * hors scope et l'écriture échoue avec "forbidden path". loadTree ignore de toute
 * façon les fichiers non-.md/non-média, donc trash-manifest.json reste invisible
 * dans l'arbre de la corbeille malgré l'absence de point.
 */
import { mkdir, remove } from "@tauri-apps/plugin-fs";
import type { TreeNode } from "../hooks/useFileTree";
import { createLogger } from "./logger";
import { loadTree, resolveDestName, vaultIO } from "./vaultIO";

const log = createLogger("trashIO");

export const TRASH_DIR_NAME = ".trash";
const MANIFEST_FILE_NAME = "trash-manifest.json";

export interface TrashManifestEntry {
  originalParentPath: string;
  originalName: string;
  kind: "file" | "folder";
  deletedAt: number;
}

type TrashManifest = Record<string, TrashManifestEntry>;

export function trashDirPath(vaultPath: string): string {
  return `${vaultPath}/${TRASH_DIR_NAME}`;
}

function manifestPath(vaultPath: string): string {
  return `${trashDirPath(vaultPath)}/${MANIFEST_FILE_NAME}`;
}

async function ensureTrashDir(vaultPath: string): Promise<string> {
  const dir = trashDirPath(vaultPath);
  // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
  await mkdir(dir, { baseDir: null, recursive: true } as any);
  return dir;
}

async function readManifest(vaultPath: string): Promise<TrashManifest> {
  try {
    const raw = await vaultIO.readFile(manifestPath(vaultPath));
    return JSON.parse(raw) as TrashManifest;
  } catch {
    return {};
  }
}

async function writeManifest(
  vaultPath: string,
  manifest: TrashManifest
): Promise<void> {
  await ensureTrashDir(vaultPath);
  await vaultIO.writeFile(manifestPath(vaultPath), JSON.stringify(manifest));
}

// Déplace une note/dossier vers <vault>/.trash et enregistre son emplacement
// d'origine dans le manifeste.
export async function moveToAppTrash(
  vaultPath: string,
  uri: string,
  kind: "file" | "folder"
): Promise<void> {
  // Lancé en parallèle : la lecture du manifeste ne dépend pas du dossier
  // corbeille (elle tolère son absence, cf. readManifest) ni du déplacement.
  const manifestPromise = readManifest(vaultPath);

  const dir = await ensureTrashDir(vaultPath);
  const parts = uri.split("/");
  const originalName = parts[parts.length - 1] as string;
  const originalParentPath = parts.slice(0, -1).join("/");
  const destName = await resolveDestName(dir, originalName);

  await vaultIO.move(uri, `${dir}/${destName}`);

  const manifest = await manifestPromise;
  manifest[destName] = {
    originalParentPath,
    originalName,
    kind,
    deletedAt: Date.now(),
  };
  await writeManifest(vaultPath, manifest);
  log.info("déplacé vers la corbeille", { uri, destName, kind });
}

// Charge le contenu de la corbeille sous forme d'arbre, pour affichage en lecture seule.
export async function loadTrashTree(vaultPath: string): Promise<TreeNode[]> {
  try {
    return await loadTree(trashDirPath(vaultPath), vaultPath);
  } catch {
    return [];
  }
}

// Restaure un élément à son emplacement d'origine (ou à la racine du vault si
// son entrée de manifeste est introuvable). Retourne le chemin final.
export async function restoreFromTrash(
  vaultPath: string,
  trashName: string
): Promise<string> {
  const manifest = await readManifest(vaultPath);
  const entry = manifest[trashName];
  const destParent = entry?.originalParentPath || vaultPath;
  const destName = entry?.originalName ?? trashName;

  // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
  await mkdir(destParent, { baseDir: null, recursive: true } as any);
  const resolvedName = await resolveDestName(destParent, destName);
  const destPath = `${destParent}/${resolvedName}`;

  await vaultIO.move(`${trashDirPath(vaultPath)}/${trashName}`, destPath);

  if (entry) {
    delete manifest[trashName];
    await writeManifest(vaultPath, manifest);
  }
  log.info("restauré depuis la corbeille", { trashName, destPath });
  return destPath;
}

// Vide entièrement la corbeille : suppression définitive et irréversible de tout son contenu.
export async function emptyTrash(vaultPath: string): Promise<void> {
  // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
  await remove(trashDirPath(vaultPath), { baseDir: null, recursive: true } as any);
  log.info("corbeille vidée");
}

// Suppression définitive et irréversible d'un élément de la corbeille.
export async function permanentlyDeleteFromTrash(
  vaultPath: string,
  trashName: string
): Promise<void> {
  const path = `${trashDirPath(vaultPath)}/${trashName}`;
  const [, manifest] = await Promise.all([
    // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
    remove(path, { baseDir: null, recursive: true } as any),
    readManifest(vaultPath),
  ]);
  if (manifest[trashName]) {
    delete manifest[trashName];
    await writeManifest(vaultPath, manifest);
  }
  log.info("suppression définitive", { trashName });
}
