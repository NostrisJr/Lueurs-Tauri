import { useState, useEffect, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { readDir, remove } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import {
  sfChevronLeft,
  sfMicrophoneFill,
  sfStopFill,
  sfPauseFill,
  sfPlayFill,
} from "@bradleyhodges/sfsymbols";
import {
  mobileViewAtom,
  dictaphoneModeAtom,
  pendingAudioInsertAtom,
  folderPathAtom,
  folderStackAtom,
  activeNoteIdAtom,
  openTabIdsAtom,
  noteBackStackAtom,
} from "../../shared/lib/Atoms";
import { useAudioRecorder } from "../../shared/hooks/useAudioRecorder";
import { WaveformDisplay } from "../../shared/components/Dictaphone/WaveformDisplay";
import { useFileTree } from "../../shared/hooks/useFileTree";
import { useNote } from "../../shared/hooks/useNote";
import { findNextAvailableNumber } from "../../shared/lib/fileTreeHelpers";
import { createLogger } from "../../shared/lib/logger";

const log = createLogger("MobileDictaphone");

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
  const setMobileView = useSetAtom(mobileViewAtom);
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

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [title, setTitle] = useState("Nouvel enregistrement");

  // Dossier courant pour la création de note
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
        setDictaphoneMode(null);
        setMobileView("editor");
        return;
      }

      // Mode new-note
      const note = await createNote(dirPath);
      // <> requis : le chemin peut contenir des espaces (ex. iCloud "Mobile Documents")
      const audioMarkdown = `[Enregistrement](<${relativePath}>)\n`;

      // Écriture du corps audio, puis renommage si le titre a été modifié
      const noteTitle = title.trim() || "Nouvel enregistrement";

      let finalId = note.id;
      if (noteTitle !== note.name) {
        finalId = await handleRename(note.id, noteTitle, false);
      }

      // Mise à jour du corps dans le tree (et débounce vers le disque)
      updateNote(finalId, audioMarkdown, note.frontmatter);

      // Navigation vers la nouvelle note
      setNoteBackStack([]);
      setOpenTabIds((prev) =>
        prev.includes(finalId) ? prev : [...prev, finalId]
      );
      setActiveNoteId(finalId);
      setDictaphoneMode(null);
      setMobileView("editor");
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
    setDictaphoneMode,
    setMobileView,
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
    if (status === "recording" || status === "paused")
      recorder.cancelRecording();
    setDictaphoneMode(null);
    setMobileView(dictaphoneMode === "insert" ? "editor" : "filetree");
  }, [status, recorder, dictaphoneMode, setDictaphoneMode, setMobileView]);

  // Nettoyage si le composant se démonte pendant l'enregistrement
  useEffect(() => {
    return () => {
      if (recorder.isRecording) recorder.cancelRecording();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Le canvas résoud la couleur dans son propre espace, il faut donc que la prop css soit connue du DOM avant de le passer
  const resolved_color = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-red-400")
    .trim();

  return (
    <div className="flex flex-col h-full w-full fixed bg-white">
      {/* Header */}
      <div className="flex items-center w-full justify-between px-2 py-2 border-b bg-white border-gray-100 fixed top-0 pt-12 z-30">
        <button
          type="button"
          onClick={handleCancel}
          disabled={status === "processing"}
          className="flex-1 justify-start flex items-center gap-1 px-2 py-1.5 rounded-lg text-amber-500 active:bg-gray-100 transition-colors disabled:opacity-40"
        >
          <SFIcon icon={sfChevronLeft} className="size-4" />
          <span className="text-base">Annuler</span>
        </button>
      </div>

      {/* Corps */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 pt-24 px-6 pb-12">
        {/* Champ titre (mode new-note uniquement) */}
        {dictaphoneMode === "new-note" && (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la note"
            disabled={status === "processing"}
            className="w-full text-center text-xl font-medium border-0 border-b-2 border-gray-200 focus:border-amber-400 outline-none py-2 text-gray-800 bg-transparent disabled:opacity-40"
          />
        )}

        {/* Forme d'onde */}
        <div className="flex items-center justify-center w-full">
          <WaveformDisplay
            isActive={status === "recording" || status === "paused"}
            width={300}
            height={72}
            color={resolved_color}
          />
        </div>

        {/* Chronomètre */}
        <span
          className={[
            "text-4xl font-mono tabular-nums tracking-widest",
            status === "recording"
              ? "text-red-500"
              : status === "paused"
                ? "text-amber-400"
                : "text-gray-300",
          ].join(" ")}
        >
          {formatTime(Math.floor(recorder.durationMs / 1000))}
        </span>

        {/* Message statut */}
        {status === "processing" && (
          <span className="text-sm text-gray-400">Traitement en cours…</span>
        )}
        {status === "error" && (
          <span className="text-sm text-red-500">{errorMsg}</span>
        )}

        {/* Bouton principal */}
        {status === "idle" && (
          <button
            type="button"
            onClick={handleRecord}
            className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <SFIcon icon={sfMicrophoneFill} className="size-9 text-white" />
          </button>
        )}

        {(status === "recording" || status === "paused") && (
          <div className="flex items-center gap-6">
            {/* Pause / Reprendre */}
            {status === "recording" ? (
              <button
                type="button"
                onClick={handlePause}
                className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center shadow active:scale-95 transition-transform"
              >
                <SFIcon icon={sfPauseFill} className="size-6 text-gray-700" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResume}
                className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center shadow active:scale-95 transition-transform"
              >
                <SFIcon icon={sfPlayFill} className="size-6 text-amber-500" />
              </button>
            )}

            {/* Stop */}
            <button
              type="button"
              onClick={handleStop}
              className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <SFIcon icon={sfStopFill} className="size-9 text-white" />
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
      </div>
    </div>
  );
}
