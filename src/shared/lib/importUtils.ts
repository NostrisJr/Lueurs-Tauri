// Fonctions d'import de fichiers et dossiers vers le vault.
// Partagées entre useFileDrop (drag & drop) et useMenuEvents (menu File).

import {
  readDir,
  readFile,
  readTextFile,
  writeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import {
  type Frontmatter,
  ensureType,
  parseFrontmatter,
  serializeFrontmatter,
  toArray,
} from "./fileTreeHelpers";
import { createLogger } from "./logger";
import { NoteType, SystemField } from "./noteTypes";
import { getMediaType, resolveDestName, vaultIO } from "./vaultIO";

const log = createLogger("importUtils");

// biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
export const BASE_NULL = { baseDir: null } as any;

// Rattache l'import à l'espace actif en ajoutant son nom au champ __space__.
function tagSpace(fm: Frontmatter, space?: string | null): Frontmatter {
  if (!space) return fm;
  const existing = toArray(fm[SystemField.SPACE]);
  if (!existing.includes(space)) fm[SystemField.SPACE] = [...existing, space];
  return fm;
}

export async function importMdFile(
  srcPath: string,
  destFolderPath: string,
  space?: string | null
): Promise<void> {
  const content = await readTextFile(srcPath, BASE_NULL);
  const { frontmatter, body } = parseFrontmatter(content);
  const fileName = srcPath.split("/").pop() ?? "note.md";
  const noteName = fileName.replace(/\.md$/, "");
  const parentFolderName = destFolderPath.split("/").pop() ?? "";
  const safeFrontmatter = tagSpace(
    ensureType(frontmatter, noteName, parentFolderName),
    space
  );
  const finalContent = serializeFrontmatter(safeFrontmatter, body);
  const destName = await resolveDestName(destFolderPath, fileName);
  await writeTextFile(`${destFolderPath}/${destName}`, finalContent, BASE_NULL);
  log.info("note importée", { destFolderPath, destName });
}

export async function importMediaFile(
  srcPath: string,
  destFolderPath: string,
  fileName: string
): Promise<void> {
  const data = await readFile(srcPath, BASE_NULL);
  const destName = await resolveDestName(destFolderPath, fileName);
  await writeFile(`${destFolderPath}/${destName}`, data, BASE_NULL);
  log.info("média importé", { destFolderPath, destName });
}

export async function importFolderRecursive(
  srcPath: string,
  destParentPath: string,
  folderName: string,
  space?: string | null
): Promise<void> {
  const destName = await resolveDestName(destParentPath, folderName);
  const destPath = await vaultIO.createDir(destParentPath, destName);

  let entries: { name?: string | null; isDirectory?: boolean | null }[] = [];
  try {
    entries = await readDir(srcPath, BASE_NULL);
  } catch {
    return;
  }

  // Folder note : réutiliser celle de la source si elle existe.
  // Le tag d'espace n'est posé que sur la note-dossier de tête : les enfants
  // sont inclus par propagation totale (cf. filterTreeBySpace), inutile de les taguer.
  const srcFolderNoteFileName = `${folderName}.md`;
  const srcFolderNoteEntry = entries.find(
    (e) => e.name === srcFolderNoteFileName && !e.isDirectory
  );

  let folderNoteContent: string;
  if (srcFolderNoteEntry) {
    const raw = await readTextFile(
      `${srcPath}/${srcFolderNoteFileName}`,
      BASE_NULL
    );
    const { frontmatter, body } = parseFrontmatter(raw);
    frontmatter.__Type__ = NoteType.FOLDER;
    folderNoteContent = serializeFrontmatter(
      tagSpace(frontmatter, space),
      body
    );
  } else {
    const fm = ensureType({}, destName, destParentPath.split("/").pop() ?? "");
    fm.__Type__ = NoteType.FOLDER;
    folderNoteContent = serializeFrontmatter(tagSpace(fm, space), "");
  }
  await vaultIO.writeFile(`${destPath}/${destName}.md`, folderNoteContent);

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.name || entry.name.startsWith(".")) return;
      if (entry.name === srcFolderNoteFileName) return;
      const srcEntryPath = `${srcPath}/${entry.name}`;
      if (entry.isDirectory) {
        await importFolderRecursive(srcEntryPath, destPath, entry.name);
      } else if (entry.name.endsWith(".md")) {
        await importMdFile(srcEntryPath, destPath);
      } else if (getMediaType(entry.name)) {
        await importMediaFile(srcEntryPath, destPath, entry.name);
      }
    })
  );

  log.info("dossier importé", { srcPath, destPath });
}

// Point d'entrée commun : importe un tableau de chemins (notes, médias, dossiers).
// space : espace actif à rattacher aux notes/dossiers importés (null = aucun).
export async function importPaths(
  targetFolderPath: string,
  paths: string[],
  space?: string | null
): Promise<void> {
  await Promise.all(
    paths.map(async (srcPath) => {
      const fileName = srcPath.split("/").pop() ?? "";
      try {
        if (fileName.endsWith(".md")) {
          await importMdFile(srcPath, targetFolderPath, space);
        } else if (getMediaType(fileName)) {
          await importMediaFile(srcPath, targetFolderPath, fileName);
        } else {
          // Tenter un import dossier
          const parts = srcPath.split("/");
          const folderName = fileName || parts[parts.length - 1] || "Dossier";
          try {
            await readDir(srcPath, BASE_NULL);
            await importFolderRecursive(
              srcPath,
              targetFolderPath,
              folderName,
              space
            );
          } catch {
            log.info("chemin ignoré (ni note, ni média, ni dossier)", {
              srcPath,
            });
          }
        }
      } catch (err) {
        log.error("échec import", { srcPath, err });
      }
    })
  );
}
