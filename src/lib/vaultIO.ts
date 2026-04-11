/**
 * vaultIO.ts — Lecture/écriture du vault sans état React.
 * Toutes les fonctions sont pures ou async IO, sans hooks.
 */
import { readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import {
  sortNodes,
  parseFrontmatter,
  serializeFrontmatter,
  ensureType,
  extractTitle,
  extractTags,
  computeTemplateProps,
  toArray,
  flattenTree,
  updateNodeInTree,
  type Frontmatter,
} from "../components/FileTree/lib/fileTreeHelpers";
import { NoteType, SystemField } from "./noteTypes";
import { isFormula } from "./formulas";
import { createLogger } from "./logger";
import type {
  NoteFile,
  TreeNode,
} from "../components/FileTree/hooks/useFileTree";
import { writingPathsRegistry } from "./atoms";

const log = createLogger("vaultIO");

// ── Chemins relatifs ───────────────────────────────────────────────────────
//
// Sur disque : paths relatifs depuis la racine du vault (ex: "Templates/Mon Template.md")
// En mémoire : paths absolus (ex: "/Users/.../vault/Templates/Mon Template.md")
// Migration automatique : les paths absolus déjà stockés sont reconvertis à la lecture.

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

function toAbsolute(path: string, vaultPath: string): string {
  // Chemin déjà absolu → tel quel (ancien format ou chemin hors vault)
  if (path.startsWith("/")) return path;
  return `${vaultPath}/${path}`;
}

export function absolutifyPathFields(
  frontmatter: Frontmatter,
  vaultPath: string
): Frontmatter {
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

// ── Parsing d'une note ─────────────────────────────────────────────────────

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

// ── Chargement récursif ────────────────────────────────────────────────────

export async function loadTree(
  dirPath: string,
  vaultPath?: string
): Promise<TreeNode[]> {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const entries = await readDir(dirPath, { baseDir: null } as any);
  const nodes: TreeNode[] = [];

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.name || entry.name.startsWith(".")) return;
      if (
        entry.isDirectory &&
        (entry.name === "resources" || entry.name === "config")
      )
        return;

      const fullPath = `${dirPath}/${entry.name}`;

      if (entry.isDirectory) {
        const children = await loadTree(fullPath, vaultPath);
        nodes.push({
          kind: "folder",
          id: fullPath,
          name: entry.name,
          children: sortNodes(children),
        });
      } else if (entry.name.endsWith(".md")) {
        const rawContent = await readTextFile(fullPath, {
          baseDir: null,
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        } as any);
        const note = noteFromRaw(fullPath, entry.name, rawContent, vaultPath);

        // Persister __Type__ si absent
        if (!parseFrontmatter(rawContent).frontmatter.__Type__) {
          const diskFrontmatter = vaultPath
            ? relativizePathFields(note.frontmatter, vaultPath)
            : note.frontmatter;
          const raw = serializeFrontmatter(diskFrontmatter, note.body);
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          writeTextFile(fullPath, raw, { baseDir: null } as any).catch((err) =>
            log.error("échec persistance __Type__", { path: fullPath, err })
          );
        }

        nodes.push(note);
      }
    })
  );

  return sortNodes(nodes);
}

// ── Application des templates ──────────────────────────────────────────────

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
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      return writeTextFile(path, raw, { baseDir: null } as any).catch((err) =>
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

// ── Écriture unitaire ──────────────────────────────────────────────────────

/**
 * Écrit un patch frontmatter via Rust, avec mise à jour optimiste immédiate.
 * Rust confirme l'écriture via l'événement vault:patch — useVaultSync réconcilie treeAtom.
 * vaultPath : si fourni, les champs path sont stockés en relatif sur disque.
 */
export async function persistNotePatch(
  noteId: string,
  frontmatter: Frontmatter,
  body: string,
  setTree: (updater: (prev: TreeNode[]) => TreeNode[]) => void,
  vaultPath?: string
): Promise<void> {
  // Optimistic — UI immédiat, frontmatter avec paths absolus
  setTree((prev) => updateNodeInTree(prev, noteId, { frontmatter }));

  const diskFrontmatter = vaultPath
    ? relativizePathFields(frontmatter, vaultPath)
    : frontmatter;
  const raw = serializeFrontmatter(diskFrontmatter, body);
  // Empêcher le watcher FS de recharger ce que Rust va écrire
  writingPathsRegistry.add(noteId);
  try {
    await invoke("update_note", { id: noteId, rawContent: raw });
    log.info("patch envoyé à Rust", { noteId });
  } finally {
    writingPathsRegistry.delete(noteId);
  }
}

// ── Résolution de conflits de nom ─────────────────────────────────────────

/**
 * Retourne un nom sans conflit dans destFolderPath.
 * Si "note.md" existe déjà → "note (2).md", "note (3).md", etc.
 */
export async function resolveDestName(
  destFolderPath: string,
  name: string
): Promise<string> {
  let entries: { name?: string | null }[] = [];
  try {
    // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
    entries = await readDir(destFolderPath, { baseDir: null } as any);
  } catch {
    return name;
  }
  const existing = new Set(entries.map((e) => e.name).filter(Boolean));
  if (!existing.has(name)) return name;

  const isNote = name.endsWith(".md");
  const base = isNote ? name.slice(0, -3) : name;
  const ext = isNote ? ".md" : "";
  let i = 2;
  while (existing.has(`${base} (${i})${ext}`)) i++;
  return `${base} (${i})${ext}`;
}

// ── Scope Tauri ────────────────────────────────────────────────────────────

export async function allowVaultScope(vaultPath: string): Promise<void> {
  // FS scope = mécanisme desktop uniquement ; le sandbox iOS accorde déjà l'accès au vault
  if (platform() === "ios") return;
  log.info("autorisation scope vault", { vaultPath });
  try {
    await invoke("allow_vault_path", { vaultPath });
    log.info("scope vault autorisé", { vaultPath });
  } catch (err) {
    log.error("échec allow_vault_path", err);
    throw err;
  }
}
