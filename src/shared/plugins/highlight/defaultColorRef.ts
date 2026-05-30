import type { HighlightColorId } from "./colors";
import { DEFAULT_HIGHLIGHT_COLOR } from "./colors";

/**
 * Ref mutable permettant au plugin ProseMirror (créé une seule fois)
 * de lire la couleur par défaut choisie dans les réglages React.
 * Mise à jour depuis NoteEditor via useEffect.
 */
export const defaultHighlightColorRef: { current: HighlightColorId } = {
  current: DEFAULT_HIGHLIGHT_COLOR,
};
