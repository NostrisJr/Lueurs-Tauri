import { useEffect } from "react";
import { createLogger } from "../../../lib/logger";
import { vaultIO } from "../../../lib/vaultIO";

const log = createLogger("useDropHandler");

const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|flac|aac|opus|weba)$/i;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg)$/i;

export function isAudioPath(p: string) {
  return AUDIO_EXTENSIONS.test(p);
}
export function isImagePath(p: string) {
  return IMAGE_EXTENSIONS.test(p);
}

// Dérive l'extension depuis le MIME type du fichier
function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
  };
  return map[mime] ?? ".png";
}

// Matérialise un File JS en tmp avant invoke (nécessaire pour paste — le blob n'a pas de chemin)
async function writeTmp(file: File, fileName: string): Promise<string> {
  const { appDataDir } = await import("@tauri-apps/api/path");
  const { writeFile, mkdir } = await import("@tauri-apps/plugin-fs");
  const appData = await appDataDir();
  const tmpDir = `${appData}lueurs-tmp`;
  await mkdir(tmpDir, { recursive: true });
  const tmpPath = `${tmpDir}/${fileName}`;
  await writeFile(tmpPath, new Uint8Array(await file.arrayBuffer()));
  return tmpPath;
}


interface Params {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  vaultPath: string;
  insertAudioBlock: (path: string, title: string) => void;
  insertImageBlock: (path: string, alt: string) => void;
  // Ref partagée avec MarkdownEditor pour connecter le handler drop natif
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
        const title = filename.replace(/\.[^.]+$/, "");

        if (isAudioPath(srcPath)) {
          log.info("drop audio détecté", { srcPath });
          try {
            const destPath = await vaultIO.copyResourceToVault(srcPath, vaultPath, "audio");
            insertAudioBlock(destPath, title);
            log.info("audio déposé", { destPath });
          } catch (err) {
            log.error("échec drop audio", err);
          }
        } else if (isImagePath(srcPath)) {
          log.info("drop image détecté", { srcPath });
          try {
            const destPath = await vaultIO.copyResourceToVault(srcPath, vaultPath, "images");
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

  // ── Paste audio + images ───────────────────────────────────────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const onPaste = async (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (!files.length) return;

      const audioFiles = files.filter(
        (f) => AUDIO_EXTENSIONS.test(f.name) || f.type.startsWith("audio/")
      );
      const imageFiles = files.filter(
        (f) => IMAGE_EXTENSIONS.test(f.name) || f.type.startsWith("image/")
      );
      if (!audioFiles.length && !imageFiles.length) return;

      e.preventDefault();
      e.stopPropagation();

      for (const [i, file] of audioFiles.entries()) {
        log.info("paste audio détecté", { name: file.name });
        try {
          // Nom unique : évite les collisions si plusieurs fichiers collés simultanément
          const ext = file.name.match(/\.[^.]+$/)?.[0] ?? ".mp3";
          const uniqueName = `audio_${Date.now()}_${i}${ext}`;
          const tmpPath = await writeTmp(file, uniqueName);
          const destPath = await vaultIO.copyResourceToVault(tmpPath, vaultPath, "audio");
          insertAudioBlock(destPath, file.name.replace(/\.[^.]+$/, ""));
          log.info("audio collé", { destPath });
        } catch (err) {
          log.error("échec paste audio", err);
        }
      }

      for (const [i, file] of imageFiles.entries()) {
        log.info("paste image détecté", { name: file.name });
        try {
          // Nom unique basé sur timestamp+index — file.name vaut toujours "image.png" depuis le presse-papiers
          const uniqueName = `image_${Date.now()}_${i}${extFromMime(file.type)}`;
          const tmpPath = await writeTmp(file, uniqueName);
          const destPath = await vaultIO.copyResourceToVault(tmpPath, vaultPath, "images");
          insertImageBlock(destPath, uniqueName.replace(/\.[^.]+$/, ""));
          log.info("image collée", { destPath });
        } catch (err) {
          log.error("échec paste image", err);
        }
      }
    };

    el.addEventListener("paste", onPaste, true);
    return () => el.removeEventListener("paste", onPaste, true);
  }, [vaultPath, insertAudioBlock, insertImageBlock, wrapperRef]);
}
