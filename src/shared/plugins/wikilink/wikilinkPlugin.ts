/**
 * wikilinkPlugin.ts — liens entre notes (markdown standard).
 *
 * Les liens entre notes sont des liens markdown standard `[texte](chemin.md)`
 * (mark `link`), href = chemin relatif au vault avec extension. Aucun nœud custom.
 *   - note-link-plugin    : clic (navigation / ouverture externe) + décorations.
 *   - suggest-plugin      : autocomplétion `[[` ou `[alias](`, insère un lien standard.
 *   - link-boundary-plugin: rend la mark `link` non-inclusive (sortie en bout de lien).
 *
 * Navigation : la résolution lit `wikilinkBridge.current`, alimenté par MarkdownEditor.
 */

import { linkBoundaryPlugin } from "./link-boundary-plugin";
import { noteLinkPlugin } from "./note-link-plugin";
import { wikilinkSuggestPlugin } from "./suggest-plugin";

export const wikilinkPlugin = [
  noteLinkPlugin,
  wikilinkSuggestPlugin,
  linkBoundaryPlugin,
].flat();

export {
  isExternalHref,
  linkRangeAt,
  refreshNoteLinkDecorations,
} from "./note-link-plugin";
export { wikilinkBridge, labelFromTarget } from "./wikilinkBridge";
export type { WikilinkBridge } from "./wikilinkBridge";
