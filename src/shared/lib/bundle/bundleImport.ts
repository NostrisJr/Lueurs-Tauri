// Import d'un bundle .lueurs-note (zip) dans le vault, à l'emplacement boîte
// aux lettres choisi par l'utilisateur (Réglages > Vault). Reconstruction
// récursive de l'arbre + copie des ressources et des notes référencées
// (bucket refs/, mode "recursive" ou __Children__ inclus à l'export) avec
// nommage garanti sans collision (cf. bundleShared.dedupeName —
// copy_resource_to_vault ne renomme jamais lui-même en cas de fichier existant).

import { writeFile } from "@tauri-apps/plugin-fs";
import { unzip } from "fflate";
import {
  type Frontmatter,
  ensureType,
  parseFrontmatter,
  serializeFrontmatter,
  toArray,
} from "../fileTreeHelpers";
import { BASE_NULL } from "../importUtils";
import { createLogger } from "../logger";
import { NoteType, SystemField } from "../noteTypes";
import { resolveDestName, vaultIO } from "../vaultIO";
import {
  type BundleManifest,
  type DirEntry,
  MANIFEST_ENTRY,
  buildDirTree,
  dedupeName,
  resourceSubDir,
  rewriteFormulaRefPaths,
  rewriteResourceRefs,
  rewriteWikilinkRefs,
  sanitizeResourceName,
  tagSpace,
} from "./bundleShared";

const log = createLogger("bundleImport");

const REFS_FOLDER_NAME = "Références";

// Sous-dossier temp unique par ressource : copyResourceToVault re-dérive le nom
// final depuis le basename du chemin source (et le sanitise à nouveau) — un
// préfixe sur le nom de fichier lui-même finirait donc dans le vault. On isole
// plutôt chaque écriture dans un dossier temp distinct pour garantir l'unicité.
async function writeTmpBytes(
  bytes: Uint8Array,
  fileName: string
): Promise<string> {
  const { appDataDir } = await import("@tauri-apps/api/path");
  const { mkdir } = await import("@tauri-apps/plugin-fs");
  const appData = await appDataDir();
  const tmpDir = `${appData}lueurs-tmp/${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await mkdir(tmpDir, { recursive: true });
  const tmpPath = `${tmpDir}/${fileName}`;
  await writeFile(tmpPath, bytes);
  return tmpPath;
}

export interface BundleImportResult {
  rootPath: string;
  kind: BundleManifest["kind"];
}

export async function importBundle(
  bytes: Uint8Array,
  vaultPath: string,
  mailboxPath: string,
  space?: string | null
): Promise<BundleImportResult> {
  const files = await new Promise<Record<string, Uint8Array>>(
    (resolve, reject) => {
      unzip(bytes, (err, data) => (err ? reject(err) : resolve(data)));
    }
  );

  const manifestRaw = files[MANIFEST_ENTRY];
  if (!manifestRaw) throw new Error("Bundle invalide : manifest.json manquant");
  const manifest = JSON.parse(
    new TextDecoder().decode(manifestRaw)
  ) as BundleManifest;

  // Crée le dossier boîte aux lettres s'il n'existe pas encore (cas "Reçus" par
  // défaut) — no-op silencieux si racine du vault ou dossier déjà existant.
  if (mailboxPath !== vaultPath) {
    const leafName = mailboxPath.slice(mailboxPath.lastIndexOf("/") + 1);
    const parentPath = mailboxPath.slice(
      0,
      mailboxPath.length - leafName.length - 1
    );
    await vaultIO.createDir(parentPath, leafName).catch(() => {});
  }

  // ── Ressources : copie collision-safe, mapping bundle → chemin vault final ──
  const resourceMapping = new Map<string, string>();
  for (const subDir of ["images", "audio"] as const) {
    const prefix = `resources/${subDir}/`;
    const destDir = `${vaultPath}/resources/${subDir}`;
    await vaultIO.createDir(`${vaultPath}/resources`, subDir).catch(() => {});
    let existing: Set<string>;
    try {
      existing = new Set((await vaultIO.readDir(destDir)).map((e) => e.name));
    } catch {
      existing = new Set();
    }
    for (const key of Object.keys(files)) {
      if (!key.startsWith(prefix)) continue;
      const baseName = sanitizeResourceName(key.slice(prefix.length));
      const finalName = dedupeName(existing, baseName);
      existing.add(finalName);
      const tmpPath = await writeTmpBytes(files[key], finalName);
      await vaultIO.copyResourceToVault(tmpPath, vaultPath, subDir);
      resourceMapping.set(key, `resources/${subDir}/${finalName}`);
    }
  }

  // ── Notes référencées (bucket refs/, mode "recursive" ou __Children__) ──
  // mapping bundle ("refs/Nom.md") → chemin vault-relatif final, une fois
  // écrites dans <mailbox>/Références/. Calculé avant toute résolution de
  // contenu : une note refs/ peut en référencer une autre.
  const refsMapping = new Map<string, string>();
  const refsPrefix = "refs/";
  const refsKeys = Object.keys(files).filter((k) => k.startsWith(refsPrefix));
  let refsDestPath: string | null = null;
  if (refsKeys.length > 0) {
    refsDestPath = `${mailboxPath}/${REFS_FOLDER_NAME}`;
    await vaultIO.createDir(mailboxPath, REFS_FOLDER_NAME).catch(() => {});
    let existing: Set<string>;
    try {
      existing = new Set(
        (await vaultIO.readDir(refsDestPath)).map((e) => e.name)
      );
    } catch {
      existing = new Set();
    }
    const refsDestRel = refsDestPath.slice(vaultPath.length + 1);
    for (const key of refsKeys) {
      const finalName = dedupeName(existing, key.slice(refsPrefix.length));
      existing.add(finalName);
      refsMapping.set(key, `${refsDestRel}/${finalName}`);
    }
  }

  // Réécrit ressources + wikilinks + ref() de formules + __Children__ selon les
  // mappings finaux — appliqué uniformément aux notes tree/ et refs/.
  function resolveNote(
    frontmatter: Frontmatter,
    body: string
  ): { frontmatter: Frontmatter; body: string } {
    let newBody = rewriteResourceRefs(body, resourceMapping);
    newBody = rewriteWikilinkRefs(newBody, refsMapping);
    newBody = rewriteFormulaRefPaths(newBody, refsMapping);

    const fm = { ...frontmatter };
    for (const key of Object.keys(fm)) {
      const val = fm[key];
      if (typeof val === "string")
        fm[key] = rewriteFormulaRefPaths(val, refsMapping);
    }
    if (fm[SystemField.CHILDREN]) {
      const children = toArray(fm[SystemField.CHILDREN]);
      fm[SystemField.CHILDREN] = children.map((c) => refsMapping.get(c) ?? c);
    }
    return { frontmatter: fm, body: newBody };
  }

  if (refsDestPath) {
    for (const [key, relFinal] of refsMapping) {
      const raw = new TextDecoder().decode(files[key]);
      const { frontmatter, body } = parseFrontmatter(raw);
      const resolved = resolveNote(frontmatter, body);
      const noteName =
        relFinal.split("/").pop()?.replace(/\.md$/, "") ?? "Note";
      const fm = tagSpace(
        ensureType(resolved.frontmatter, noteName, REFS_FOLDER_NAME),
        space
      );
      await vaultIO.writeFile(
        `${vaultPath}/${relFinal}`,
        serializeFrontmatter(fm, resolved.body)
      );
    }
    log.info("notes référencées importées", {
      count: refsMapping.size,
      refsDestPath,
    });
  }

  // ── Reconstruction de l'arbre (racine du bundle) ─────────────────────────
  if (manifest.kind === "media") {
    const key = Object.keys(files).find((k) => k.startsWith("tree/"));
    if (!key) throw new Error("Bundle média invalide : fichier manquant");
    const fileName = key.slice("tree/".length);
    const destName = await resolveDestName(mailboxPath, fileName);
    await writeFile(`${mailboxPath}/${destName}`, files[key], BASE_NULL);
    log.info("média importé depuis bundle", { destName, mailboxPath });
    return { rootPath: `${mailboxPath}/${destName}`, kind: "media" };
  }

  if (manifest.kind === "note") {
    const key = `tree/${manifest.rootName}.md`;
    const raw = new TextDecoder().decode(files[key]);
    const { frontmatter, body } = parseFrontmatter(raw);
    const resolved = resolveNote(frontmatter, body);
    const fm = tagSpace(
      ensureType(
        resolved.frontmatter,
        manifest.rootName,
        mailboxPath.split("/").pop() ?? ""
      ),
      space
    );
    const destName = await resolveDestName(
      mailboxPath,
      `${manifest.rootName}.md`
    );
    await vaultIO.writeFile(
      `${mailboxPath}/${destName}`,
      serializeFrontmatter(fm, resolved.body)
    );
    log.info("note importée depuis bundle", { destName, mailboxPath });
    return { rootPath: `${mailboxPath}/${destName}`, kind: "note" };
  }

  // kind === "folder"
  const dirTree = buildDirTree(files, `tree/${manifest.rootName}/`);

  async function writeDir(
    entry: DirEntry,
    destParentPath: string,
    folderName: string
  ): Promise<string> {
    const finalName = await resolveDestName(destParentPath, folderName);
    const destPath = await vaultIO.createDir(destParentPath, finalName);
    const parentName = destParentPath.split("/").pop() ?? "";

    const selfNoteName = `${folderName}.md`;
    const selfNote = entry.files.find((f) => f.name === selfNoteName);
    let folderNoteContent: string;
    if (selfNote) {
      const raw = new TextDecoder().decode(files[selfNote.key]);
      const { frontmatter, body } = parseFrontmatter(raw);
      const resolved = resolveNote(frontmatter, body);
      const fm = tagSpace(
        {
          ...ensureType(resolved.frontmatter, finalName, parentName),
          __Type__: NoteType.FOLDER,
        },
        space
      );
      folderNoteContent = serializeFrontmatter(fm, resolved.body);
    } else {
      const fm = tagSpace(
        ensureType({ __Type__: NoteType.FOLDER }, finalName, parentName),
        space
      );
      folderNoteContent = serializeFrontmatter(fm, "");
    }
    await vaultIO.writeFile(`${destPath}/${finalName}.md`, folderNoteContent);

    for (const { name, key } of entry.files) {
      if (name === selfNoteName) continue;
      if (name.endsWith(".md")) {
        const raw = new TextDecoder().decode(files[key]);
        const { frontmatter, body } = parseFrontmatter(raw);
        const resolved = resolveNote(frontmatter, body);
        const noteName = name.replace(/\.md$/, "");
        const fm = ensureType(resolved.frontmatter, noteName, finalName);
        const destNoteName = await resolveDestName(destPath, name);
        await vaultIO.writeFile(
          `${destPath}/${destNoteName}`,
          serializeFrontmatter(fm, resolved.body)
        );
      } else if (resourceSubDir(name)) {
        const destMediaName = await resolveDestName(destPath, name);
        await writeFile(`${destPath}/${destMediaName}`, files[key], BASE_NULL);
      }
      // Autres types (vidéo, pdf…) : hors scope v1, ignorés silencieusement.
    }

    for (const [subName, subEntry] of entry.subDirs) {
      await writeDir(subEntry, destPath, subName);
    }

    return destPath;
  }

  const rootPath = await writeDir(dirTree, mailboxPath, manifest.rootName);
  log.info("dossier importé depuis bundle", { rootPath, mailboxPath });
  return { rootPath, kind: "folder" };
}
