// Lecteur audio autonome (sans couplage ProseMirror), design identique à AudioBlockComponent.
// Utilisé par MediaViewer pour afficher les fichiers .mp3/.wav/.m4a/.ogg/.aac du vault.

import { readFile } from "@tauri-apps/plugin-fs";
import { useEffect, useRef, useState } from "react";
import {
  IconPauseFill,
  IconPlayFill,
  IconWaveform,
} from "../../../shared/components/PlatformIcon";
import { createLogger } from "../../../shared/lib/logger";
import {
  nativeIsActive,
  nativeLoad,
  nativePause,
  nativePlay,
  nativeSeek,
  nativeSubscribe,
} from "../../../shared/lib/nativeAudioPlayer";
import { isMobile } from "../../../shared/lib/platform";
import { drawWaveform } from "../../../shared/plugins/audio-block/waveform";

const log = createLogger("standalone-audio-player");

let _globalDesktopStop: (() => void) | null = null;

function safeStopSource(ref: { current: AudioBufferSourceNode | null }) {
  if (!ref.current) return;
  ref.current.onended = null;
  try {
    ref.current.stop();
  } catch {
    /* déjà stoppé */
  }
  ref.current = null;
}

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function StandaloneAudioPlayer({
  filePath,
  nodeId,
}: {
  filePath: string;
  nodeId: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveformStatus, setWaveformStatus] = useState<"loading" | "ready" | "error">("loading");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressOverlayRef = useRef<HTMLDivElement>(null);
  const timeLeftRef = useRef<HTMLSpanElement>(null);
  const timeRightRef = useRef<HTMLSpanElement>(null);
  const waveformReadyRef = useRef(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playStartCtxTimeRef = useRef(0);
  const playOffsetRef = useRef(0);
  const webRafRef = useRef(0);
  const isActiveRef = useRef(false);
  const nativeDurationRef = useRef(0);

  // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
  const BASE_NULL = { baseDir: null } as any;

  useEffect(() => {
    setWaveformStatus("loading");
    waveformReadyRef.current = false;

    if (!isMobile) {
      safeStopSource(sourceRef);
      if (webRafRef.current) {
        cancelAnimationFrame(webRafRef.current);
        webRafRef.current = 0;
      }
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      audioBufferRef.current = null;
      isActiveRef.current = false;
      setIsPlaying(false);
    }

    let cancelled = false;

    readFile(filePath, BASE_NULL)
      .then((data) => {
        if (cancelled || !canvasRef.current) return;

        if (!isMobile) {
          const ctx = new AudioContext();
          audioCtxRef.current = ctx;

          drawWaveform(
            canvasRef.current,
            ctx,
            data.buffer.slice(0),
            (audioBuffer) => {
              if (cancelled) return;
              audioBufferRef.current = audioBuffer;
              waveformReadyRef.current = true;
              setWaveformStatus("ready");
              if (timeRightRef.current) {
                timeRightRef.current.textContent = fmtTime(audioBuffer.duration);
              }
            },
            (err) => {
              log.error("waveform impossible", err);
              if (!cancelled) setWaveformStatus("error");
            }
          );
        } else {
          const tempCtx = new AudioContext();
          drawWaveform(
            canvasRef.current,
            tempCtx,
            data.buffer.slice(0),
            () => {
              if (cancelled) return;
              tempCtx.close();
              waveformReadyRef.current = true;
              setWaveformStatus("ready");
            },
            (err) => {
              tempCtx.close();
              log.error("waveform impossible", err);
              if (!cancelled) setWaveformStatus("error");
            }
          );
        }
      })
      .catch((err) => {
        log.error("lecture fichier audio échouée", { filePath, err });
        if (!cancelled) setWaveformStatus("error");
      });

    return () => {
      cancelled = true;
      if (!isMobile) {
        if (isActiveRef.current) {
          _globalDesktopStop = null;
          isActiveRef.current = false;
        }
        safeStopSource(sourceRef);
        if (webRafRef.current) {
          cancelAnimationFrame(webRafRef.current);
          webRafRef.current = 0;
        }
        audioCtxRef.current?.close();
        audioCtxRef.current = null;
        audioBufferRef.current = null;
      }
    };
  }, [filePath]);

  useEffect(() => {
    if (!isMobile) return;
    return nativeSubscribe(nodeId, (state) => {
      const { currentTime, duration, isPlaying: playing, status } = state;
      if (duration > 0) nativeDurationRef.current = duration;

      const d = duration > 0 ? duration : nativeDurationRef.current;
      const pct = d > 0 ? (currentTime / d) * 100 : 0;

      if (progressOverlayRef.current) {
        progressOverlayRef.current.style.width = `${pct}%`;
      }
      if (timeLeftRef.current) timeLeftRef.current.textContent = fmtTime(currentTime);
      if (timeRightRef.current && d > 0) timeRightRef.current.textContent = fmtTime(d);
      if (waveformReadyRef.current && canvasRef.current && (canvasRef.current as any)._drawBars) {
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

  function stopDesktopRaf() {
    if (webRafRef.current) {
      cancelAnimationFrame(webRafRef.current);
      webRafRef.current = 0;
    }
  }

  function startDesktopRaf() {
    if (webRafRef.current) return;
    function tick() {
      const ctx = audioCtxRef.current;
      const buf = audioBufferRef.current;
      if (!ctx || !buf || !sourceRef.current) {
        webRafRef.current = 0;
        return;
      }
      const pos = Math.min(
        playOffsetRef.current + (ctx.currentTime - playStartCtxTimeRef.current),
        buf.duration
      );
      const pct = (pos / buf.duration) * 100;
      if (progressOverlayRef.current) progressOverlayRef.current.style.width = `${pct}%`;
      if (timeLeftRef.current) timeLeftRef.current.textContent = fmtTime(pos);
      if (waveformReadyRef.current && (canvasRef.current as any)?._drawBars) {
        (canvasRef.current as any)._drawBars("rgba(0,0,0,0.18)", pct / 100);
      }
      webRafRef.current = requestAnimationFrame(tick);
    }
    webRafRef.current = requestAnimationFrame(tick);
  }

  function stopDesktopPlayback(resetPosition: boolean) {
    isActiveRef.current = false;
    stopDesktopRaf();
    safeStopSource(sourceRef);
    if (resetPosition) {
      playOffsetRef.current = 0;
      if (progressOverlayRef.current) progressOverlayRef.current.style.width = "0%";
      if (timeLeftRef.current) timeLeftRef.current.textContent = "0:00";
      if (waveformReadyRef.current && (canvasRef.current as any)?._drawBars) {
        (canvasRef.current as any)._drawBars("rgba(0,0,0,0.18)", 0);
      }
    }
    setIsPlaying(false);
  }

  async function togglePlayback() {
    if (isMobile) {
      if (nativeIsActive(nodeId)) {
        if (isPlaying) {
          try { setIsPlaying((await nativePause()).isPlaying); }
          catch (err) { log.error("pause échouée", err); }
        } else {
          try { setIsPlaying((await nativePlay(nodeId)).isPlaying); }
          catch (err) { log.error("reprise échouée", err); }
        }
      } else {
        try {
          await nativeLoad(nodeId, filePath);
          setIsPlaying((await nativePlay(nodeId)).isPlaying);
        } catch (err) {
          log.error("lecture échouée", err);
        }
      }
      return;
    }

    const ctx = audioCtxRef.current;
    const buf = audioBufferRef.current;
    if (!ctx || !buf) return;

    if (isPlaying) {
      playOffsetRef.current += ctx.currentTime - playStartCtxTimeRef.current;
      safeStopSource(sourceRef);
      stopDesktopRaf();
      setIsPlaying(false);
    } else {
      if (!isActiveRef.current) {
        _globalDesktopStop?.();
        isActiveRef.current = true;
        _globalDesktopStop = () => stopDesktopPlayback(true);
      }

      if (ctx.state === "suspended") await ctx.resume();
      if (ctx.state === "closed") return;

      if (playOffsetRef.current >= buf.duration) playOffsetRef.current = 0;

      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.connect(ctx.destination);
      source.onended = () => {
        if (sourceRef.current !== source) return;
        sourceRef.current = null;
        isActiveRef.current = false;
        _globalDesktopStop = null;
        playOffsetRef.current = 0;
        stopDesktopRaf();
        setIsPlaying(false);
        if (progressOverlayRef.current) progressOverlayRef.current.style.width = "0%";
        if (timeLeftRef.current) timeLeftRef.current.textContent = "0:00";
        if (waveformReadyRef.current && (canvasRef.current as any)?._drawBars) {
          (canvasRef.current as any)._drawBars("rgba(0,0,0,0.18)", 0);
        }
      };

      playStartCtxTimeRef.current = ctx.currentTime;
      source.start(0, playOffsetRef.current);
      sourceRef.current = source;
      setIsPlaying(true);
      startDesktopRaf();
    }
  }

  async function handleWaveformClick(e: React.MouseEvent<HTMLDivElement>) {
    const ctx = audioCtxRef.current;
    const buf = audioBufferRef.current;
    if (!ctx || !buf) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const newOffset = ((e.clientX - rect.left) / rect.width) * buf.duration;

    if (isPlaying && sourceRef.current) {
      safeStopSource(sourceRef);
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.connect(ctx.destination);
      source.onended = () => {
        if (sourceRef.current !== source) return;
        sourceRef.current = null;
        isActiveRef.current = false;
        _globalDesktopStop = null;
        playOffsetRef.current = 0;
        stopDesktopRaf();
        setIsPlaying(false);
        if (progressOverlayRef.current) progressOverlayRef.current.style.width = "0%";
        if (timeLeftRef.current) timeLeftRef.current.textContent = "0:00";
        if (waveformReadyRef.current && (canvasRef.current as any)?._drawBars) {
          (canvasRef.current as any)._drawBars("rgba(0,0,0,0.18)", 0);
        }
      };
      playOffsetRef.current = newOffset;
      playStartCtxTimeRef.current = ctx.currentTime;
      source.start(0, newOffset);
      sourceRef.current = source;
    } else {
      playOffsetRef.current = newOffset;
      const pct = (newOffset / buf.duration) * 100;
      if (progressOverlayRef.current) progressOverlayRef.current.style.width = `${pct}%`;
      if (timeLeftRef.current) timeLeftRef.current.textContent = fmtTime(newOffset);
      if (waveformReadyRef.current && (canvasRef.current as any)?._drawBars) {
        (canvasRef.current as any)._drawBars("rgba(0,0,0,0.18)", pct / 100);
      }
    }
  }

  async function handleWaveformTouch(e: React.TouchEvent<HTMLDivElement>) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (!touch || !nativeIsActive(nodeId) || nativeDurationRef.current <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (touch.clientX - rect.left) / rect.width;
    try {
      await nativeSeek(pct * nativeDurationRef.current);
    } catch (err) {
      log.error("seek échoué", err);
    }
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
    <div
      className="flex flex-col rounded-2xl relative select-none px-5 py-3 border bg-gray-50 border-black/10"
      style={{ fontFamily: "'Inter', Arial, Helvetica, sans-serif" }}
    >
      {/* Icône */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-red-400">
          <IconWaveform className="size-4" aria-hidden="true" />
        </div>
      </div>

      {/* Waveform */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
      <div
        className="relative h-12 rounded-xl overflow-hidden bg-black/03 cursor-pointer active:opacity-85"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={isMobile ? (e) => e.preventDefault() : undefined}
        onTouchEnd={isMobile ? handleWaveformTouch : undefined}
        onClick={isMobile ? undefined : handleWaveformClick}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={96}
          className="block w-full h-full select-none"
        />
        <div
          ref={progressOverlayRef}
          className="absolute top-0 left-0 h-full pointer-events-none bg-amber-300/10 border-r-2 border-r-amber-400"
          style={{ width: "0%" }}
        />
        {waveformStatus !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-gray-400 tracking-[0.02em]">
            {waveformStatus === "loading" ? "Chargement de l'audio..." : "Aperçu audio indisponible"}
          </div>
        )}
      </div>

      {/* Contrôles */}
      <div className="flex items-center gap-2.5 mt-2.5">
        <button
          type="button"
          aria-label={isPlaying ? "Pause" : "Lecture"}
          className="w-8 h-8 rounded-full bg-amber-400/80 text-white border-none cursor-pointer flex items-center justify-center shrink-0 p-0 transition-[transform,background] duration-120 hover:bg-amber-400 hover:scale-[1.06] active:scale-95"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={isMobile ? (e) => e.preventDefault() : undefined}
          onTouchEnd={isMobile ? async (e) => { e.preventDefault(); await togglePlayback(); } : undefined}
          onClick={isMobile ? undefined : () => togglePlayback()}
        >
          {isPlaying ? (
            <IconPauseFill className="size-3" aria-hidden="true" />
          ) : (
            <IconPlayFill className="size-3" aria-hidden="true" />
          )}
        </button>

        <div className="flex-1">
          <div className="flex justify-between text-[10px] text-gray-400 tabular-nums select-none">
            <span ref={timeLeftRef}>0:00</span>
            <span ref={timeRightRef}>--:--</span>
          </div>
        </div>
      </div>
    </div>
  );
}
