/**
 * wikilinkSuggestState.ts
 *
 * Petit store externe (pub/sub) alimenté par le plugin ProseMirror de détection
 * `[[` et lu par le popup React via useSyncExternalStore. Évite de coupler le
 * plugin PM à jotai.
 */

export interface WikilinkSuggestState {
  /** Position du premier `[` (début du déclencheur `[[`). */
  from: number;
  /** Position du curseur (fin de la requête). */
  to: number;
  /** Texte saisi après `[[`, ou dans la cible d'un `[alias](…`. */
  query: string;
  /** Alias déjà saisi pour un déclencheur `[alias](…` ; sinon le nom de la note. */
  alias?: string;
  /** Coordonnées écran du déclencheur, pour ancrer le popup. */
  coords: { left: number; top: number; bottom: number };
}

let current: WikilinkSuggestState | null = null;
const listeners = new Set<() => void>();

export function setWikilinkSuggest(next: WikilinkSuggestState | null) {
  current = next;
  for (const l of listeners) l();
}

export function getWikilinkSuggest() {
  return current;
}

export function subscribeWikilinkSuggest(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
