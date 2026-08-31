import { invoke } from "@tauri-apps/api/core";
/**
 * vaultIO.ts — Lecture/écriture du vault sans état React.
 * Toutes les fonctions sont pures ou async IO, sans hooks.
 *
 * Sur Android : opérations FS via invoke → vault_io.rs → tauri-plugin-android-fs (SAF).
 * Sur les autres plateformes : @tauri-apps/plugin-fs directement.
 */
import { readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { platform } from "@tauri-apps/plugin-os";
import type {
  MediaFile,
  MediaType,
  NoteFile,
  TreeNode,
} from "../hooks/useFileTree";
import { writingPathsRegistry } from "./atoms";
import {
  type Frontmatter,
  computeTemplateProps,
  ensureType,
  extractTags,
  extractTitle,
  flattenTree,
  parseFrontmatter,
  serializeFrontmatter,
  sortNodes,
  toArray,
  updateNodeInTree,
} from "./fileTreeHelpers";
import { isFormula } from "./formulas";
import { createLogger } from "./logger";
import { NoteType, SystemField } from "./noteTypes";
import { isAndroid, isMacOS } from "./platform";

const log = createLogger("vaultIO");

// ── Interface unifiée ──────────────────────────────────────────────────────────
//
// uri : content:// URI sur Android, chemin POSIX absolu sur les autres plateformes.

export interface VaultEntry {
  name: string;
  uri: string;
  isDir: boolean;
}

export const vaultIO = {
  async readDir(uri: string): Promise<VaultEntry[]> {
    if (isAndroid) {
      return invoke<VaultEntry[]>("vault_read_dir", { uri });
    }
    // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
    const entries = await readDir(uri, { baseDir: null } as any);
    return entries
      .filter((e) => e.name != null)
      .map((e) => ({
        name: e.name as string,
        uri: `${uri}/${e.name}`,
        isDir: !!e.isDirectory,
      }));
  },

  async readFile(uri: string): Promise<string> {
    if (isAndroid) {
      return invoke<string>("vault_read_file", { uri });
    }
    // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
    return readTextFile(uri, { baseDir: null } as any);
  },

  async writeFile(uri: string, content: string): Promise<void> {
    if (isAndroid) {
      return invoke<void>("vault_write_file", { uri, content });
    }
    // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
    return writeTextFile(uri, content, { baseDir: null } as any);
  },

  // Crée un fichier vide et retourne son URI/chemin.
  async createFile(parentUri: string, name: string): Promise<string> {
    if (isAndroid) {
      return invoke<string>("vault_create_file", { parentUri, name });
    }
    const path = `${parentUri}/${name}`;
    // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
    await writeTextFile(path, "", { baseDir: null } as any);
    return path;
  },

  // Crée un dossier et retourne son URI/chemin.
  async createDir(parentUri: string, name: string): Promise<string> {
    if (isAndroid) {
      return invoke<string>("vault_create_dir", { parentUri, name });
    }
    const { mkdir } = await import("@tauri-apps/plugin-fs");
    const path = `${parentUri}/${name}`;
    // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
    await mkdir(path, { baseDir: null } as any);
    return path;
  },

  // Déplace un fichier ou dossier vers un chemin de destination complet.
  // Contrairement à rename() qui change uniquement le nom dans le même dossier,
  // move() peut changer de dossier parent.
  async move(sourceUri: string, destUri: string): Promise<void> {
    if (isAndroid) {
      throw new Error("vaultIO.move non supporté sur Android");
    }
    const { rename } = await import("@tauri-apps/plugin-fs");
    // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
    await rename(sourceUri, destUri, { baseDir: null } as any);
  },

  // Renomme et retourne le nouvel URI/chemin.
  async rename(uri: string, newName: string): Promise<string> {
    if (isAndroid) {
      return invoke<string>("vault_rename", { uri, newName });
    }
    const { rename } = await import("@tauri-apps/plugin-fs");
    const parts = uri.split("/");
    parts[parts.length - 1] = newName;
    const newUri = parts.join("/");
    // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
    await rename(uri, newUri, { baseDir: null } as any);
    return newUri;
  },

  // Sur Android : suppression définitive. Sur macOS : corbeille Finder (via osascript côté JS).
  // Sur iOS : pas d'osascript ni de corbeille système accessible → corbeille applicative
  // dans <vault>/.trash, consultable/restaurable depuis Réglages > Corbeille (trashIO.ts).
  async delete(
    uri: string,
    vaultPath?: string,
    kind: "file" | "folder" = "file"
  ): Promise<void> {
    if (isAndroid) {
      return invoke<void>("vault_delete", { uri });
    }
    if (isMacOS) {
      const { moveToTrash } = await import("./fileTreeHelpers");
      return moveToTrash(uri);
    }
    if (!vaultPath) {
      throw new Error("vaultPath requis pour la corbeille applicative iOS");
    }
    const { moveToAppTrash } = await import("./trashIO");
    await moveToAppTrash(vaultPath, uri, kind);
  },

  // Ouvre le picker SAF sur Android. Sur les autres plateformes, retourne null
  // (le picker est géré par useFileTree.pickFolder via @tauri-apps/plugin-dialog).
  async pickRoot(): Promise<string | null> {
    if (isAndroid) {
      return invoke<string | null>("vault_pick_dir");
    }
    return null;
  },

  // Copie un fichier externe dans resources/{subDir}/ du vault.
  // Retourne le chemin absolu de destination (à relativiser côté appelant).
  async copyResourceToVault(
    srcPath: string,
    vaultPath: string,
    subDir: "images" | "audio"
  ): Promise<string> {
    const filename = srcPath.split(/[/\\]/).pop() ?? "resource";
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    return invoke<string>("copy_resource_to_vault", {
      srcPath,
      vaultPath,
      subDir,
      filename: safeName,
    });
  },
};

// ── Chemins relatifs ───────────────────────────────────────────────────────────
//
// Sur disque : paths relatifs depuis la racine du vault (ex: "Templates/Mon Template.md")
// En mémoire : paths absolus (ex: "/Users/.../vault/Templates/Mon Template.md")
// Migration automatique : les paths absolus déjà stockés sont reconvertis à la lecture.
// Sur Android : la relativisation est désactivée car les URI SAF ne peuvent pas être
// reconstruits par simple concaténation (encodage URL différent).

const PATH_FIELDS = [
  SystemField.TEMPLATE,
  SystemField.BASE,
  SystemField.CHILDREN,
] as const;

// Détecte les ref() dans les formules pour la conversion de chemins
const FORMULA_REF_RE = /ref\("([^"]+)"\)/g;

function toRelative(absolutePath: string, vaultPath: string): string {
  if (absolutePath.startsWith(`${vaultPath}/`)) {
    return absolutePath.slice(vaultPath.length + 1);
  }
  return absolutePath;
}

// Détection des paths iCloud d'une autre plateforme pointant sur le même container.
// Permet de récupérer les __Children__/__Template__/__Base__ corrompus écrits en absolu
// sur l'une et lus sur l'autre.
const ICLOUD_CONTAINER_RE =
  /\/Mobile Documents\/(iCloud~[^/]+)\/Documents(\/|$)/;

function migrateCrossPlatformICloudPath(
  path: string,
  vaultPath: string
): string {
  if (!path.startsWith("/")) return path;
  if (path.startsWith(`${vaultPath}/`) || path === vaultPath) return path;

  const pathMatch = path.match(ICLOUD_CONTAINER_RE);
  if (!pathMatch) return path;
  const vaultMatch = vaultPath.match(ICLOUD_CONTAINER_RE);
  if (!vaultMatch || vaultMatch[1] !== pathMatch[1]) return path;

  const pathSuffix = path.slice((pathMatch.index ?? 0) + pathMatch[0].length);
  const vaultSuffix = vaultPath.slice(
    (vaultMatch.index ?? 0) + vaultMatch[0].length
  );

  // Vault à la racine du container Documents
  if (vaultSuffix === "") {
    return pathSuffix === "" ? vaultPath : `${vaultPath}/${pathSuffix}`;
  }
  // Vault dans un sous-dossier : le path doit y être pour être rebasé
  if (pathSuffix === vaultSuffix) return vaultPath;
  if (pathSuffix.startsWith(`${vaultSuffix}/`)) {
    return `${vaultPath}/${pathSuffix.slice(vaultSuffix.length + 1)}`;
  }
  // Path sous le même container mais hors du vault courant → garde absolu
  return path;
}

function toAbsolute(path: string, vaultPath: string): string {
  // Chemin déjà absolu → migration cross-plateforme si applicable, sinon tel quel
  if (path.startsWith("/"))
    return migrateCrossPlatformICloudPath(path, vaultPath);
  return `${vaultPath}/${path}`;
}

export function absolutifyPathFields(
  frontmatter: Frontmatter,
  vaultPath: string
): Frontmatter {
  // Sur Android, les URI SAF sont déjà absolus et non relativisables
  if (isAndroid) return frontmatter;
  const result = { ...frontmatter };
  for (const field of PATH_FIELDS) {
    const val = result[field];
    if (!val) continue;
    const paths = toArray(val).filter(
      (p) => p && !(p as string).startsWith("[")
    );
    result[field] = paths.map((p) => toAbsolute(p as string, vaultPath));
  }
  // Absolutifier les chemins ref() dans les formules
  for (const [key, val] of Object.entries(result)) {
    if (typeof val === "string" && isFormula(val)) {
      FORMULA_REF_RE.lastIndex = 0;
      result[key] = val.replace(
        FORMULA_REF_RE,
        (_, p: string) => `ref("${toAbsolute(p, vaultPath)}")`
      );
    }
  }
  return result;
}

export function relativizePathFields(
  frontmatter: Frontmatter,
  vaultPath: string
): Frontmatter {
  // Sur Android, les URI SAF sont propres à l'appareil — pas de relativisation
  if (isAndroid) return frontmatter;
  const result = { ...frontmatter };
  for (const field of PATH_FIELDS) {
    const val = result[field];
    if (!val) continue;
    result[field] = toArray(val).map((p) => toRelative(p as string, vaultPath));
  }
  // Relativiser les chemins ref() dans les formules
  for (const [key, val] of Object.entries(result)) {
    if (typeof val === "string" && isFormula(val)) {
      FORMULA_REF_RE.lastIndex = 0;
      result[key] = val.replace(
        FORMULA_REF_RE,
        (_, p: string) => `ref("${toRelative(p, vaultPath)}")`
      );
    }
  }
  return result;
}

// ── Parsing d'une note ─────────────────────────────────────────────────────────

export function noteFromRaw(
  fullPath: string,
  fileName: string,
  rawContent: string,
  vaultPath?: string
): NoteFile {
  const noteName = fileName.replace(/\.md$/, "");
  const pathParts = fullPath.split("/");
  const parentFolderName = pathParts[pathParts.length - 2] ?? "";

  const { frontmatter: rawFrontmatter, body } = parseFrontmatter(rawContent);
  const baseFrontmatter = ensureType(
    rawFrontmatter,
    noteName,
    parentFolderName
  );
  const frontmatter = vaultPath
    ? absolutifyPathFields(baseFrontmatter, vaultPath)
    : baseFrontmatter;

  if (!rawFrontmatter.__Type__ && frontmatter.__Type__) {
    log.info("__Type__ injecté automatiquement", {
      path: fullPath,
      type: frontmatter.__Type__,
    });
  }

  return {
    kind: "file",
    id: fullPath,
    name: noteName,
    type: (frontmatter.__Type__ as string) ?? null,
    title: extractTitle(body),
    body,
    frontmatter,
    tags: extractTags(rawContent),
    updatedAt: new Date(),
  };
}

// ── Extensions médias reconnues ───────────────────────────────────────────────

const MEDIA_EXTENSIONS: Record<string, MediaType> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
  ogg: "audio",
  aac: "audio",
  mp4: "video",
  mov: "video",
  webm: "video",
  pdf: "pdf",
};

export function getMediaType(fileName: string): MediaType | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MEDIA_EXTENSIONS[ext] ?? null;
}

// ── Chargement récursif ────────────────────────────────────────────────────────

export async function loadTree(
  dirPath: string,
  vaultPath?: string,
  showResources = false
): Promise<TreeNode[]> {
  const entries = await vaultIO.readDir(dirPath);
  const nodes: TreeNode[] = [];

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.name || entry.name.startsWith(".")) return;
      if (entry.isDir && entry.name === "config") return;
      if (entry.isDir && entry.name === "resources" && !showResources) return;

      const fullPath = entry.uri;

      if (entry.isDir) {
        const children = await loadTree(fullPath, vaultPath, showResources);
        nodes.push({
          kind: "folder",
          id: fullPath,
          name: entry.name,
          children: sortNodes(children),
        });
      } else if (entry.name.endsWith(".md")) {
        const rawContent = await vaultIO.readFile(fullPath);
        const note = noteFromRaw(fullPath, entry.name, rawContent, vaultPath);

        // Persister __Type__ si absent
        if (!parseFrontmatter(rawContent).frontmatter.__Type__) {
          const diskFrontmatter = vaultPath
            ? relativizePathFields(note.frontmatter, vaultPath)
            : note.frontmatter;
          const raw = serializeFrontmatter(diskFrontmatter, note.body);
          vaultIO
            .writeFile(fullPath, raw)
            .catch((err) =>
              log.error("échec persistance __Type__", { path: fullPath, err })
            );
        }

        nodes.push(note);
      } else {
        const mediaType = getMediaType(entry.name);
        if (mediaType) {
          const dotIdx = entry.name.lastIndexOf(".");
          const name = dotIdx > 0 ? entry.name.slice(0, dotIdx) : entry.name;
          const mediaFile: MediaFile = {
            kind: "media",
            id: fullPath,
            name,
            fileName: entry.name,
            mediaType,
          };
          nodes.push(mediaFile);
        }
      }
    })
  );

  return sortNodes(nodes);
}

// ── Application des templates ──────────────────────────────────────────────────

/**
 * Résout les templates pour toutes les notes du vault après chargement complet.
 * Trie les notes par priorité (templates → bases → notes) pour garantir que
 * les templates des bases sont résolus avant d'être appliqués aux enfants.
 * Retourne l'arbre final et écrit les fichiers modifiés sur le disque.
 */
export async function applyAllTemplates(
  nodes: TreeNode[],
  vaultPath?: string
): Promise<TreeNode[]> {
  const allNotes = flattenTree(nodes);

  // Ordre de résolution : __template__ d'abord, puis __base__, puis le reste
  const priority = (n: NoteFile) => {
    if (n.type === NoteType.TEMPLATE) return 0;
    if (n.type === NoteType.BASE) return 1;
    return 2;
  };
  const sorted = [...allNotes].sort((a, b) => priority(a) - priority(b));

  // Map mutable pour avoir les frontmatters à jour au fur et à mesure
  const resolved = new Map<string, Frontmatter>(
    allNotes.map((n) => [n.id, n.frontmatter])
  );

  const toWrite: { path: string; frontmatter: Frontmatter; body: string }[] =
    [];

  for (const note of sorted) {
    const fm = resolved.get(note.id) ?? {};

    const directTemplates = toArray(fm.__Template__);
    const parentBases = toArray(fm.__Base__);
    const inheritedTemplates = parentBases.flatMap((basePath) => {
      const baseFm = resolved.get(basePath);
      return baseFm ? toArray(baseFm.__Template__) : [];
    });

    const allTemplatePaths = [
      ...new Set([...directTemplates, ...inheritedTemplates]),
    ];
    if (allTemplatePaths.length === 0) continue;

    // Les bases ne reçoivent pas les props du template — sert uniquement à templater leurs enfants
    if (note.type === NoteType.BASE) continue;

    const templates = allTemplatePaths
      .map((tp) => resolved.get(tp))
      .filter((f): f is Frontmatter => !!f);

    const { updated, changed } = computeTemplateProps(fm, templates, {
      applyForced: false,
    });
    if (changed.length === 0) continue;

    log.info("propriétés template appliquées", { noteId: note.id, changed });
    resolved.set(note.id, updated);
    toWrite.push({ path: note.id, frontmatter: updated, body: note.body });
  }

  if (toWrite.length === 0) return nodes;

  // Persister sur le disque avec paths relatifs
  await Promise.all(
    toWrite.map(({ path, frontmatter, body }) => {
      const diskFrontmatter = vaultPath
        ? relativizePathFields(frontmatter, vaultPath)
        : frontmatter;
      const raw = serializeFrontmatter(diskFrontmatter, body);
      return vaultIO
        .writeFile(path, raw)
        .catch((err) =>
          log.error("échec persistance props template", { path, err })
        );
    })
  );

  // Mettre à jour l'arbre en mémoire (paths absolus conservés)
  let finalNodes = nodes;
  for (const { path, frontmatter } of toWrite) {
    finalNodes = updateNodeInTree(finalNodes, path, {
      frontmatter,
    }) as TreeNode[];
  }
  return finalNodes;
}

// ── Écriture unitaire ──────────────────────────────────────────────────────────

/**
 * Écrit un patch frontmatter avec mise à jour optimiste immédiate.
 * Sur Android : écrit directement via SAF (pas de vault:patch event).
 * Sur les autres plateformes : passe par Rust update_note qui émet vault:patch.
 */
export async function persistNotePatch(
  noteId: string,
  frontmatter: Frontmatter,
  body: string,
  setTree: (updater: (prev: TreeNode[]) => TreeNode[]) => void,
  vaultPath?: string
): Promise<void> {
  // Optimistic — UI immédiat, frontmatter avec paths absolus. Le corps aussi :
  // les appelants qui le réécrivent (propagation de renommage note/propriété)
  // laisseraient sinon l'arbre sur l'ancienne version, réécrite au prochain
  // updateNote de la note.
  setTree((prev) => updateNodeInTree(prev, noteId, { frontmatter, body }));

  const diskFrontmatter = vaultPath
    ? relativizePathFields(frontmatter, vaultPath)
    : frontmatter;
  const raw = serializeFrontmatter(diskFrontmatter, body);

  writingPathsRegistry.add(noteId);
  try {
    if (isAndroid) {
      // SAF : écriture directe, pas de vault:patch event (optimistic update suffit)
      await vaultIO.writeFile(noteId, raw);
    } else {
      // Rust update_note émet vault:patch pour la réconciliation multi-fenêtres desktop
      await invoke("update_note", { id: noteId, rawContent: raw });
    }
    log.info("patch persisté", { noteId });
  } finally {
    writingPathsRegistry.delete(noteId);
  }
}

// ── Résolution de conflits de nom ──────────────────────────────────────────────

/**
 * Retourne un nom sans conflit dans destFolderPath.
 * Si "note.md" existe déjà → "note (2).md", "note (3).md", etc.
 */
export async function resolveDestName(
  destFolderPath: string,
  name: string
): Promise<string> {
  let entries: VaultEntry[] = [];
  try {
    entries = await vaultIO.readDir(destFolderPath);
  } catch {
    return name;
  }
  const existing = new Set(entries.map((e) => e.name));
  if (!existing.has(name)) return name;

  const isNote = name.endsWith(".md");
  const base = isNote ? name.slice(0, -3) : name;
  const ext = isNote ? ".md" : "";
  let i = 2;
  while (existing.has(`${base} (${i})${ext}`)) i++;
  return `${base} (${i})${ext}`;
}

// ── Scope Tauri ────────────────────────────────────────────────────────────────

export async function allowVaultScope(vaultPath: string): Promise<void> {
  // FS scope = mécanisme desktop uniquement
  // iOS : le sandbox accorde déjà l'accès au container iCloud
  // Android : les permissions SAF sont gérées par vault_pick_dir (persist_uri_permission)
  if (platform() === "ios" || isAndroid) return;
  log.info("autorisation scope vault", { vaultPath });
  try {
    await invoke("allow_vault_path", { vaultPath });
    log.info("scope vault autorisé", { vaultPath });
  } catch (err) {
    log.error("échec allow_vault_path", err);
    throw err;
  }
}
