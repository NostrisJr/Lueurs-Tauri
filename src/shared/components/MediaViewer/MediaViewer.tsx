// Visionneuse de fichiers médias (image, vidéo, PDF, audio).

import { convertFileSrc } from "@tauri-apps/api/core";
import { useSetAtom } from "jotai";
import { useId } from "react";
import { NoteHeader } from "../NoteEditor/NoteHeader";
import { useFileTree } from "../../hooks/useFileTree";
import type { MediaFile } from "../../hooks/useFileTree";
import { activeNoteIdAtom } from "../../lib/atoms";
import { vaultIO } from "../../lib/vaultIO";
import { StandaloneAudioPlayer } from "./StandaloneAudioPlayer";

export function MediaViewer({ media }: { media: MediaFile }) {
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
  const { reload } = useFileTree();
  const audioNodeId = useId();

  async function handleRename(newName: string) {
    const dotIdx = media.fileName.lastIndexOf(".");
    const ext = dotIdx > 0 ? media.fileName.slice(dotIdx) : "";
    const newFileName = `${newName}${ext}`;
    const parentPath = media.id.split("/").slice(0, -1).join("/");
    await vaultIO.rename(media.id, newFileName);
    setActiveNoteId(`${parentPath}/${newFileName}`);
    reload();
  }

  const assetUrl = convertFileSrc(media.id);

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

        {media.mediaType === "image" && (
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

        {media.mediaType === "video" && (
          // biome-ignore lint/a11y/useMediaCaption: fichiers locaux sans piste subtitle
          <video
            src={assetUrl}
            controls
            className="w-full rounded-xl shadow-sm border border-black/5"
            style={{ maxHeight: "70vh" }}
          />
        )}

        {media.mediaType === "pdf" && (
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
