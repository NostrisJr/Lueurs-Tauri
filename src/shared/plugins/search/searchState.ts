/**
 * searchState.ts
 *
 * État module-level de la barre recherche/remplacement (comme wikilinkEditState /
 * inlineFormulaState) : pilote la barre React (SearchBar) et est déclenché hors
 * React par le menu natif macOS (Cmd+F) et le menu "..." mobile.
 */

export interface SearchBarState {
  open: boolean;
  query: string;
  replacement: string;
  caseSensitive: boolean;
  /** Index (0-based) de l'occurrence active, -1 si aucune. */
  matchIndex: number;
  matchCount: number;
}

const initial: SearchBarState = {
  open: false,
  query: "",
  replacement: "",
  caseSensitive: false,
  matchIndex: -1,
  matchCount: 0,
};

let current: SearchBarState = initial;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getSearchBarState() {
  return current;
}

export function subscribeSearchBar(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openSearchBar() {
  current = { ...current, open: true };
  emit();
}

/** Ferme la barre et réinitialise le compteur (la requête/le remplacement sont
 * conservés pour une réouverture rapide). */
export function closeSearchBar() {
  current = { ...current, open: false, matchIndex: -1, matchCount: 0 };
  emit();
}

export function setSearchQuery(query: string) {
  current = { ...current, query };
  emit();
}

export function setSearchReplacement(replacement: string) {
  current = { ...current, replacement };
  emit();
}

export function setSearchCaseSensitive(caseSensitive: boolean) {
  current = { ...current, caseSensitive };
  emit();
}

/** Alimenté par le plugin ProseMirror après chaque (re)calcul des occurrences. */
export function setSearchMatches(matchIndex: number, matchCount: number) {
  current = { ...current, matchIndex, matchCount };
  emit();
}
