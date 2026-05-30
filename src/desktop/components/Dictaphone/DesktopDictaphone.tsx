import { invoke } from "@tauri-apps/api/core";
import { remove } from "@tauri-apps/plugin-fs";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { WaveformDisplay } from "../../../shared/components/Dictaphone/WaveformDisplay";
import { useAudioRecorder } from "../../../shared/hooks/useAudioRecorder";
import { folderPathAtom } from "../../../shared/lib/atoms";
import { createLogger } from "../../../shared/lib/logger";
import { Squircle } from "../../../shared/components/Squircle";
import clsx from "clsx";

const log = createLogger("DesktopDictaphone");

type Status = "idle" | "recording" | "paused" | "processing" | "error";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

interface Props {
  onInsert: (path: string, title: string) => void;
  onClose: () => void;
}

export function DesktopDictaphone({ onInsert, onClose }: Props) {
  const folderPath = useAtomValue(folderPathAtom);
  const recorder = useAudioRecorder();

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // Pilote l'animation de glissement : false au montage, true à la frame suivante
  const [visible, setVisible] = useState(false);

  // Déclenche le slide-in après le premier render
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Nettoyage si fermé pendant l'enregistrement
  useEffect(() => {
    return () => {
      if (recorder.isRecording) recorder.cancelRecording();
    };
  }, [recorder.isRecording, recorder.cancelRecording]);

  const handleRecord = useCallback(async () => {
    try {
      await recorder.startRecording();
      setStatus("recording");
    } catch (err) {
      log.error("impossible d'accéder au microphone", err);
      setErrorMsg("Impossible d'accéder au microphone.");
      setStatus("error");
    }
  }, [recorder]);

  const handleStop = useCallback(async () => {
    setStatus("processing");
    try {
      const result = await recorder.stopRecording();
      if (!folderPath) throw new Error("vault non initialisé");

      const ext = result.filePath.split(".").pop() ?? "aac";
      const filename = `enregistrement-${Date.now()}.${ext}`;
      const audioPath = await invoke<string>("copy_resource_to_vault", {
        srcPath: result.filePath,
        vaultPath: folderPath,
        subDir: "audio",
        filename,
      });
      await remove(result.filePath);

      // Chemin relatif au vault pour portabilité
      const vaultPrefix = folderPath.endsWith("/")
        ? folderPath
        : `${folderPath}/`;
      const relativePath = audioPath.startsWith(vaultPrefix)
        ? audioPath.slice(vaultPrefix.length)
        : audioPath;
      log.info("audio sauvegardé", { audioPath, relativePath });
      onInsert(relativePath, "Enregistrement");
    } catch (err) {
      log.error("erreur lors de la sauvegarde", err);
      setErrorMsg("Erreur lors de la sauvegarde.");
      setStatus("error");
    }
  }, [recorder, folderPath, onInsert]);

  const handlePause = useCallback(async () => {
    await recorder.pauseRecording();
    setStatus("paused");
  }, [recorder]);

  const handleResume = useCallback(async () => {
    await recorder.resumeRecording();
    setStatus("recording");
  }, [recorder]);

  const handleCancel = useCallback(() => {
    if (status === "recording" || status === "paused")
      recorder.cancelRecording();
    // Slide-out symétrique avant de démonter
    setVisible(false);
    setTimeout(onClose, 200);
  }, [status, recorder, onClose]);

  // Le canvas résoud la couleur dans son propre espace, il faut donc que la prop css soit connue du DOM avant de le passer
  const resolved_color = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-red-400")
    .trim();

  return (
    // Overlay absolu : ne pousse pas le frontmatter, glisse depuis le haut
    <div className="absolute inset-x-0 top-14 z-30 flex justify-center pointer-events-none overflow-hidden pb-4 -mb-4">
      <Squircle
        className={clsx(
          "justify-between w-5/6 liquid-glass bg-gray-200/70 px-4 py-3 flex items-center gap-4",
          "pointer-events-auto transition-all duration-200 ease-out",
          visible
            ? "translate-y-0 opacity-100"
            : "-translate-y-[calc(100%+1rem)] opacity-0"
        )}
        radius={30}
      >
        {/* Forme d'onde */}
        <div className="flex items-center">
          <WaveformDisplay
            isActive={status === "recording" || status === "paused"}
            width={500}
            height={100}
            color={resolved_color}
          />
        </div>

        <div className="flex items-center gap-4">
          {/* Chrono */}
          <span
            className={clsx(
              "text-sm font-mono tabular-nums w-10 text-right",
              status === "recording"
                ? "text-red-500"
                : status === "paused"
                  ? "text-amber-400"
                  : "text-gray-300"
            )}
          >
            {formatTime(Math.floor(recorder.durationMs / 1000))}
          </span>

          {/* Boutons */}
          <div className="flex items-center gap-2">
            {status === "idle" && (
              <button
                type="button"
                onClick={handleRecord}
                className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
                title="Démarrer l'enregistrement"
              >
                <span className="sr-only">Enregistrer</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-4 text-white"
                >
                  <title>Enregistrer</title>
                  <circle cx="12" cy="12" r="6" />
                </svg>
              </button>
            )}

            {status === "recording" && (
              <button
                type="button"
                onClick={handlePause}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                title="Pause"
              >
                <span className="sr-only">Pause</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-3.5 text-gray-700"
                >
                  <title>Pause</title>
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              </button>
            )}

            {status === "paused" && (
              <button
                type="button"
                onClick={handleResume}
                className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center hover:bg-amber-200 transition-colors"
                title="Reprendre"
              >
                <span className="sr-only">Reprendre</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-3.5 text-amber-500"
                >
                  <title>Reprendre</title>
                  <path d="M8 5.14v14l11-7-11-7z" />
                </svg>
              </button>
            )}

            {(status === "recording" || status === "paused") && (
              <button
                type="button"
                onClick={handleStop}
                className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-900 transition-colors"
                title="Arrêter et insérer"
              >
                <span className="sr-only">Stop</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-3.5 text-white"
                >
                  <title>Stop</title>
                  <rect x="5" y="5" width="14" height="14" rx="1" />
                </svg>
              </button>
            )}

            {status === "processing" && (
              <div className="w-8 h-8 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              </div>
            )}

            {status === "error" && (
              <span
                className="text-xs text-red-500 max-w-32 truncate"
                title={errorMsg}
              >
                {errorMsg}
              </span>
            )}

            <button
              type="button"
              onClick={handleCancel}
              disabled={status === "processing"}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 px-1"
              title="Annuler"
            >
              Annuler
            </button>
          </div>
        </div>
      </Squircle>
    </div>
  );
}
