// Composant React du bloc audio : waveform statique + lecture via tauri-plugin-native-audio.
// Le NodeView shell (node-view.ts) est seul à appeler root.render() — ce composant
// ne déclenche jamais de re-render pour les mises à jour haute-fréquence (progress, time).

import { useEffect, useRef, useState } from "react";
import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { AudioBlockConfig } from "./config";
import {
  nativeIsActive,
  nativeLoad,
  nativePause,
  nativePlay,
  nativeSeek,
  nativeSubscribe,
} from "../../lib/nativeAudioPlayer";
import { isMobile } from "../../lib/platform";
import { drawWaveform } from "./waveform";
import { createLogger } from "../../lib/logger";

const log = createLogger("audio-block");

function fmtTime(s: number): string {
  if (!isFinite(s)) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export type AudioBlockProps = {
  nodeRef: { current: ProsemirrorNode };
  selectedRef: { current: boolean };
  // Partagé avec le shell pour que stopEvent puisse bloquer les events clavier
  titleEditingRef: { current: boolean };
  view: EditorView;
  getPos: () => number | undefined;
  config: AudioBlockConfig;
  nodeId: string;
};

export function AudioBlockComponent({
  nodeRef,
  selectedRef,
  titleEditingRef,
  view,
  getPos,
  config,
  nodeId,
}: AudioBlockProps) {
  const node = nodeRef.current;
  const src = node.attrs.src as string;

  const [isPlaying, setIsPlaying] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [waveformStatus, setWaveformStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressOverlayRef = useRef<HTMLDivElement>(null);
  const timeLeftRef = useRef<HTMLSpanElement>(null);
  const timeRightRef = useRef<HTMLSpanElement>(null);
  const waveformReadyRef = useRef(false);
  const nativeDurationRef = useRef(0);
  // Ref stable vers readAudioData pour éviter de le mettre en dépendance d'effet
  const readAudioDataRef = useRef(config.readAudioData);
  readAudioDataRef.current = config.readAudioData;
  // Blob URL pré-créée depuis les octets de la waveform (desktop uniquement) :
  // évite un fetch via le protocole asset:// au moment de play(), qui causait un stutter ~1s.
  const playbackBlobUrlRef = useRef<string | null>(null);

  // ── Waveform : décode et dessine à chaque changement de src ────────────────

  useEffect(() => {
    const readAudioData = readAudioDataRef.current;
    if (!src || !readAudioData) {
      setWaveformStatus("error");
      return;
    }
    setWaveformStatus("loading");
    waveformReadyRef.current = false;

    // Révoquer l'ancienne blob URL avant d'en créer une nouvelle
    if (!isMobile && playbackBlobUrlRef.current) {
      URL.revokeObjectURL(playbackBlobUrlRef.current);
      playbackBlobUrlRef.current = null;
    }

    let cancelled = false;

    readAudioData(src)
      .then((data) => {
        if (cancelled) return;

        // Créer la blob URL pendant le chargement de la waveform (données déjà en mémoire)
        if (!isMobile) {
          playbackBlobUrlRef.current = URL.createObjectURL(new Blob([data]));
        }

        if (!canvasRef.current) return;
        drawWaveform(
          canvasRef.current,
          data.buffer.slice(0),
          () => {
            if (cancelled) return;
            waveformReadyRef.current = true;
            setWaveformStatus("ready");
          },
          (err) => {
            log.error("waveform impossible", err);
            if (!cancelled) setWaveformStatus("error");
          }
        );
      })
      .catch((err) => {
        log.error("lecture fichier pour waveform échouée", err);
        if (!cancelled) setWaveformStatus("error");
      });

    return () => {
      cancelled = true;
      if (!isMobile && playbackBlobUrlRef.current) {
        URL.revokeObjectURL(playbackBlobUrlRef.current);
        playbackBlobUrlRef.current = null;
      }
    };
  }, [src]);

  // ── Abonnement au lecteur natif : DOM direct pour éviter les re-renders ────

  useEffect(() => {
    return nativeSubscribe(nodeId, (state) => {
      const { currentTime, duration, isPlaying: playing, status } = state;
      if (duration > 0) nativeDurationRef.current = duration;

      const d = duration > 0 ? duration : nativeDurationRef.current;
      const pct = d > 0 ? (currentTime / d) * 100 : 0;

      if (progressOverlayRef.current) {
        progressOverlayRef.current.style.width = `${pct}%`;
      }
      if (timeLeftRef.current) {
        timeLeftRef.current.textContent = fmtTime(currentTime);
      }
      if (timeRightRef.current && d > 0) {
        timeRightRef.current.textContent = fmtTime(d);
      }
      if (
        waveformReadyRef.current &&
        canvasRef.current &&
        (canvasRef.current as any)._drawBars
      ) {
        (canvasRef.current as any)._drawBars("rgba(0,0,0,0.18)", pct / 100);
      }

      if (status === "ended") {
        setIsPlaying(false);
        if (progressOverlayRef.current) progressOverlayRef.current.style.width = "0%";
        if (timeLeftRef.current) timeLeftRef.current.textContent = "0:00";
        if (waveformReadyRef.current && canvasRef.current && (canvasRef.current as any)._drawBars) {
          (canvasRef.current as any)._drawBars("rgba(0,0,0,0.18)", 0);
        }
      } else {
        setIsPlaying(playing);
      }
    });
  }, [nodeId]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function getPlaybackSrc(): Promise<string> {
    if (isMobile) {
      // Chemin absolu pour tauri-plugin-native-audio
      if (config.resolveAbsolutePath) return config.resolveAbsolutePath(src);
      return src;
    }
    // Blob URL préchargée (données déjà en mémoire depuis la waveform, pas de fetch)
    if (playbackBlobUrlRef.current) return playbackBlobUrlRef.current;
    // Fallback si la waveform n'a pas encore chargé
    if (config.resolveAudioPath) return await config.resolveAudioPath(src);
    if (config.resolveAbsolutePath) return config.resolveAbsolutePath(src);
    return src;
  }

  async function handlePlayClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (nativeIsActive(nodeId)) {
      if (isPlaying) {
        try {
          const state = await nativePause();
          setIsPlaying(state.isPlaying);
        } catch (err) {
          log.error("pause échouée", err);
        }
      } else {
        // Reprendre depuis la position actuelle sans recharger la source
        try {
          const state = await nativePlay(nodeId);
          setIsPlaying(state.isPlaying);
        } catch (err) {
          log.error("reprise échouée", err);
        }
      }
    } else {
      try {
        const title = (node.attrs.title as string) || undefined;
        const playbackSrc = await getPlaybackSrc();
        await nativeLoad(nodeId, playbackSrc, title);
        const state = await nativePlay(nodeId);
        setIsPlaying(state.isPlaying);
      } catch (err) {
        log.error("lecture échouée", err);
      }
    }
  }

  async function handleWaveformClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (!nativeIsActive(nodeId) || nativeDurationRef.current <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    try {
      await nativeSeek(pct * nativeDurationRef.current);
    } catch (err) {
      log.error("seek waveform échoué", err);
    }
  }

  function handleTitleDblClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    titleEditingRef.current = true;
    setTitleEditing(true);
  }

  function handleTitleBlur(e: React.FocusEvent<HTMLInputElement>) {
    titleEditingRef.current = false;
    setTitleEditing(false);
    const pos = getPos();
    if (pos === undefined) return;
    const newTitle = e.currentTarget.value.trim();
    view.dispatch(
      view.state.tr.setNodeMarkup(pos, undefined, {
        ...nodeRef.current.attrs,
        title: newTitle,
      })
    );
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      e.currentTarget.value =
        (nodeRef.current.attrs.title as string) ||
        (nodeRef.current.attrs.src as string) ||
        "Audio";
      e.currentTarget.blur();
    }
  }

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    const pos = getPos();
    if (pos === undefined) return;
    view.dispatch(view.state.tr.delete(pos, pos + nodeRef.current.nodeSize));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const filename = src.split(/[/\\]/).pop() ?? "";
  const displayTitle = (node.attrs.title as string) || src || "Audio";
  const isSelected = selectedRef.current;

  return (
    <div
      className={[
        "group flex flex-col rounded-2xl my-2.5 relative select-none",
        "transition-[border-color,box-shadow] duration-200",
        "border bg-[var(--crepe-color-surface,rgba(248,248,248,0.92))]",
        isSelected
          ? "border-[rgba(0,122,255,0.5)] shadow-[0_0_0_3px_rgba(0,122,255,0.28)]"
          : "border-black/10 hover:border-black/[0.18]",
      ].join(" ")}
      style={{ padding: "14px 16px 12px" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-8 h-8 rounded-lg bg-[rgba(0,122,255,0.10)] flex items-center justify-center shrink-0 text-[#007AFF]">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M11 2.25a.75.75 0 0 1 .894-.735l3 .6A.75.75 0 0 1 15.5 2.85V9a2 2 0 1 1-1.5-.212V4.134l-1.5-.3V9.5a2 2 0 1 1-1.5-.212V2.25zM5 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm7 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          {titleEditing ? (
            <input
              type="text"
              defaultValue={displayTitle}
              // biome-ignore lint/a11y/noAutofocus: focus intentionnel après double-clic
              autoFocus
              className="w-full text-[13px] font-semibold tracking-[-0.1px] bg-transparent border-none outline-none rounded shadow-[0_0_0_2px_rgba(0,122,255,0.40)] px-0.5 text-[var(--crepe-color-on-surface,#111)]"
              onMouseDown={(e) => e.stopPropagation()}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
            />
          ) : (
            <div
              className="text-[13px] font-semibold text-[var(--crepe-color-on-surface,#111)] truncate tracking-[-0.1px] cursor-default"
              onDoubleClick={handleTitleDblClick}
            >
              {displayTitle}
            </div>
          )}
          <div className="text-[11px] text-[var(--crepe-color-muted,#999)] mt-px truncate">
            {/* TODO : ça ne marche pas, le path complet est affiché */}
            {filename}
          </div>
        </div>

        <button
          type="button"
          aria-label="Supprimer le bloc audio"
          className="shrink-0 w-[22px] h-[22px] rounded-full bg-black/[0.06] border-none cursor-pointer flex items-center justify-center p-0 opacity-0 group-hover:opacity-100 transition-[opacity,background] duration-150 hover:bg-[rgba(255,59,48,0.14)] hover:[&_svg]:text-[#FF3B30]"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleDelete}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-[#999] transition-colors duration-150"
            aria-hidden="true"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* ── Waveform ── */}
      <div
        className="relative h-12 rounded-[10px] overflow-hidden bg-black/[0.035] cursor-pointer active:opacity-85"
        data-ab-interactive="true"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleWaveformClick}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={96}
          className="block w-full h-full"
          style={{ WebkitUserSelect: "none", userSelect: "none" }}
        />
        <div
          ref={progressOverlayRef}
          className="absolute top-0 left-0 h-full pointer-events-none"
          style={{
            width: "0%",
            background: "rgba(0,122,255,0.10)",
            borderRight: "1.5px solid rgba(0,122,255,0.7)",
          }}
        />
        {waveformStatus !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-[#aaa] tracking-[0.02em]">
            {waveformStatus === "loading" ? "Chargement de l'audio..." : "Aperçu audio"}
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div
        className="flex items-center gap-2.5 mt-2.5"
        data-ab-interactive="true"
      >
        <button
          type="button"
          aria-label={isPlaying ? "Pause" : "Lecture"}
          className="w-8 h-8 rounded-full bg-[#007AFF] border-none cursor-pointer flex items-center justify-center shrink-0 p-0 transition-[transform,background] duration-[120ms] hover:bg-[#0A84FF] hover:scale-[1.06] active:scale-95"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handlePlayClick}
        >
          {isPlaying ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="white"
              aria-hidden="true"
            >
              <path d="M5 3h2v10H5V3zm4 0h2v10H9V3z" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="white"
              aria-hidden="true"
            >
              <path d="M5 3.5l7 4.5-7 4.5V3.5z" />
            </svg>
          )}
        </button>

        <div className="flex-1">
          <div
            className="flex justify-between text-[10px] text-[#999] tabular-nums"
            style={{ WebkitUserSelect: "none", userSelect: "none" }}
          >
            <span ref={timeLeftRef}>0:00</span>
            <span ref={timeRightRef}>--:--</span>
          </div>
        </div>
      </div>
    </div>
  );
}
