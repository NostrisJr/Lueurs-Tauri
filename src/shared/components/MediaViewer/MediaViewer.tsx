import clsx from "clsx";
// Visionneuse de fichiers médias (image, vidéo, PDF, audio).

import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useSetAtom } from "jotai";
import { useEffect, useId, useState } from "react";
import {
  FLOATING_HEADER_SCROLL_OFFSET,
  FloatingHeaderBar,
} from "../../../mobile/components/Floating/FloatingHeaderBar";
import { hapticImpact } from "../../../mobile/lib/haptics";
import type { MediaFile } from "../../hooks/useFileTree";
import { useNote } from "../../hooks/useNote";
import { mobileResetNavAtom, noteBackStackAtom } from "../../lib/atoms";
import { createLogger } from "../../lib/logger";
import { iconAccentClass, isAndroid, isMobile } from "../../lib/platform";
import { EditableText } from "../EditableText";
import { NoteHeader } from "../NoteEditor/NoteHeader";
import { IconChevronLeft } from "../PlatformIcon";
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
  const setNoteBackStack = useSetAtom(noteBackStackAtom);
  const resetNav = useSetAtom(mobileResetNavAtom);

  async function handleRename(newName: string) {
    await handleRenameMedia(media.id, newName);
  }

  const assetUrl = useMediaAssetUrl(media.id);
  const isPdf = media.mediaType === "pdf";

  const content = (
    <div className="px-10 py-6 max-w-3xl mx-auto w-full">
      <p className="text-xs text-ink-4 mb-6 uppercase tracking-wide">
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
          className="max-w-full rounded-xl shadow-sm border border-tint"
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
          className="w-full rounded-xl shadow-sm border border-tint"
          style={{ maxHeight: "70vh" }}
        />
      )}

      {isPdf && assetUrl && (
        <iframe
          src={assetUrl}
          title={media.name}
          className="w-full rounded-xl border border-tint"
          style={{ height: "80vh" }}
        />
      )}
    </div>
  );

  // Mobile : même barre flottante (safe-area de l'encoche + pills) que le
  // file tree et l'éditeur, plutôt que le NoteHeader "en flux" (pensé pour un
  // header sticky desktop) — sinon le header n'a aucune marge sous l'encoche.
  if (isMobile) {
    const backButton = (
      <button
        type="button"
        onClick={() => {
          hapticImpact("light");
          setNoteBackStack([]);
          resetNav();
        }}
        className={clsx(
          "shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors",
          "active:bg-tint",
          iconAccentClass
        )}
        aria-label="Retour aux notes"
        title="Retour aux notes"
      >
        <IconChevronLeft className="size-4" />
      </button>
    );

    const title = (
      <div className="relative w-3/4 mx-auto flex items-center justify-center">
        <EditableText
          className="font-semibold text-ink tracking-tight"
          value={media.name}
          onSave={handleRename}
        />
      </div>
    );

    // Pas de morph au scroll ici (pas de long corps de note à défiler) : les
    // pills restent nues (collapseProgress fixe à 0), cf. leftPill/rightPill.
    return (
      <div className="flex flex-col h-full w-full bg-canvas">
        <FloatingHeaderBar
          collapseProgress={0}
          leftPill={false}
          rightPill={false}
          left={backButton}
          center={title}
          right={<div />}
        />

        {isPdf ? (
          <>
            <div
              className="shrink-0"
              style={{ height: FLOATING_HEADER_SCROLL_OFFSET }}
            />
            {/* Conteneur flex-1 avec position relative : l'iframe absolute
                inset-0 est le seul moyen fiable de lui donner une hauteur sur
                WKWebView. */}
            <div className="flex-1 relative overflow-hidden">
              {assetUrl && (
                <iframe
                  src={assetUrl}
                  title={media.name}
                  className="absolute inset-0 w-full h-full border-0"
                />
              )}
            </div>
          </>
        ) : (
          <div
            className="flex-1 overflow-y-auto"
            style={{ paddingTop: FLOATING_HEADER_SCROLL_OFFSET }}
          >
            {content}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full w-full">
      <NoteHeader isNote={false} name={media.name} onRename={handleRename} />
      {content}
    </div>
  );
}
