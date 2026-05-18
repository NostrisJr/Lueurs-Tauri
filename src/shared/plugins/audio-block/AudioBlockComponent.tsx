// Composant React du bloc audio.
// Desktop : lecture via AudioBufferSourceNode (Web Audio API).
//   L'AudioContext est créé lors du chargement de la waveform et reste ouvert —
//   cela maintient la session audio macOS initialisée et élimine le délai ~1s.
// Mobile : lecture via tauri-plugin-native-audio (nativeAudioPlayer).

import {
  IconPauseFill,
  IconPlayFill,
  IconWaveform,
  IconXmark,
} from "../../components/PlatformIcon";
import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";
import { NodeSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { createLogger } from "../../lib/logger";
import {
  nativeIsActive,
  nativeLoad,
  nativePause,
  nativePlay,
  nativeSeek,
  nativeSubscribe,
} from "../../lib/nativeAudioPlayer";
import { isMobile } from "../../lib/platform";
import type { AudioBlockConfig } from "./config";
import { drawWaveform } from "./waveform";

const log = createLogger("audio-block");

// Coordination multi-bloc (desktop) : quand un bloc démarre, on arrête l'autre.
let _globalDesktopStop: (() => void) | null = null;

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export type AudioBlockProps = {
  nodeRef: { current: ProsemirrorNode };
  selectedRef: { current: boolean };
  // Partagé avec le shell pour que stopEvent puisse bloquer les events clavier
  titleEditingRef: { current: boolean };
  // Partagé avec le shell pour que la barre espace déclenche play/pause
  playToggleRef: { current: () => void };
  view: EditorView;
  getPos: () => number | undefined;
  config: AudioBlockConfig;
  nodeId: string;
};

export function AudioBlockComponent({
  nodeRef,
  selectedRef,
  titleEditingRef,
  playToggleRef,
  view,
  getPos,
  config,
  nodeId,
}: AudioBlockProps) {
  const node = nodeRef.current;
  const src = node.attrs.src as string;

  const [isPlaying, setIsPlaying] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [waveformStatus, setWaveformStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressOverlayRef = useRef<HTMLDivElement>(null);
  const timeLeftRef = useRef<HTMLSpanElement>(null);
  const timeRightRef = useRef<HTMLSpanElement>(null);
  const waveformReadyRef = useRef(false);
  const titleLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Refs Web Audio (desktop) ───────────────────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  // ctx.currentTime au moment où play() a démarré (pour calculer la position courante)
  const playStartCtxTimeRef = useRef(0);
  // Position dans l'audio au dernier play/seek (en secondes)
  const playOffsetRef = useRef(0);
  const webRafRef = useRef(0);
  // Indique si ce bloc est le bloc desktop actif (pour la coordination multi-bloc)
  const isActiveRef = useRef(false);

  // ── Refs Mobile ────────────────────────────────────────────────────────────
  const nativeDurationRef = useRef(0);

  // Ref stable vers readAudioData pour éviter de le mettre en dépendance d'effet
  const readAudioDataRef = useRef(config.readAudioData);
  readAudioDataRef.current = config.readAudioData;

  // ── Waveform : décode et dessine à chaque changement de src ────────────────

  useEffect(() => {
    const readAudioData = readAudioDataRef.current;
    if (!src || !readAudioData) {
      setWaveformStatus("error");
      return;
    }
    setWaveformStatus("loading");
    waveformReadyRef.current = false;

    // Fermer le contexte précédent si src change pendant la lecture
    if (!isMobile) {
      if (sourceRef.current) {
        sourceRef.current.onended = null;
        try {
          sourceRef.current.stop();
        } catch {}
        sourceRef.current = null;
      }
      stopDesktopRaf();
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      audioBufferRef.current = null;
      isActiveRef.current = false;
      setIsPlaying(false);
    }

    let cancelled = false;

    readAudioData(src)
      .then((data) => {
        if (cancelled || !canvasRef.current) return;

        if (!isMobile) {
          // Créer l'AudioContext ici et le garder ouvert :
          // le décodage initialise la session audio macOS, ce qui évite
          // le délai ~1s lors du premier play (ctx.close() libérerait la session).
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
              // Afficher la durée dès le décodage
              if (timeRightRef.current) {
                timeRightRef.current.textContent = fmtTime(
                  audioBuffer.duration
                );
              }
            },
            (err) => {
              log.error("waveform impossible", err);
              if (!cancelled) setWaveformStatus("error");
            }
          );
        } else {
          // Mobile : décoder séparément pour la waveform uniquement
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
        log.error("lecture fichier pour waveform échouée", err);
        if (!cancelled) setWaveformStatus("error");
      });

    return () => {
      cancelled = true;
      if (!isMobile) {
        audioCtxRef.current?.close();
        audioCtxRef.current = null;
        audioBufferRef.current = null;
      }
    };
  }, [src]);

  // ── Abonnement lecteur natif (mobile uniquement) ───────────────────────────

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
        if (progressOverlayRef.current)
          progressOverlayRef.current.style.width = "0%";
        if (timeLeftRef.current) timeLeftRef.current.textContent = "0:00";
        if (
          waveformReadyRef.current &&
          canvasRef.current &&
          (canvasRef.current as any)._drawBars
        ) {
          (canvasRef.current as any)._drawBars("rgba(0,0,0,0.18)", 0);
        }
      } else {
        setIsPlaying(playing);
      }
    });
  }, [nodeId]);

  // ── Helpers desktop ────────────────────────────────────────────────────────

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
      if (progressOverlayRef.current)
        progressOverlayRef.current.style.width = `${pct}%`;
      if (timeLeftRef.current) timeLeftRef.current.textContent = fmtTime(pos);
      if (waveformReadyRef.current && (canvasRef.current as any)?._drawBars)
        (canvasRef.current as any)._drawBars("rgba(0,0,0,0.18)", pct / 100);
      webRafRef.current = requestAnimationFrame(tick);
    }
    webRafRef.current = requestAnimationFrame(tick);
  }

  // Arrête la lecture desktop et réinitialise l'UI (appelé aussi depuis _globalDesktopStop)
  function stopDesktopPlayback(resetPosition: boolean) {
    isActiveRef.current = false;
    stopDesktopRaf();
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      try {
        sourceRef.current.stop();
      } catch {}
      sourceRef.current = null;
    }
    if (resetPosition) {
      playOffsetRef.current = 0;
      if (progressOverlayRef.current)
        progressOverlayRef.current.style.width = "0%";
      if (timeLeftRef.current) timeLeftRef.current.textContent = "0:00";
      if (waveformReadyRef.current && (canvasRef.current as any)?._drawBars)
        (canvasRef.current as any)._drawBars("rgba(0,0,0,0.18)", 0);
    }
    setIsPlaying(false);
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function getPlaybackSrc(): Promise<string> {
    if (config.resolveAbsolutePath) return config.resolveAbsolutePath(src);
    return src;
  }

  async function togglePlayback() {
    // ── Mobile ─────────────────────────────────────────────────────────────
    if (isMobile) {
      if (nativeIsActive(nodeId)) {
        if (isPlaying) {
          try {
            const state = await nativePause();
            setIsPlaying(state.isPlaying);
          } catch (err) {
            log.error("pause échouée", err);
          }
        } else {
          try {
            const state = await nativePlay(nodeId);
            setIsPlaying(state.isPlaying);
          } catch (err) {
            log.error("reprise échouée", err);
          }
        }
      } else {
        try {
          const playbackSrc = await getPlaybackSrc();
          const title = (node.attrs.title as string) || undefined;
          await nativeLoad(nodeId, playbackSrc, title);
          const state = await nativePlay(nodeId);
          setIsPlaying(state.isPlaying);
        } catch (err) {
          log.error("lecture échouée", err);
        }
      }
      return;
    }

    // ── Desktop : Web Audio API ─────────────────────────────────────────────
    const ctx = audioCtxRef.current;
    const buf = audioBufferRef.current;
    if (!ctx || !buf) {
      log.error("audio non prêt (waveform pas encore chargée ?)");
      return;
    }

    if (isPlaying) {
      // Pause : mémoriser la position pour la reprise
      playOffsetRef.current += ctx.currentTime - playStartCtxTimeRef.current;
      if (sourceRef.current) {
        sourceRef.current.onended = null;
        try {
          sourceRef.current.stop();
        } catch {}
        sourceRef.current = null;
      }
      stopDesktopRaf();
      setIsPlaying(false);
    } else {
      // Play (ou reprise après pause)

      // Arrêter un autre bloc s'il joue
      if (!isActiveRef.current) {
        _globalDesktopStop?.();
        isActiveRef.current = true;
        _globalDesktopStop = () => stopDesktopPlayback(true);
      }

      // Si le contexte est suspendu (première lecture), le reprendre.
      // C'est ici que la session audio macOS est activée — mais le décodage
      // préalable (decodeAudioData) l'a déjà initialisée, donc ctx.resume()
      // revient en quelques ms au lieu de ~1s.
      if (ctx.state === "suspended") await ctx.resume();
      if (ctx.state === "closed") {
        log.error("AudioContext fermé de façon inattendue");
        return;
      }

      // Si on a joué jusqu'au bout, repartir du début
      if (playOffsetRef.current >= buf.duration) {
        playOffsetRef.current = 0;
      }

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
        if (progressOverlayRef.current)
          progressOverlayRef.current.style.width = "0%";
        if (timeLeftRef.current) timeLeftRef.current.textContent = "0:00";
        if (waveformReadyRef.current && (canvasRef.current as any)?._drawBars)
          (canvasRef.current as any)._drawBars("rgba(0,0,0,0.18)", 0);
      };

      playStartCtxTimeRef.current = ctx.currentTime;
      source.start(0, playOffsetRef.current);
      sourceRef.current = source;

      setIsPlaying(true);
      startDesktopRaf();
    }
  }

  // Mis à jour à chaque render pour capturer isPlaying courant (pour la barre espace)
  playToggleRef.current = togglePlayback;

  // Desktop : sélectionne le nœud + focus + joue
  async function handlePlayClick(e: React.MouseEvent) {
    e.stopPropagation();
    const pos = getPos();
    if (pos !== undefined) {
      view.dispatch(
        view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos))
      );
      view.focus();
    }
    await togglePlayback();
  }

  // Mobile : joue directement, sans dispatch ni focus (évite l'ouverture du clavier)
  async function handlePlayTouch(e: React.TouchEvent) {
    e.preventDefault();
    await togglePlayback();
  }

  // Desktop : seek waveform
  async function handleWaveformClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    const pos = getPos();
    if (pos !== undefined) {
      view.dispatch(
        view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos))
      );
      view.focus();
    }

    const ctx = audioCtxRef.current;
    const buf = audioBufferRef.current;
    if (!ctx || !buf) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const newOffset = ((e.clientX - rect.left) / rect.width) * buf.duration;

    if (isPlaying && sourceRef.current) {
      sourceRef.current.onended = null;
      try {
        sourceRef.current.stop();
      } catch {}
      sourceRef.current = null;

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
        if (progressOverlayRef.current)
          progressOverlayRef.current.style.width = "0%";
        if (timeLeftRef.current) timeLeftRef.current.textContent = "0:00";
        if (waveformReadyRef.current && (canvasRef.current as any)?._drawBars)
          (canvasRef.current as any)._drawBars("rgba(0,0,0,0.18)", 0);
      };
      playOffsetRef.current = newOffset;
      playStartCtxTimeRef.current = ctx.currentTime;
      source.start(0, newOffset);
      sourceRef.current = source;
    } else {
      playOffsetRef.current = newOffset;
      const pct = (newOffset / buf.duration) * 100;
      if (progressOverlayRef.current)
        progressOverlayRef.current.style.width = `${pct}%`;
      if (timeLeftRef.current)
        timeLeftRef.current.textContent = fmtTime(newOffset);
      if (waveformReadyRef.current && (canvasRef.current as any)?._drawBars)
        (canvasRef.current as any)._drawBars("rgba(0,0,0,0.18)", pct / 100);
    }
  }

  // Mobile : seek waveform natif, sans dispatch ni focus
  async function handleWaveformTouch(e: React.TouchEvent<HTMLDivElement>) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (!touch || !nativeIsActive(nodeId) || nativeDurationRef.current <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (touch.clientX - rect.left) / rect.width;
    try {
      await nativeSeek(pct * nativeDurationRef.current);
    } catch (err) {
      log.error("seek waveform échoué (touch)", err);
    }
  }

  function handleTitleDblClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    titleEditingRef.current = true;
    setTitleEditing(true);
  }

  function handleTitleTouchStart() {
    titleLongPressRef.current = setTimeout(() => {
      titleEditingRef.current = true;
      setTitleEditing(true);
    }, 600);
  }

  function handleTitleTouchEnd() {
    if (titleLongPressRef.current) {
      clearTimeout(titleLongPressRef.current);
      titleLongPressRef.current = null;
    }
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

  const displayTitle = (node.attrs.title as string) || src || "Audio";
  const isSelected = selectedRef.current;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
    <div
      className={clsx(
        "group flex flex-col rounded-2xl my-2.5 relative select-none cursor-pointer px-5 py-3",
        "transition-[border-color,box-shadow] duration-200",
        "border bg-gray-50",
        isSelected
          ? "border-amber-400 shadow-amber-700/20 shadow-lg"
          : "border-black/10 hover:border-black/18"
      )}
      style={{ fontFamily: "'Inter', Arial, Helvetica, sans-serif" }}
      onClick={isMobile ? undefined : () => {
        const pos = getPos();
        if (pos === undefined) return;
        view.dispatch(
          view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos))
        );
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-red-400">
          <IconWaveform className="size-4" aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0 ">
          {titleEditing ? (
            <input
              type="text"
              defaultValue={displayTitle}
              // biome-ignore lint/a11y/noAutofocus: focus intentionnel après double-clic
              autoFocus
              className="w-full text-base bg-gray-200/50 font-semibold border-none outline-none px-0.5 text-gray-700"
              onMouseDown={(e) => e.stopPropagation()}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
            />
          ) : (
            <div
              className="text-[13px] font-semibold text-black truncate cursor-text hover:bg-gray-200/50"
              onDoubleClick={handleTitleDblClick}
              onTouchStart={isMobile ? handleTitleTouchStart : undefined}
              onTouchEnd={isMobile ? handleTitleTouchEnd : undefined}
              onTouchMove={isMobile ? handleTitleTouchEnd : undefined}
              onTouchCancel={isMobile ? handleTitleTouchEnd : undefined}
            >
              {displayTitle}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="Supprimer le bloc audio"
          className="shrink-0 w-5.5 h-5.5 rounded-full bg-black/6 border-none cursor-pointer flex items-center justify-center p-0 opacity-0 group-hover:opacity-100 transition-[opacity,background] duration-150 hover:bg-red-200 hover:text-red-600"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleDelete}
        >
          <IconXmark className="size-2" aria-hidden="true" />
        </button>
      </div>

      {/* ── Waveform ── */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
      <div
        className="relative h-12 rounded-xl overflow-hidden bg-black/03 cursor-pointer active:opacity-85"
        data-ab-interactive="true"
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
          className="absolute top-0 left-0 h-full pointer-events-none w-full bg-amber-300/10 border-r-2 border-r-amber-400"
          style={{ width: "0%" }}
        />
        {waveformStatus !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-gray-400 tracking-[0.02em]">
            {waveformStatus === "loading"
              ? "Chargement de l'audio..."
              : "Aperçu audio"}
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
          className="w-8 h-8 rounded-full bg-amber-400/80 text-white border-none cursor-pointer flex items-center justify-center shrink-0 p-0 transition-[transform,background] duration-120 hover:bg-amber-400 hover:scale-[1.06] active:scale-95"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={isMobile ? (e) => e.preventDefault() : undefined}
          onTouchEnd={isMobile ? handlePlayTouch : undefined}
          onClick={isMobile ? undefined : handlePlayClick}
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
