import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { tempDir } from "@tauri-apps/api/path";
import { remove } from "@tauri-apps/plugin-fs";
import { createLogger } from "../lib/logger";

const log = createLogger("useAudioRecorder");

// ── Types (miroir des structs Rust du plugin) ──────────────────────────────

type RecordingState = "idle" | "recording" | "paused";

interface RecordingStatus {
  state: RecordingState;
  durationMs: number;
  outputPath: string | null;
}

export interface RecordingResult {
  filePath: string;
  durationMs: number;
  fileSize: number;
  sampleRate: number;
  channels: number;
}

interface PermissionStatus {
  granted: boolean;
  canRequest: boolean;
}

// ── Interface publique du hook ─────────────────────────────────────────────

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  durationMs: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<RecordingResult>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  cancelRecording: () => Promise<void>;
}

// ── Helpers invoke ─────────────────────────────────────────────────────────

// TODO : Le plugin n'est pas encore vraiment buildé (n'a pas de dist/) Il faudra régler cela avec un import propre une fois le plugin publié, ou placer le dist/ sur github
const cmd = (name: string) => `plugin:audio-recorder|${name}`;

// ── Hook ──────────────────────────────────────────────────────────────────

export function useAudioRecorder(): AudioRecorderState {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const startRecording = useCallback(async () => {
    let perm = await invoke<PermissionStatus>(cmd("check_permission"));
    if (!perm.granted) {
      if (!perm.canRequest) {
        throw new Error(
          "Permission microphone refusée. Activez le micro dans Réglages > Lueurs."
        );
      }
      perm = await invoke<PermissionStatus>(cmd("request_permission"));
      if (!perm.granted) {
        throw new Error(
          "Permission microphone refusée. Activez le micro dans Réglages > Lueurs."
        );
      }
    }

    const tmp = await tempDir();
    const outputPath = `${tmp}lueurs_rec_${Date.now()}`;

    await invoke(cmd("start_recording"), { outputPath, quality: "medium" });
    setIsRecording(true);
    setIsPaused(false);
    setDurationMs(0);

    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const status = await invoke<RecordingStatus>(cmd("get_status"));
        setDurationMs(status.durationMs);
        setIsPaused(status.state === "paused");
        if (status.state === "idle") stopPoll();
      } catch {
        stopPoll();
      }
    }, 250);

    log.info("enregistrement démarré", { outputPath });
  }, [stopPoll]);

  const stopRecording = useCallback(async (): Promise<RecordingResult> => {
    stopPoll();
    const result = await invoke<RecordingResult>(cmd("stop_recording"));
    setIsRecording(false);
    setIsPaused(false);
    setDurationMs(result.durationMs);
    log.info("enregistrement arrêté", {
      durationMs: result.durationMs,
      filePath: result.filePath,
      fileSize: result.fileSize,
    });
    return result;
  }, [stopPoll]);

  const pauseRecording = useCallback(async () => {
    await invoke(cmd("pause_recording"));
    setIsPaused(true);
    log.info("enregistrement mis en pause");
  }, []);

  const resumeRecording = useCallback(async () => {
    await invoke(cmd("resume_recording"));
    setIsPaused(false);
    log.info("enregistrement repris");
  }, []);

  const cancelRecording = useCallback(async () => {
    stopPoll();
    try {
      const result = await invoke<RecordingResult>(cmd("stop_recording"));
      await remove(result.filePath);
      log.info("enregistrement annulé, fichier supprimé", {
        filePath: result.filePath,
      });
    } catch (e) {
      log.error("erreur lors de l'annulation", e);
    }
    setIsRecording(false);
    setIsPaused(false);
    setDurationMs(0);
  }, [stopPoll]);

  return {
    isRecording,
    isPaused,
    durationMs,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
  };
}
