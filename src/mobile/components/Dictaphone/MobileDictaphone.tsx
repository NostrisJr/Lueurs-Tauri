import {
  IconChevronDown,
  IconMicrophoneFill,
  IconPauseFill,
  IconPlayFill,
  IconStopFill,
} from "../../../shared/components/PlatformIcon";
import { invoke } from "@tauri-apps/api/core";
import { readDir, remove } from "@tauri-apps/plugin-fs";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WaveformDisplay } from "../../../shared/components/Dictaphone/WaveformDisplay";
import { useAudioRecorder } from "../../../shared/hooks/useAudioRecorder";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import { useNote } from "../../../shared/hooks/useNote";
import {
  activeNoteIdAtom,
  dictaphoneModeAtom,
  folderPathAtom,
  folderStackAtom,
  noteBackStackAtom,
  openTabIdsAtom,
  pendingAudioInsertAtom,
} from "../../../shared/lib/Atoms";
import { findNextAvailableNumber } from "../../../shared/lib/fileTreeHelpers";
import { createLogger } from "../../../shared/lib/logger";
import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";
import { hapticImpact } from "../../lib/haptics";
import { FloatingComponent } from "../Floating/FloatingComponent";
import { Squircle } from "react-ios-corners";

const log = createLogger("MobileDictaphone");

// Hauteur barre de formatage (h-13 = 52px) + son offset bas (8px) + marge (8px)
const FORMATTING_BAR_CLEARANCE = 68;

type Status = "idle" | "recording" | "paused" | "processing" | "error";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function MobileDictaphone() {
  const dictaphoneMode = useAtomValue(dictaphoneModeAtom);
  const setDictaphoneMode = useSetAtom(dictaphoneModeAtom);
  const setPendingAudioInsert = useSetAtom(pendingAudioInsertAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const folderStack = useAtomValue(folderStackAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
  const setOpenTabIds = useSetAtom(openTabIdsAtom);
  const setNoteBackStack = useSetAtom(noteBackStackAtom);

  const { createNote, updateNote } = useFileTree();
  const { handleRename } = useNote();
  const recorder = useAudioRecorder();
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [title, setTitle] = useState("Nouvel enregistrement");
  const [isMinimized, setIsMinimized] = useState(false);

  const startYRef = useRef(0);
  const [swipeDelta, setSwipeDelta] = useState(0);

  const currentFolder = folderStack[folderStack.length - 1] ?? null;
  const dirPath = currentFolder?.id ?? folderPath ?? "";

  // Titre par défaut avec numéro disponible (mode new-note uniquement)
  useEffect(() => {
    if (dictaphoneMode !== "new-note" || !dirPath) return;
    (async () => {
      try {
        // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
        const entries = await readDir(dirPath, { baseDir: null } as any);
        const n = await findNextAvailableNumber(
          entries,
          "Nouvel enregistrement",
          false
        );
        setTitle(`Nouvel enregistrement ${n}`);
      } catch {
        setTitle("Nouvel enregistrement");
      }
    })();
  }, [dictaphoneMode, dirPath]);

  const close = useCallback(() => {
    setDictaphoneMode(null);
    setIsMinimized(false);
    setStatus("idle");
  }, [setDictaphoneMode]);

  const handleRecord = useCallback(async () => {
    try {
      await recorder.startRecording();
      setStatus("recording");
    } catch (err) {
      // Détails complets pour Safari Web Inspector
      const detail =
        err instanceof Error
          ? `${err.name}: ${err.message}`
          : typeof err === "string"
            ? err
            : JSON.stringify(err);
      log.error("impossible d'accéder au microphone", { err, detail });
      setErrorMsg(`Impossible d'accéder au microphone. (${detail})`);
      setStatus("error");
    }
  }, [recorder]);

  const handleStop = useCallback(async () => {
    setIsMinimized(false);
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

      // Chemin relatif au vault pour portabilité cross-platform
      const vaultPrefix = folderPath.endsWith("/")
        ? folderPath
        : `${folderPath}/`;
      const relativePath = audioPath.startsWith(vaultPrefix)
        ? audioPath.slice(vaultPrefix.length)
        : audioPath;
      log.info("audio sauvegardé", { audioPath, relativePath });

      if (dictaphoneMode === "insert") {
        setPendingAudioInsert({ path: relativePath, title: "Enregistrement" });
        close();
        return;
      }

      // Mode new-note
      const note = await createNote(dirPath);
      const noteTitle = title.trim() || "Nouvel enregistrement";
      // <> requis : le chemin peut contenir des espaces (ex. iCloud "Mobile Documents")
      const audioMarkdown = `[${noteTitle}](<${relativePath}>)\n`;

      let finalId = note.id;
      if (noteTitle !== note.name) {
        finalId = await handleRename(note.id, noteTitle, false);
      }

      updateNote(finalId, audioMarkdown, note.frontmatter);

      setNoteBackStack([]);
      setOpenTabIds((prev) =>
        prev.includes(finalId) ? prev : [...prev, finalId]
      );
      setActiveNoteId(finalId);
      close();
    } catch (err) {
      log.error("erreur lors de la sauvegarde de l'enregistrement", err);
      setErrorMsg("Erreur lors de la sauvegarde.");
      setStatus("error");
    }
  }, [
    recorder,
    folderPath,
    dictaphoneMode,
    dirPath,
    title,
    createNote,
    updateNote,
    handleRename,
    setPendingAudioInsert,
    close,
    setActiveNoteId,
    setOpenTabIds,
    setNoteBackStack,
  ]);

  const handlePause = useCallback(async () => {
    await recorder.pauseRecording();
    setStatus("paused");
  }, [recorder]);

  const handleResume = useCallback(async () => {
    await recorder.resumeRecording();
    setStatus("recording");
  }, [recorder]);

  const handleCancel = useCallback(() => {
    hapticImpact("light");
    if (status === "recording" || status === "paused")
      recorder.cancelRecording();
    close();
  }, [status, recorder, close]);

  // Nettoyage si le composant se démonte pendant l'enregistrement
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    return () => {
      if (recorder.isRecording) recorder.cancelRecording();
    };
  }, []);

  const resolvedColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-red-400")
    .trim();

  // ── Swipe handlers ─────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy > 0) setSwipeDelta(dy);
  };

  const onTouchEnd = () => {
    if (swipeDelta > 60) {
      if (isMinimized) {
        if (window.confirm("Annuler l'enregistrement en cours ?")) {
          recorder.cancelRecording();
          close();
        }
      } else if (status === "idle" || status === "error") {
        handleCancel();
      } else {
        setIsMinimized(true);
      }
    }
    setSwipeDelta(0);
  };

  const isActive = status === "recording" || status === "paused";

  // Position verticale de la pill (au-dessus de la barre de formatage quand clavier ouvert)
  const pillBottom: string | number = isKeyboardOpen
    ? keyboardHeight + FORMATTING_BAR_CLEARANCE
    : "calc(8px + env(safe-area-inset-bottom))";

  return createPortal(
    <>
      {/* Backdrop — uniquement quand le sheet est visible */}
      {!isMinimized && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: overlay tactile
        <div
          className="fixed inset-0 z-40 bg-gray-600/30"
          onClick={() => {
            if (isActive) setIsMinimized(true);
            else handleCancel();
          }}
        />
      )}

      {/* ── Pill flottante ───────────────────────────────────────────────────
          Toujours montée (display:none quand expansée) pour que le WaveformDisplay
          conserve son buffer et son listener d'amplitude. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
      <div
        className="fixed z-50"
        style={{
          left: 16,
          right: 16,
          bottom: pillBottom,
          display: isMinimized ? "block" : "none",
          transition: "bottom 0.25s ease-out",
        }}
        onClick={() => setIsMinimized(false)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <FloatingComponent>
          {/* Dot d'enregistrement */}
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 animate-pulse" />

          {/* Forme d'onde — active uniquement quand la pill est visible */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <WaveformDisplay
              isActive={isActive && isMinimized}
              width={180}
              height={32}
              color={resolvedColor}
            />
          </div>

          {/* Bouton stop */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation */}
          <div onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                hapticImpact("medium");
                handleStop();
              }}
              className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            >
              <IconStopFill className="size-4 text-white" />
            </button>
          </div>
        </FloatingComponent>
      </div>

      {/* ── Bottom sheet ─────────────────────────────────────────────────────
          Toujours monté (display:none quand minimisé) pour le même motif. */}
      <Squircle
        radius={50}
        className="fixed left-0 right-0 -bottom-12 py-12 z-50 bg-white overflow-hidden"
        style={{
          display: isMinimized ? "none" : "flex",
          flexDirection: "column",
          transform: `translateY(${swipeDelta}px)`,
          transition: swipeDelta === 0 ? "transform 0.2s ease-out" : "none",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="py-3 flex items-center justify-center shrink-0 touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-10 h-1 bg-gray-400 rounded-full" />
        </div>

        {/* Corps */}
        <div className="flex flex-col items-center gap-6 px-6 pb-8 pt-2">
          {/* Champ titre (mode new-note uniquement) */}
          {dictaphoneMode === "new-note" && (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la note"
              disabled={status === "processing"}
              className="w-full text-center text-lg font-medium border-0 border-b-2 border-gray-200 focus:border-amber-400 outline-none py-2 text-gray-800 bg-transparent disabled:opacity-40"
            />
          )}

          {/* Forme d'onde — active uniquement quand le sheet est visible */}
          <WaveformDisplay
            isActive={isActive && !isMinimized}
            width={280}
            height={64}
            color={resolvedColor}
          />

          {/* Chronomètre */}
          <span
            className={[
              "text-3xl font-mono tabular-nums tracking-widest",
              status === "recording"
                ? "text-red-500"
                : status === "paused"
                  ? "text-amber-400"
                  : "text-gray-300",
            ].join(" ")}
          >
            {formatTime(Math.floor(recorder.durationMs / 1000))}
          </span>

          {status === "processing" && (
            <span className="text-sm text-gray-400">Traitement en cours…</span>
          )}
          {status === "error" && (
            <span className="text-sm text-red-500">{errorMsg}</span>
          )}

          {/* Bouton démarrer (idle) */}
          {status === "idle" && (
            <button
              type="button"
              onClick={handleRecord}
              className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <IconMicrophoneFill className="size-9 text-white" />
            </button>
          )}

          {/* Contrôles actifs : pause/reprendre + stop + minimiser */}
          {isActive && (
            <div className="flex items-center gap-5">
              {status === "recording" ? (
                <button
                  type="button"
                  onClick={handlePause}
                  className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center shadow active:scale-95 transition-transform"
                >
                  <IconPauseFill className="size-6 text-gray-700" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResume}
                  className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center shadow active:scale-95 transition-transform"
                >
                  <IconPlayFill className="size-6 text-amber-500" />
                </button>
              )}

              <button
                type="button"
                onClick={handleStop}
                className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                <IconStopFill className="size-9 text-white" />
              </button>

              {/* Minimiser */}
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center shadow active:scale-95 transition-transform"
              >
                <IconChevronDown className="size-6 text-gray-500" />
              </button>
            </div>
          )}

          {status === "processing" && (
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            </div>
          )}

          {status === "error" && (
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="px-6 py-3 rounded-xl bg-amber-500 text-white font-medium active:bg-amber-600 transition-colors"
            >
              Réessayer
            </button>
          )}

          {/* Annuler */}
          {(status === "idle" || isActive) && (
            <button
              type="button"
              onClick={handleCancel}
              className="text-amber-500 text-base"
            >
              Annuler
            </button>
          )}
        </div>
      </Squircle>
    </>,
    document.body
  );
}
