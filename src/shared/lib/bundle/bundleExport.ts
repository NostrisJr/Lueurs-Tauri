// Construction d'un bundle .lueurs-note (zip) à partir d'un nœud de l'arbre
// (note, dossier ou média) — partage simple avec ressources embarquées.
// Cf. Documentation-technique.md pour le format, et pour le traitement des
// références inter-notes (wikilinks, ref() de formules) hors du bundle.

import { readFile } from "@tauri-apps/plugin-fs";
import { zip } from "fflate";
import type {
  FolderNode,
  MediaFile,
  NoteFile,
  TreeNode,
} from "../../hooks/useFileTree";
import type { Frontmatter } from "../fileTreeHelpers";
import { serializeFrontmatter, toArray } from "../fileTreeHelpers";
import { computeFormula } from "../formulas";
import { BASE_NULL } from "../importUtils";
import { createLogger } from "../logger";
import { SystemField } from "../noteTypes";
import type { InfosAuteur } from "../proseToTypst";
import { relativizePathFields } from "../vaultIO";
import {
  BUNDLE_EXTENSION,
  type BrokenRefsScan,
  type BundleManifest,
  MANIFEST_ENTRY,
  bakeNoteFormulas,
  collectNoteRefPaths,
  collectResourceRefs,
  collectWikilinkTargets,
  dedupeName,
  resourceSubDir,
  rewriteFormulaRefPaths,
  rewriteResourceRefs,
  rewriteWikilinkRefs,
  scanBrokenRefs,
  unlinkWikilinks,
} from "./bundleShared";

const log = createLogger("bundleExport");

// Champs de relation inter-notes : n'ont de sens que dans le vault d'origine
// (pointent vers des notes non incluses dans le bundle) — retirés à l'export.
// __Children__ fait exception si includeChildren est activé (cf. buildBundle).
const CROSS_NOTE_FIELDS = [SystemField.TEMPLATE, SystemField.BASE] as const;

// Garde-fou : nombre max de notes ajoutées via refs/ (mode "recursive" ou
// includeChildren) — évite qu'une note très référencée n'aspire une bonne
// partie du vault sans confirmation explicite.
const MAX_REFS = 200;

export type RefsResolutionMode = "asis" | "bake" | "recursive";

export interface BuildBundleOptions {
  mode: RefsResolutionMode;
  /** Inclut les enfants (__Children__) de la racine si elle en a — indépendant de `mode`. */
  includeChildren: boolean;
  /** Résout une note du vault par son chemin relatif — pour bake/recursive/children. */
  resolveByRelPath: (relPath: string) => NoteFile | undefined;
}

export interface BundleBuildResult {
  bytes: Uint8Array;
  suggestedFileName: string;
  /** Références (wikilinks, formules) pointant hors du bundle avant résolution — pilote le dialogue. */
  warnings: BrokenRefsScan;
  /** La racine a des __Children__ — pertinent pour proposer le toggle "Inclure les enfants". */
  hasChildren: boolean;
}

interface PendingNote {
  treePath: string; // "tree/…" (racine) ou "refs/…" (note référencée)
  relPath: string; // chemin vault-relatif d'origine
  frontmatter: Frontmatter;
  body: string;
}

export async function buildBundle(
  node: TreeNode,
  vaultPath: string,
  auteur: InfosAuteur | null,
  options: BuildBundleOptions
): Promise<BundleBuildResult> {
  const files: Record<string, Uint8Array> = {};
  const pendingNotes: PendingNote[] = [];
  const includedRelPaths = new Set<string>();

  // ── Ressources (images/audio) — dédup bundle-wide, indépendant du mode ────
  const resourceMapping = new Map<string, string>();
  const resourceNames = new Set<string>();

  async function addResource(relPath: string): Promise<string | null> {
    const existing = resourceMapping.get(relPath);
    if (existing) return existing;
    const subDir = resourceSubDir(relPath);
    if (!subDir) return null;
    let bytes: Uint8Array;
    try {
      bytes = await readFile(`${vaultPath}/${relPath}`, BASE_NULL);
    } catch (err) {
      log.warn("ressource introuvable, ignorée du bundle", { relPath, err });
      return null;
    }
    const baseName = relPath.split("/").pop() ?? "resource";
    const name = dedupeName(resourceNames, baseName);
    resourceNames.add(name);
    const bundlePath = `resources/${subDir}/${name}`;
    files[bundlePath] = bytes;
    resourceMapping.set(relPath, bundlePath);
    return bundlePath;
  }

  const relPathOf = (absId: string) => absId.slice(vaultPath.length + 1);

  // ── Notes référencées (wikilinks/ref() hors bundle, ou __Children__) ─────
  const refsMapping = new Map<string, string>(); // relPath → "refs/Nom.md"
  const refsNames = new Set<string>();
  const refsQueue: string[] = [];
  const queued = new Set<string>();

  function enqueueRef(relPath: string) {
    if (includedRelPaths.has(relPath) || queued.has(relPath)) return;
    queued.add(relPath);
    refsQueue.push(relPath);
  }

  // ── Collecte d'une note (racine ou référencée) — résout ses ressources,
  // relativise/nettoie son frontmatter, mais ne réécrit PAS encore les
  // wikilinks/ref() : refsMapping n'est complet qu'une fois la queue vidée.
  async function collectNote(
    note: NoteFile,
    treePath: string,
    keepChildren: boolean
  ): Promise<void> {
    const relPath = relPathOf(note.id);
    includedRelPaths.add(relPath);

    const refs = collectResourceRefs(note.body);
    const localResourceMapping = new Map<string, string>();
    for (const ref of refs) {
      const bundlePath = await addResource(ref);
      if (bundlePath) localResourceMapping.set(ref, bundlePath);
    }
    const body = rewriteResourceRefs(note.body, localResourceMapping);

    // Frontmatter en mémoire = absolutifié (paths disque locaux) → relativisé
    // avant d'embarquer, sinon on fuite l'arborescence locale de l'expéditeur.
    const fm = { ...relativizePathFields(note.frontmatter, vaultPath) };
    for (const field of CROSS_NOTE_FIELDS) delete fm[field];
    if (!keepChildren) delete fm[SystemField.CHILDREN];
    if (auteur && (auteur.prenom || auteur.nom)) {
      fm.__PartageAuteur__ = [auteur.prenom, auteur.nom]
        .filter(Boolean)
        .join(" ");
    }

    pendingNotes.push({ treePath, relPath, frontmatter: fm, body });

    if (options.mode === "recursive") {
      for (const t of collectWikilinkTargets(body)) enqueueRef(t);
      for (const t of collectNoteRefPaths(fm, body)) enqueueRef(t);
    }
    if (keepChildren) {
      for (const t of toArray(fm[SystemField.CHILDREN])) enqueueRef(t);
    }
  }

  async function addMedia(media: MediaFile, treePath: string): Promise<void> {
    try {
      files[`tree/${treePath}`] = await readFile(media.id, BASE_NULL);
    } catch (err) {
      log.error("média illisible, ignoré du bundle", { id: media.id, err });
    }
  }

  async function addFolder(
    folder: FolderNode,
    treePath: string
  ): Promise<void> {
    for (const child of folder.children) {
      if (child.kind === "file") {
        await collectNote(child, `tree/${treePath}/${child.name}.md`, false);
      } else if (child.kind === "media") {
        await addMedia(child, `${treePath}/${child.fileName}`);
      } else {
        await addFolder(child, `${treePath}/${child.name}`);
      }
    }
  }

  // ── Racine ─────────────────────────────────────────────────────────────
  const rootName = node.name;
  let kind: BundleManifest["kind"];
  let hasChildren = false;
  if (node.kind === "file") {
    kind = "note";
    hasChildren = toArray(node.frontmatter[SystemField.CHILDREN]).length > 0;
    await collectNote(
      node,
      `tree/${rootName}.md`,
      options.includeChildren && hasChildren
    );
  } else if (node.kind === "media") {
    kind = "media";
    await addMedia(node, node.fileName);
  } else {
    kind = "folder";
    await addFolder(node, rootName);
  }

  // Avertissements calculés AVANT toute expansion (recursive/children) : reflètent
  // l'état du seul sous-arbre sélectionné, pour piloter le dialogue de résolution.
  const warnings = scanBrokenRefs(pendingNotes, includedRelPaths);

  // ── Expansion refs/ (recursive et/ou includeChildren) ────────────────────
  let truncated = false;
  while (refsQueue.length > 0) {
    if (refsMapping.size >= MAX_REFS) {
      truncated = true;
      break;
    }
    const relPath = refsQueue.shift();
    if (!relPath || includedRelPaths.has(relPath)) continue;
    const note = options.resolveByRelPath(relPath);
    if (!note) continue; // cible introuvable dans le vault — rien à bundler

    const baseName = relPath.split("/").pop() ?? "note.md";
    const name = dedupeName(refsNames, baseName);
    refsNames.add(name);
    const bundlePath = `refs/${name}`;
    refsMapping.set(relPath, bundlePath);

    await collectNote(note, bundlePath, false);
  }
  if (truncated) {
    log.warn("bundle refs/ tronqué (limite atteinte)", { max: MAX_REFS });
  }

  // ── Résolution finale + sérialisation ─────────────────────────────────────
  for (const pending of pendingNotes) {
    let { frontmatter: fm, body } = pending;

    // Toujours réécrire vers refs/ ce qui y est effectivement entré — recursive
    // ET/OU includeChildren peuvent tous deux avoir peuplé refsMapping, y compris
    // en mode "asis"/"bake" (ex: un lien croisé entre deux enfants inclus).
    // No-op si refsMapping est vide (aucune expansion demandée).
    body = rewriteWikilinkRefs(body, refsMapping);
    body = rewriteFormulaRefPaths(body, refsMapping);
    for (const key of Object.keys(fm)) {
      const val = fm[key];
      if (typeof val === "string") fm[key] = rewriteFormulaRefPaths(val, refsMapping);
    }

    if (options.mode === "bake") {
      // Seules les cibles encore non résolues après expansion refs/ sont figées —
      // celles rattrapées par includeChildren viennent d'être réécrites ci-dessus.
      const stillExcludedFormulas = new Set(
        warnings.formulas.filter((p) => !refsMapping.has(p))
      );
      const baked = bakeNoteFormulas(fm, body, stillExcludedFormulas, (raw) =>
        computeFormula(
          raw,
          fm as Record<string, unknown>,
          undefined,
          options.resolveByRelPath
        )
      );
      fm = baked.frontmatter;
      const stillExcludedWikilinks = new Set(
        warnings.wikilinks.filter((p) => !refsMapping.has(p))
      );
      body = unlinkWikilinks(baked.body, stillExcludedWikilinks);
    }

    // __Children__ conservé : réécrit vers les chemins refs/ effectivement bundlés,
    // les entrées non résolues (cible introuvable) restent telles quelles.
    if (fm[SystemField.CHILDREN]) {
      const children = toArray(fm[SystemField.CHILDREN]);
      fm[SystemField.CHILDREN] = children.map((c) => refsMapping.get(c) ?? c);
    }

    files[pending.treePath] = new TextEncoder().encode(
      serializeFrontmatter(fm, body)
    );
  }

  const manifest: BundleManifest = { version: 1, kind, rootName };
  files[MANIFEST_ENTRY] = new TextEncoder().encode(JSON.stringify(manifest));

  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, { level: 6 }, (err, data) =>
      err ? reject(err) : resolve(data)
    );
  });

  log.info("bundle construit", {
    rootName,
    kind,
    mode: options.mode,
    resources: resourceMapping.size,
    refs: refsMapping.size,
    truncated,
    bytes: bytes.byteLength,
  });

  return {
    bytes,
    suggestedFileName: `${rootName}.${BUNDLE_EXTENSION}`,
    warnings,
    hasChildren,
  };
}
