// Lecteur audio unifié : tauri-plugin-native-audio sur iOS/Android, HTML5 sur desktop.
// API identique dans les deux cas — les consommateurs n'ont pas à connaître la plateforme.

import {
  initialize,
  setSource,
  play,
  pause,
  seekTo,
  addStateListener,
} from "tauri-plugin-native-audio-api";
import type { NativeAudioState } from "tauri-plugin-native-audio-api";
import { isMobile } from "./platform";
import { createLogger } from "./logger";

type StateCallback = (state: NativeAudioState) => void;

const log = createLogger("audio-player");

const IDLE_STATE: NativeAudioState = {
  status: "idle",
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  buffering: false,
  rate: 1,
};

// ── État partagé ──────────────────────────────────────────────────────────────

let activeNodeId: string | null = null;
const subscribers = new Map<string, StateCallback>();

function dispatch(state: NativeAudioState) {
  if (activeNodeId) subscribers.get(activeNodeId)?.(state);
}

function displaceActive(newNodeId: string) {
  if (activeNodeId && activeNodeId !== newNodeId) {
    subscribers.get(activeNodeId)?.(IDLE_STATE);
  }
  activeNodeId = newNodeId;
}

// ── Backend mobile : tauri-plugin-native-audio ────────────────────────────────

let nativeReady = false;

async function ensureNativeReady() {
  if (nativeReady) return;
  await initialize();
  await addStateListener((state) => dispatch(state));
  nativeReady = true;
  log.info("lecteur natif initialisé");
}

// ── Backend desktop : HTML5 Audio ─────────────────────────────────────────────

let htmlAudio: HTMLAudioElement | null = null;
let htmlRafId = 0;

function getHtmlAudio(): HTMLAudioElement {
  if (htmlAudio) return htmlAudio;
  htmlAudio = new Audio();

  htmlAudio.addEventListener("play", () => startHtmlRaf());
  htmlAudio.addEventListener("pause", () => {
    stopHtmlRaf();
    dispatch(htmlState());
  });
  htmlAudio.addEventListener("ended", () => {
    stopHtmlRaf();
    dispatch({ ...IDLE_STATE, status: "ended" });
  });
  htmlAudio.addEventListener("loadedmetadata", () => dispatch(htmlState()));
  htmlAudio.addEventListener("error", () => {
    stopHtmlRaf();
    log.error("erreur HTML5 audio", htmlAudio?.error?.message);
    dispatch({ ...IDLE_STATE, status: "error", error: htmlAudio?.error?.message });
  });
  return htmlAudio;
}

function htmlState(): NativeAudioState {
  const a = htmlAudio;
  if (!a) return IDLE_STATE;
  return {
    status: a.ended ? "ended" : a.paused ? "idle" : "playing",
    currentTime: a.currentTime,
    duration: Number.isFinite(a.duration) ? a.duration : 0,
    isPlaying: !a.paused && !a.ended,
    buffering: false,
    rate: a.playbackRate,
  };
}

// RAF à 60 fps pour un curseur fluide sur desktop (timeupdate ne fire qu'à ~4 Hz)
function startHtmlRaf() {
  function tick() {
    dispatch(htmlState());
    htmlRafId = requestAnimationFrame(tick);
  }
  if (!htmlRafId) htmlRafId = requestAnimationFrame(tick);
}

function stopHtmlRaf() {
  if (htmlRafId) {
    cancelAnimationFrame(htmlRafId);
    htmlRafId = 0;
  }
}

// ── API publique ──────────────────────────────────────────────────────────────

export async function nativeLoad(
  nodeId: string,
  src: string,
  title?: string
): Promise<NativeAudioState> {
  displaceActive(nodeId);
  log.info("chargement audio", { nodeId, src, platform: isMobile ? "native" : "html5" });

  if (isMobile) {
    await ensureNativeReady();
    return setSource({ src, title });
  }

  const audio = getHtmlAudio();
  stopHtmlRaf();
  audio.pause();
  audio.src = src;
  return htmlState();
}

export async function nativePlay(nodeId: string): Promise<NativeAudioState> {
  activeNodeId = nodeId;

  if (isMobile) {
    await ensureNativeReady();
    return play();
  }

  const audio = getHtmlAudio();
  await audio.play().catch((err) => log.error("play HTML5 échoué", err));
  return htmlState();
}

export async function nativePause(): Promise<NativeAudioState> {
  if (isMobile) {
    await ensureNativeReady();
    return pause();
  }

  htmlAudio?.pause();
  return htmlState();
}

export async function nativeSeek(seconds: number): Promise<NativeAudioState> {
  if (isMobile) {
    await ensureNativeReady();
    return seekTo(seconds);
  }

  if (htmlAudio) htmlAudio.currentTime = seconds;
  dispatch(htmlState());
  return htmlState();
}

export function nativeIsActive(nodeId: string): boolean {
  return activeNodeId === nodeId;
}

export function nativeSubscribe(nodeId: string, cb: StateCallback): () => void {
  subscribers.set(nodeId, cb);
  return () => {
    subscribers.delete(nodeId);
    if (activeNodeId === nodeId) activeNodeId = null;
  };
}
