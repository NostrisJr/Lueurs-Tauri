// Visionneuse de fichiers médias (image, vidéo, PDF, audio).

import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useEffect, useId, useState } from "react";
import type { MediaFile } from "../../hooks/useFileTree";
import { useNote } from "../../hooks/useNote";
import { createLogger } from "../../lib/logger";
import { isAndroid, isIOS, isMobile } from "../../lib/platform";
import { NoteHeader } from "../NoteEditor/NoteHeader";
import { StandaloneAudioPlayer } from "./StandaloneAudioPlayer";

const log = createLogger("MediaViewer");

/** Résout l'URL affichable d'un média : asset:// (desktop/iOS) ou blob:
 * depuis une lecture SAF (Android, `media.id` y est une URI content://
 * que convertFileSrc ne sait pas interpréter). */
function useMediaAssetUrl(id: string): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    isAndroid ? null : convertFileSrc(id)
  );

  useEffect(() => {
    if (!isAndroid) {
      setUrl(convertFileSrc(id));
      return;
    }
    let cancelled = false;
    let blobUrl: string | null = null;
    setUrl(null);
    invoke<ArrayBuffer>("vault_read_bytes", { uri: id })
      .then((buf) => {
        if (cancelled) return;
        blobUrl = URL.createObjectURL(new Blob([buf]));
        setUrl(blobUrl);
      })
      .catch((err) => {
        log.error("lecture média Android échouée", { id, err });
      });
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [id]);

  return url;
}

export function MediaViewer({ media }: { media: MediaFile }) {
  const { handleRenameMedia } = useNote();
  const audioNodeId = useId();

  async function handleRename(newName: string) {
    await handleRenameMedia(media.id, newName);
  }

  const assetUrl = useMediaAssetUrl(media.id);
  const isPdf = media.mediaType === "pdf";

  // Sur mobile avec PDF : layout plein écran flex pour que l'iframe occupe
  // tout l'espace disponible sous le header sans overflow ni hauteur fixe vh.
  if (isMobile && isPdf) {
    return (
      <div className="flex flex-col h-full w-full bg-white">
        <div className={isIOS ? "pt-12" : "pt-4"}>
          <NoteHeader
            isNote={false}
            name={media.name}
            onRename={handleRename}
          />
        </div>
        {/* Conteneur flex-1 avec position relative : l'iframe absolute inset-0
            est le seul moyen fiable de lui donner une hauteur sur WKWebView. */}
        <div className="flex-1 relative overflow-hidden">
          {assetUrl && (
            <iframe
              src={assetUrl}
              title={media.name}
              className="absolute inset-0 w-full h-full border-0"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full w-full">
      <NoteHeader isNote={false} name={media.name} onRename={handleRename} />

      <div className="px-10 py-6 max-w-3xl mx-auto w-full">
        <p className="text-xs text-gray-400 mb-6 uppercase tracking-wide">
          {media.mediaType === "image" && "Image"}
          {media.mediaType === "audio" && "Audio"}
          {media.mediaType === "video" && "Vidéo"}
          {media.mediaType === "pdf" && "PDF"}
          {" · "}
          {media.fileName.split(".").pop()?.toUpperCase()}
        </p>

        {media.mediaType === "image" && assetUrl && (
          <img
            src={assetUrl}
            alt={media.name}
            className="max-w-full rounded-xl shadow-sm border border-black/5"
            style={{ maxHeight: "70vh", objectFit: "contain" }}
          />
        )}

        {media.mediaType === "audio" && (
          <div className="w-full">
            <StandaloneAudioPlayer filePath={media.id} nodeId={audioNodeId} />
          </div>
        )}

        {media.mediaType === "video" && assetUrl && (
          // biome-ignore lint/a11y/useMediaCaption: fichiers locaux sans piste subtitle
          <video
            src={assetUrl}
            controls
            className="w-full rounded-xl shadow-sm border border-black/5"
            style={{ maxHeight: "70vh" }}
          />
        )}

        {isPdf && assetUrl && (
          <iframe
            src={assetUrl}
            title={media.name}
            className="w-full rounded-xl border border-black/5"
            style={{ height: "80vh" }}
          />
        )}
      </div>
    </div>
  );
}
