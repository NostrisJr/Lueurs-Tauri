/**
 * audioBlockPlugin.ts  –  Point d'entrée du plugin audio-block
 *
 * ─────────────────────────────────────────────────────────────────────────
 * INTÉGRATION DANS MilkdownEditor.tsx (app Tauri)
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   import { convertFileSrc } from "@tauri-apps/api/core";
 *   import { createAudioBlockPlugin } from "./plugins/audio-block/audioBlockPlugin";
 *
 *   const audioBlockPlugin = createAudioBlockPlugin({
 *     resolveAudioPath: (src) => Promise.resolve(convertFileSrc(src)),
 *   });
 *
 *   // Dans useEditor() :
 *   useEditor((root) => {
 *     const crepe = new Crepe({ root, defaultValue: node.body, ... });
 *     crepe.editor.use(audioBlockPlugin);
 *     crepe.on(...);
 *     crepeRef.current = crepe;
 *     return crepe;
 *   });
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FORMAT MARKDOWN STOCKÉ
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le markdown reste 100 % standard :
 *   [Interview du 12 mars](/home/user/vault/recordings/interview.mp3)
 *
 * Chargement  → remark détecte l'extension audio → nœud `audio_block`
 *             → NodeView affiche le lecteur HTML5 avec src asset://
 * Sauvegarde  → sérialisé en `[titre](src)` — lisible partout
 *
 * ─────────────────────────────────────────────────────────────────────────
 */

import { $view } from "@milkdown/kit/utils";
import { audioBlockRemark } from "./remark-plugin";
import { audioBlockSchema } from "./schema";
import { createAudioBlockNodeView } from "./node-view";
import type { AudioBlockConfig } from "./config";

/**
 * Crée le plugin complet avec la configuration Tauri.
 *
 * @param config.resolveAudioPath  Convertit un chemin absolu en URL asset://
 *   Exemple : `(src) => Promise.resolve(convertFileSrc(src))`
 */
export function createAudioBlockPlugin(config: AudioBlockConfig = {}) {
    return [
        // 1. Remark : [titre](fichier.mp3) → nœud mdast `audio_block`
        audioBlockRemark,
        // 2. Schéma ProseMirror : parse + serialize
        audioBlockSchema,
        // 3. NodeView : lecteur HTML5 avec résolution Tauri
        $view(audioBlockSchema, () => createAudioBlockNodeView(config)),
    ].flat();
}

// ── Re-exports pour usage avancé ──────────────────────────────────────────
export { audioBlockRemark } from "./remark-plugin";
export { audioBlockSchema } from "./schema";
export { createAudioBlockNodeView } from "./node-view";
export type { AudioBlockConfig } from "./config";