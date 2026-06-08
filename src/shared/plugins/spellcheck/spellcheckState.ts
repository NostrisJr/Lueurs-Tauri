/**
 * Refs module-level partagées entre le plugin ProseMirror (créé une seule fois)
 * et React. Même pattern que `highlight/defaultColorRef.ts`.
 */

/** Payload envoyé à React au clic sur une faute, pour afficher le popover. */
export interface SpellPopoverPayload {
  /** Positions ProseMirror de la faute (mappées en continu par les édits). */
  from: number;
  to: number;
  message: string;
  replacements: string[];
  /** Texte fautif (pour l'action « Ignorer ce mot »). */
  word: string;
  /** Catégorie : seules les fautes d'orthographe peuvent être ignorées. */
  category: "spelling" | "grammar";
  /** Rectangle écran de la faute (via `view.coordsAtPos`) pour positionner le popover. */
  rect: { left: number; top: number; bottom: number };
}

/** Lu par le plugin à chaque update pour savoir s'il doit vérifier le texte. */
export const spellcheckEnabledRef: { current: boolean } = { current: true };

/**
 * Mots ignorés (en minuscules), synchronisés depuis la config du vault. Lu par
 * le plugin pour filtrer les fautes d'orthographe correspondantes.
 */
export const ignoredWordsRef: { current: Set<string> } = { current: new Set() };

/**
 * Callback notifiée par le plugin au clic sur une faute (ou `null` pour fermer
 * le popover). Branchée par MarkdownEditor.
 */
export const spellSuggestionCallbackRef: {
  current: ((payload: SpellPopoverPayload | null) => void) | null;
} = { current: null };
