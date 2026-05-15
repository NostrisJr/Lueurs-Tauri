// Lecteur audio unifié : tauri-plugin-native-audio sur iOS/Android, HTML5 sur desktop.
// API identique dans les deux cas — les consommateurs n'ont pas à connaître la plateforme.
//
// Sur desktop, ce module n'est utilisé que pour le chemin mobile (isMobile === true).
// La lecture desktop passe par AudioBufferSourceNode directement dans AudioBlockComponent.

import {
  addStateListener,
  initialize,
  pause,
  play,
  seekTo,
  setSource,
} from "tauri-plugin-native-audio-api";
import type { NativeAudioState } from "tauri-plugin-native-audio-api";
import { createLogger } from "./logger";
import { isMobile } from "./platform";

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

// ── API publique ──────────────────────────────────────────────────────────────

export async function nativeLoad(
  nodeId: string,
  src: string,
  title?: string
): Promise<NativeAudioState> {
  displaceActive(nodeId);
  log.info("chargement audio natif", { nodeId, src });

  if (isMobile) {
    await ensureNativeReady();
    return setSource({ src, title });
  }

  return IDLE_STATE;
}

export async function nativePlay(nodeId: string): Promise<NativeAudioState> {
  activeNodeId = nodeId;

  if (isMobile) {
    await ensureNativeReady();
    return play();
  }

  return IDLE_STATE;
}

export async function nativePause(): Promise<NativeAudioState> {
  if (isMobile) {
    await ensureNativeReady();
    return pause();
  }

  return IDLE_STATE;
}

export async function nativeSeek(seconds: number): Promise<NativeAudioState> {
  if (isMobile) {
    await ensureNativeReady();
    return seekTo(seconds);
  }

  return IDLE_STATE;
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
