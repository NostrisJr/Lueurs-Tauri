import { mkdir, writeFile, exists } from "@tauri-apps/plugin-fs";
import { createLogger } from "../lib/logger";
import { hashFile } from "../lib/fileHash";

const log = createLogger("useAudioUpload");

export async function saveAudioToResources(
    vaultPath: string,
    file: File
): Promise<string> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = safeName.split(".").pop() ?? "wav";
    const stem = safeName.replace(/\.[^.]+$/, "");

    const hash = await hashFile(file);
    const finalName = `${stem}-${hash}.${ext}`;

    const destDir = `${vaultPath}/.resources/audio`;
    const destPath = `${destDir}/${finalName}`;

    await mkdir(destDir, { recursive: true });

    // Si le fichier existe déjà (même hash), on ne réécrit pas
    if (await exists(destPath)) {
        log.info("fichier audio déjà présent, réutilisation", { destPath });
        return destPath;
    }

    log.info("écriture fichier audio", { destPath, size: file.size });
    const arrayBuffer = await file.arrayBuffer();
    await writeFile(destPath, new Uint8Array(arrayBuffer));
    log.info("fichier audio écrit avec succès", { destPath });

    return destPath;
}