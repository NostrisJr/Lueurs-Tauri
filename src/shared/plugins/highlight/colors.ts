/** Palette de surlignage — toutes les couleurs disponibles dans l'éditeur. */

export const HIGHLIGHT_COLORS = [
  {
    id: "yellow",
    label: "Jaune",
    bg: "rgba(253,224,71,0.38)",
    solid: "#fbbf24",
  },
  {
    id: "green",
    label: "Vert",
    bg: "rgba(134,239,172,0.38)",
    solid: "#4ade80",
  },
  { id: "blue", label: "Bleu", bg: "rgba(147,197,253,0.38)", solid: "#60a5fa" },
  { id: "red", label: "Rouge", bg: "rgba(252,165,165,0.38)", solid: "#f87171" },
  {
    id: "orange",
    label: "Orange",
    bg: "rgba(253,186,116,0.38)",
    solid: "#fb923c",
  },
  {
    id: "purple",
    label: "Violet",
    bg: "rgba(216,180,254,0.38)",
    solid: "#c084fc",
  },
  { id: "gray", label: "Gris", bg: "rgba(209,213,219,0.38)", solid: "#9ca3af" },
] as const;

export type HighlightColorId = (typeof HIGHLIGHT_COLORS)[number]["id"];

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColorId = "yellow";

export function getHighlightBg(colorId: string): string {
  return (
    HIGHLIGHT_COLORS.find((c) => c.id === colorId)?.bg ?? HIGHLIGHT_COLORS[0].bg
  );
}

export function getHighlightSolid(colorId: string): string {
  return (
    HIGHLIGHT_COLORS.find((c) => c.id === colorId)?.solid ??
    HIGHLIGHT_COLORS[0].solid
  );
}
