/**
 * config.ts
 *
 * Type de configuration partagé par le plugin audio-block.
 * Calqué sur la config ImageBlock de Crepe (onUpload / proxyDomURL).
 */

export interface AudioBlockConfig {
  /**
   * Résout un chemin absolu local en URL lisible par la webview Tauri.
   * Utilisé comme fallback si readAudioData n'est pas fourni.
   */
  resolveAudioPath?: (src: string) => Promise<string>;

  /**
   * Lit les octets bruts du fichier audio (chemin relatif au vault).
   * Prioritaire sur resolveAudioPath : évite la dépendance au schéma asset://
   * et aux range-requests (non supportés par WKURLSchemeHandler sur iOS).
   *
   * Typiquement :
   *   import { readFile } from "@tauri-apps/plugin-fs";
   *   readAudioData: (src) => readFile(`${vaultPath}/${src}`)
   */
  readAudioData?: (src: string) => Promise<Uint8Array>;

  /**
   * Retourne le chemin absolu (ou URL file://) du fichier audio pour le lecteur natif.
   * Utilisé exclusivement par tauri-plugin-native-audio pour la lecture.
   * Async toléré : sur Android la résolution rel → URI SAF passe par invoke().
   *
   * Typiquement :
   *   resolveAbsolutePath: (src) => `${vaultPath}/${src}`
   */
  resolveAbsolutePath?: (src: string) => string | Promise<string>;
}
