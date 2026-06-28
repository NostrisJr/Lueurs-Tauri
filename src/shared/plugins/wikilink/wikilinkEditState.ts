/**
 * wikilinkEditState.ts
 *
 * Store externe pour le popup d'édition de lien (WikilinkEditPopup), déclenché
 * depuis le menu contextuel, l'appui long ou le raccourci Mod-K. Distinct de
 * l'autocomplétion `[[` (wikilinkSuggestState) : ici le popup a son propre champ.
 */

export interface WikilinkEditRequest {
  /** Plage du document à remplacer (sélection, lien existant, ou curseur vide). */
  range: { from: number; to: number };
  /**
   * Ancre écran imposée (mobile). Si absente, le popup recalcule l'ancre depuis
   * `range.from` après avoir scrollé la cible dans la vue (desktop / Mod-K).
   */
  coords?: { left: number; top: number; bottom: number };
  /** Requête initiale du champ de recherche. */
  initialQuery: string;
  /** Alias / texte affiché initial. */
  initialAlias: string;
}

let current: WikilinkEditRequest | null = null;
const listeners = new Set<() => void>();

export function setWikilinkEdit(next: WikilinkEditRequest | null) {
  current = next;
  for (const l of listeners) l();
}

export function getWikilinkEdit() {
  return current;
}

export function subscribeWikilinkEdit(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
