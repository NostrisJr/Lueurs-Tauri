import { mkdir, writeFile, exists } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";
import { createLogger } from "../lib/logger";
import { hashFile } from "../lib/fileHash";

const log = createLogger("useImageUpload");

export async function saveImageToResources(
    vaultPath: string,
    file: File
): Promise<string> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = safeName.split(".").pop() ?? "png";
    const stem = safeName.replace(/\.[^.]+$/, "");

    const hash = await hashFile(file);
    const finalName = `${stem}-${hash}.${ext}`;

    const destDir = `${vaultPath}/.resources/images`;
    const destPath = `${destDir}/${finalName}`;

    await mkdir(destDir, { recursive: true });

    if (await exists(destPath)) {
        log.info("image déjà présente, réutilisation", { destPath });
        return destPath;
    }

    log.info("écriture fichier image", { destPath, size: file.size });
    const arrayBuffer = await file.arrayBuffer();
    await writeFile(destPath, new Uint8Array(arrayBuffer));
    log.info("fichier image écrit avec succès", { destPath });

    return destPath;
}

export async function resolveImagePath(absolutePath: string): Promise<string> {
    log.info("résolution chemin image", { absolutePath });
    const resolved = convertFileSrc(absolutePath);
    log.info("chemin image résolu", { resolved });
    return resolved;
}