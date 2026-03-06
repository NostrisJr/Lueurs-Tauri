/**
 * config.ts
 *
 * Type de configuration partagé par le plugin audio-block.
 * Calqué sur la config ImageBlock de Crepe (onUpload / proxyDomURL).
 */

export interface AudioBlockConfig {
    /**
     * Résout un chemin absolu local en URL lisible par la webview Tauri.
     *
     * Typiquement :
     *   import { convertFileSrc } from "@tauri-apps/api/core";
     *   resolveAudioPath: (src) => Promise.resolve(convertFileSrc(src))
     *
     * Si non fourni, le `src` brut est utilisé tel quel (pratique en dev web).
     */
    resolveAudioPath?: (src: string) => Promise<string>;
}