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
import SFIcon from "@bradleyhodges/sfsymbols-react";
import {
  sfPauseFill,
  sfPlayFill,
  sfWaveform,
  sfXmark,
} from "@bradleyhodges/sfsymbols";
import clsx from "clsx";
import { NodeSelection } from "@milkdown/kit/prose/state";

const log = createLogger("audio-block");

function fmtTime(s: number): string {
  if (!Number.isFinite(s)) return "--:--";
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
  const [waveformStatus, setWaveformStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");

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
        (canvasRef.current as any)._drawBars(
          /* TODO : les couleurs ne fonctionnent pas */
          "rgb(var(--color-amber-400))",
          pct / 100
        );
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
          (canvasRef.current as any)._drawBars(
            "rgb(var(--color-amber-400))",
            0
          );
        }
      } else {
        setIsPlaying(playing);
      }
    });
  }, [nodeId]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  //TODO: rajouter la barre espace quand le bloc est sélectionné pour jouer/pause. actuellement ça supprime le bloc... (ça édite le texte)
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
    /* TODO : rajouter le fait que ça sélectionne le bloc, et le handler pour la barre espace */
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
  //TODO : que le bloc soit sélectionné au clic (sur le bloc, sur les boutons, sur tout. ça va simplifier la lecture avec la barre espace)
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
      onClick={() => {
        /* TODO : vérifier que ça n'est pas n'importe quoi */
        const pos = getPos();
        if (pos === undefined) return;
        const tr = view.state.tr.setSelection(
          NodeSelection.create(view.state.doc, pos)
        );
        view.dispatch(tr);
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-red-400">
          <SFIcon icon={sfWaveform} className="size-4" aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0 ">
          {/* TODO : remplacer pas un EditableText*/}
          {titleEditing ? (
            <input
              type="text"
              defaultValue={displayTitle}
              // biome-ignore lint/a11y/noAutofocus: focus intentionnel après double-clic
              autoFocus
              className="w-full text-[13px] bg-gray-200/50 font-semibold tracking-[-0.1px] border-none outline-none px-0.5 text-gray-700"
              onMouseDown={(e) => e.stopPropagation()}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
            />
          ) : (
            <div
              className="text-[13px] font-semibold text-black truncate cursor-text hover:bg-gray-200/50"
              onDoubleClick={handleTitleDblClick}
            >
              {displayTitle}
            </div>
          )}
          <div className="text-[11px] text-(--crepe-color-muted,#999) mt-px truncate">
            {/* TODO : ça ne marche pas, le path complet est affiché */}
            {filename}
          </div>
        </div>

        <button
          type="button"
          aria-label="Supprimer le bloc audio"
          className="shrink-0 w-5.5 h-5.5 rounded-full bg-black/6 border-none cursor-pointer flex items-center justify-center p-0 opacity-0 group-hover:opacity-100 transition-[opacity,background] duration-150 hover:bg-red-200 hover:text-red-600"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleDelete}
        >
          <SFIcon icon={sfXmark} className="size-2" aria-hidden="true" />
        </button>
      </div>

      {/* ── Waveform ── */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
      <div
        className="relative h-12 rounded-xl overflow-hidden bg-black/03 cursor-pointer active:opacity-85"
        data-ab-interactive="true"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleWaveformClick}
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
          onClick={handlePlayClick}
        >
          {isPlaying ? (
            <SFIcon icon={sfPauseFill} className="size-3" aria-hidden="true" />
          ) : (
            <SFIcon icon={sfPlayFill} className="size-3" aria-hidden="true" />
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
