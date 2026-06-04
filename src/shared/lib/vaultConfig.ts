/**
 * vaultConfig — Marqueur de racine de vault (`.lueurs/config.json`).
 *
 * Rôle :
 *  - Identifier de façon non-ambiguë la racine du vault, indépendamment de ce que
 *    le picker système renvoie. Cross-plateforme : le marqueur voyage avec les
 *    données via iCloud, donc tous les devices convergent vers la même racine.
 *  - Stocker des métadonnées au niveau vault (vaultId, plus tard : spaces).
 *
 * Le dossier `.lueurs/` est filtré par `loadTree` (cf. `vaultIO.ts`) — invisible
 * dans l'arborescence côté UI.
 *
 * Android : non géré pour l'instant (SAF ne permet pas de walker l'arbre vers
 * le haut au-delà du dossier racine permissionné — cf. point d'attention).
 */

import {
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { createLogger } from "./logger";
import { isAndroid } from "./platform";

const log = createLogger("vaultConfig");

const CONFIG_DIR = ".lueurs";
const CONFIG_FILE = "config.json";
const CURRENT_VERSION = 1;

export interface VaultSpace {
  // Identifiant stable pour React (non utilisé comme clé métier — le nom est la clé métier)
  id: string;
  // Identifiant unique ET label d'affichage (utilisé dans __space__ du frontmatter)
  name: string;
  icon?: string;
  // Couleur accent de la sidebar (hex, ex. "#6366f1")
  color?: string;
  // Afficher uniquement l'icône dans le sélecteur (nécessite icon)
  iconOnly?: boolean;
}

export interface VaultConfig {
  version: number;
  vaultId: string;
  spaces: VaultSpace[];
}

function makeDefaultConfig(): VaultConfig {
  return {
    version: CURRENT_VERSION,
    vaultId: crypto.randomUUID(),
    spaces: [],
  };
}

function configDirPath(vaultRoot: string): string {
  return `${vaultRoot}/${CONFIG_DIR}`;
}

function configFilePath(vaultRoot: string): string {
  return `${configDirPath(vaultRoot)}/${CONFIG_FILE}`;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
    return await exists(path, { baseDir: null } as any);
  } catch {
    return false;
  }
}

/** Lit le config à `vaultRoot/.lueurs/config.json`, ou null si absent/illisible. */
export async function readVaultConfig(
  vaultRoot: string
): Promise<VaultConfig | null> {
  if (isAndroid) return null;
  const filePath = configFilePath(vaultRoot);
  try {
    // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
    const raw = await readTextFile(filePath, { baseDir: null } as any);
    const parsed = JSON.parse(raw) as VaultConfig;
    if (
      typeof parsed?.version !== "number" ||
      typeof parsed?.vaultId !== "string" ||
      !Array.isArray(parsed?.spaces)
    ) {
      log.warn("config marqueur invalide", { filePath });
      return null;
    }
    // Migration : assigner un id aux espaces qui n'en ont pas (configs antérieures)
    const needsMigration = parsed.spaces.some((s) => !s.id);
    if (needsMigration) {
      parsed.spaces = parsed.spaces.map((s) =>
        s.id ? s : { ...s, id: crypto.randomUUID() }
      );
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeVaultConfig(
  vaultRoot: string,
  config: VaultConfig
): Promise<void> {
  if (isAndroid) return;
  const dir = configDirPath(vaultRoot);
  // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
  await mkdir(dir, { baseDir: null, recursive: true } as any);
  await writeTextFile(
    configFilePath(vaultRoot),
    JSON.stringify(config, null, 2),
    // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
    { baseDir: null } as any
  );
  log.info("config marqueur écrite", { vaultRoot, vaultId: config.vaultId });
}

/**
 * Walk-up depuis `startPath` jusqu'à trouver un parent contenant `.lueurs/config.json`.
 * Retourne le chemin du vault root, ou null si aucun marqueur n'est trouvé.
 * Limite : ne dépasse pas la racine système ("/").
 */
export async function findVaultRoot(startPath: string): Promise<string | null> {
  if (isAndroid) return null;
  // Walk-up : on remonte de "/a/b/c" → "/a/b" → "/a" → null
  let current = startPath;
  // Garde-fou contre les boucles infinies
  for (let i = 0; i < 32; i++) {
    if (!current || current === "/") return null;
    if (await pathExists(configFilePath(current))) {
      log.info("vault root détecté via marqueur", { vaultRoot: current });
      return current;
    }
    const parent = current.split("/").slice(0, -1).join("/");
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

/**
 * Crée le marqueur à `vaultRoot` s'il n'existe pas. Migration silencieuse pour
 * les vaults existants : appelé au démarrage par initFolder/autoInitFolder.
 * Idempotent — lit l'existant et le retourne tel quel s'il est déjà là.
 */
export async function ensureVaultConfig(
  vaultRoot: string
): Promise<VaultConfig | null> {
  if (isAndroid) return null;
  const existing = await readVaultConfig(vaultRoot);
  if (existing) return existing;
  const fresh = makeDefaultConfig();
  try {
    await writeVaultConfig(vaultRoot, fresh);
    log.info("vault marqué (migration)", { vaultRoot, vaultId: fresh.vaultId });
    return fresh;
  } catch (err) {
    log.error("échec création marqueur vault", { vaultRoot, err });
    return null;
  }
}

/** Retourne true si `dirName` est le nom du dossier de config — à filtrer dans loadTree. */
export function isConfigDirName(dirName: string): boolean {
  return dirName === CONFIG_DIR;
}
