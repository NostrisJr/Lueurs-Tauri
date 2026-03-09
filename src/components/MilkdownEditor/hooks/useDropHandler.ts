import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "../../../lib/logger";

const log = createLogger("useDropHandler");

const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|flac|aac|opus|weba)$/i;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg)$/i;

export function isAudioPath(p: string) {
    return AUDIO_EXTENSIONS.test(p);
}
export function isImagePath(p: string) {
    return IMAGE_EXTENSIONS.test(p);
}

// Matérialise un File JS en tmp avant invoke (nécessaire pour paste — le blob n'a pas de chemin)
async function writeTmp(file: File): Promise<string> {
    const { appDataDir } = await import("@tauri-apps/api/path");
    const { writeFile, mkdir } = await import("@tauri-apps/plugin-fs");
    const appData = await appDataDir();
    const tmpDir = `${appData}lueurs-tmp`;
    await mkdir(tmpDir, { recursive: true });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const tmpPath = `${tmpDir}/${safeName}`;
    await writeFile(tmpPath, new Uint8Array(await file.arrayBuffer()));
    return tmpPath;
}

async function copyToVault(
    srcPath: string,
    vaultPath: string,
    subDir: "audio" | "images",
    filename: string
): Promise<string> {
    return invoke<string>("copy_resource_to_vault", {
        srcPath,
        vaultPath,
        subDir,
        filename,
    });
}

interface Params {
    wrapperRef: React.RefObject<HTMLDivElement | null>;
    vaultPath: string;
    insertAudioBlock: (path: string, title: string) => void;
    insertImageBlock: (path: string, alt: string) => void;
    // Ref partagée avec CrepeEditor pour connecter le handler drop natif
    dropHandlerRef: React.MutableRefObject<((paths: string[]) => void) | null>;
}

export function useDropHandler({
    wrapperRef,
    vaultPath,
    insertAudioBlock,
    insertImageBlock,
    dropHandlerRef,
}: Params) {
    // ── Drop natif Tauri ───────────────────────────────────────────────────
    useEffect(() => {
        dropHandlerRef.current = async (paths: string[]) => {
            for (const srcPath of paths) {
                const filename = srcPath.split(/[/\\]/).pop() ?? "";
                const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
                const title = filename.replace(/\.[^.]+$/, "");

                if (isAudioPath(srcPath)) {
                    log.info("drop audio détecté", { srcPath });
                    try {
                        const destPath = await copyToVault(srcPath, vaultPath, "audio", safeName);
                        insertAudioBlock(destPath, title);
                        log.info("audio déposé", { destPath });
                    } catch (err) {
                        log.error("échec drop audio", err);
                    }
                } else if (isImagePath(srcPath)) {
                    log.info("drop image détecté", { srcPath });
                    try {
                        const destPath = await copyToVault(srcPath, vaultPath, "images", safeName);
                        insertImageBlock(destPath, title);
                        log.info("image déposée", { destPath });
                    } catch (err) {
                        log.error("échec drop image", err);
                    }
                }
            }
        };

        log.info("handler drop connecté");
        return () => {
            dropHandlerRef.current = null;
            log.info("handler drop déconnecté");
        };
    }, [vaultPath, insertAudioBlock, insertImageBlock, dropHandlerRef]);

    // ── Paste audio ────────────────────────────────────────────────────────
    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;

        const onPaste = async (e: ClipboardEvent) => {
            const files = Array.from(e.clipboardData?.files ?? []);
            const audioFiles = files.filter(
                (f) => AUDIO_EXTENSIONS.test(f.name) || f.type.startsWith("audio/")
            );
            if (!audioFiles.length) return;

            e.preventDefault();
            e.stopPropagation();
            log.info("paste audio détecté", { count: audioFiles.length });

            for (const file of audioFiles) {
                try {
                    // Le File n'a pas de chemin — on passe par tmp avant invoke
                    const tmpPath = await writeTmp(file);
                    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                    const destPath = await copyToVault(tmpPath, vaultPath, "audio", safeName);
                    insertAudioBlock(destPath, file.name.replace(/\.[^.]+$/, ""));
                    log.info("audio collé", { destPath });
                } catch (err) {
                    log.error("échec paste audio", err);
                }
            }
        };

        el.addEventListener("paste", onPaste, true);
        return () => el.removeEventListener("paste", onPaste, true);
    }, [vaultPath, insertAudioBlock, wrapperRef]);
}