/**
 * Palette de surlignage — toutes les couleurs disponibles dans l'éditeur.
 *
 * Les valeurs affichées à l'écran vivent dans les tokens --color-highlight-*
 * (theme.css), qui basculent avec le thème. Ici on ne garde que l'identité de
 * chaque couleur et son RVB de référence, seulement utilisé par l'export Typst
 * — un document imprimé reste clair, il ne doit jamais suivre le thème.
 */

export const HIGHLIGHT_COLORS = [
  { id: "yellow", label: "Jaune", print: [253, 224, 71] },
  { id: "green", label: "Vert", print: [134, 239, 172] },
  { id: "blue", label: "Bleu", print: [147, 197, 253] },
  { id: "red", label: "Rouge", print: [252, 165, 165] },
  { id: "orange", label: "Orange", print: [253, 186, 116] },
  { id: "purple", label: "Violet", print: [216, 180, 254] },
  { id: "gray", label: "Gris", print: [209, 213, 219] },
] as const;

export type HighlightColorId = (typeof HIGHLIGHT_COLORS)[number]["id"];

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColorId = "yellow";

function isKnown(colorId: string): colorId is HighlightColorId {
  return HIGHLIGHT_COLORS.some((c) => c.id === colorId);
}

/** Fond appliqué au texte surligné. */
export function getHighlightBg(colorId: string): string {
  const id = isKnown(colorId) ? colorId : DEFAULT_HIGHLIGHT_COLOR;
  return `var(--color-highlight-${id})`;
}

/** Teinte pleine de la pastille dans les sélecteurs de couleur. */
export function getHighlightSolid(colorId: string): string {
  const id = isKnown(colorId) ? colorId : DEFAULT_HIGHLIGHT_COLOR;
  return `var(--color-highlight-${id}-solid)`;
}
