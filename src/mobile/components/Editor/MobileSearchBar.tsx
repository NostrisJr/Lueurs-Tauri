/**
 * MobileSearchBar.tsx
 *
 * Recherche/remplacement (mobile) — bottom sheet clavier-aware (BottomSheet),
 * plutôt que le panneau flottant desktop (cf. SearchBar.tsx) : polices ≥16px
 * (en dessous, Safari zoome automatiquement la page au focus d'un champ) et
 * cibles tactiles plus grandes. Même état (searchState.ts) et mêmes actions
 * (searchPlugin.ts / searchBarActions.ts) que la version desktop — seul
 * l'habillage change.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  runAndScroll,
  withActiveView,
} from "../../../shared/components/NoteEditor/lib/searchBarActions";
import {
  IconChevronLeft,
  IconChevronRight,
  IconMagnifyingglass,
  IconTextformat,
  IconXmark,
} from "../../../shared/components/PlatformIcon";
import {
  clearSearch,
  replaceAllMatches,
  replaceCurrentMatch,
  runSearch,
  searchStep,
} from "../../../shared/plugins/search/searchPlugin";
import {
  closeSearchBar,
  getSearchBarState,
  setSearchCaseSensitive,
  setSearchQuery,
  setSearchReplacement,
  subscribeSearchBar,
} from "../../../shared/plugins/search/searchState";
import { hapticImpact } from "../../lib/haptics";
import { BottomSheet } from "../BottomSheet/BottomSheet";

// Marge confortable en plus de l'obstruction réelle (clavier + sheet) : sans
// elle, une occurrence scrollée pile au bord de la sheet reste illisible.
const SEARCH_SCROLL_EXTRA_MARGIN = 24;

export function MobileSearchBar() {
  const state = useSyncExternalStore(subscribeSearchBar, getSearchBarState);
  const queryRef = useRef<HTMLInputElement>(null);
  // Obstruction réelle en bas d'écran (clavier + hauteur de la sheet, cf.
  // BottomSheet.onHeightChange) — remplace MOBILE_TOOLBAR_OFFSET (pensé pour
  // MobileFormattingBar, une barre fixe bien plus basse) dans le scroll vers
  // les occurrences, sinon elles disparaissent sous la sheet dès qu'elle est
  // plus haute que cette barre (autoHeight ou clavier ouvert).
  const bottomInsetRef = useRef(0);
  function scrollAware(action: Parameters<typeof runAndScroll>[0]) {
    runAndScroll(action, bottomInsetRef.current);
  }
  // Lu (pas déclencheur) dans l'effet d'ouverture ci-dessous : évite de relancer
  // la recherche à chaque frappe, seulement à l'ouverture de la barre.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Ouverture : focus le champ requête, restaure la recherche précédente
  // (requête conservée par closeSearchBar) pour retrouver les surlignages.
  useEffect(() => {
    if (!state.open) return;
    queryRef.current?.focus();
    queryRef.current?.select();
    const { query, caseSensitive } = stateRef.current;
    if (query) {
      scrollAware((v) => runSearch(v, query, caseSensitive));
    }
  }, [state.open]);

  // Changement de note (remontage, cf. key={activeNote.id} dans NoteEditor) :
  // referme la barre pour ne pas la retrouver ouverte sur la note suivante.
  useEffect(() => {
    return () => {
      closeSearchBar();
    };
  }, []);

  if (!state.open) return null;

  function handleClose() {
    withActiveView((v) => {
      clearSearch(v);
      v.focus();
    });
    closeSearchBar();
  }

  const hasQuery = state.query.length > 0;
  const counterLabel = !hasQuery
    ? ""
    : state.matchCount === 0
      ? "Aucun résultat"
      : `${state.matchIndex + 1}/${state.matchCount}`;

  return (
    <BottomSheet
      onClose={handleClose}
      autoHeight
      dimBackground={false}
      onHeightChange={(px) => {
        bottomInsetRef.current = px + SEARCH_SCROLL_EXTRA_MARGIN;
      }}
    >
      <div
        className="px-3 pb-8 flex flex-col gap-2"
        // Un tap qui rate un bouton de peu (gap entre boutons, compteur,
        // padding) ne doit pas voler le focus de la requête/du remplacement :
        // sinon le clavier se ferme, la sheet (positionnée en bottom:
        // keyboardHeight) descend d'un coup, et le tap suivant d'une frappe
        // rapide retombe sur l'éditeur derrière — qui referme toute la
        // recherche via l'overlay plein écran. On ne bloque que les taps hors
        // bouton/input : ceux-là doivent garder leur comportement de focus normal.
        onPointerDown={(e) => {
          if (!(e.target as HTMLElement).closest("button, input")) {
            e.preventDefault();
          }
        }}
      >
        <div className="flex items-center gap-2">
          <IconMagnifyingglass className="size-4 text-gray-400 shrink-0" />
          <input
            ref={queryRef}
            value={state.query}
            onChange={(e) => {
              const query = e.target.value;
              setSearchQuery(query);
              scrollAware((v) => runSearch(v, query, state.caseSensitive));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                // Pas de blur ici : le refermer/rouvrir à chaque validation
                // fait fluctuer keyboardHeight (donc la hauteur de la sheet)
                // en boucle si on enchaîne les Entrée rapidement — cf.
                // BottomSheet.onHeightChange, qui recalcule sur ce changement.
                scrollAware((v) => searchStep(v, e.shiftKey ? -1 : 1));
              }
            }}
            placeholder="Rechercher"
            enterKeyHint="search"
            // text-base (16px) : en dessous, Safari zoome la page au focus.
            className="flex-1 min-w-0 outline-none text-base text-gray-800 placeholder:text-gray-400 py-2"
          />
          <button
            type="button"
            // pointerdown/preventDefault + action au pointerup (cf.
            // MobileFormattingBar) : un simple onClick perd son premier tap
            // quand il retire le focus du champ requête encore actif.
            onPointerDown={(e) => e.preventDefault()}
            onPointerUp={() => {
              hapticImpact("light");
              handleClose();
            }}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-gray-500 active:bg-gray-100 transition-colors"
            aria-label="Fermer la recherche"
          >
            <IconXmark className="size-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onPointerUp={() => {
              hapticImpact("light");
              const next = !state.caseSensitive;
              setSearchCaseSensitive(next);
              scrollAware((v) => runSearch(v, state.query, next));
            }}
            className={`h-9 px-3 shrink-0 flex items-center gap-1.5 rounded-full text-sm transition-colors ${
              state.caseSensitive
                ? "text-amber-600 bg-amber-50"
                : "text-gray-500 bg-gray-100 active:bg-gray-200"
            }`}
          >
            <IconTextformat className="size-4" />
            Casse
          </button>
          <span className="text-sm text-gray-400 tabular-nums flex-1 text-center">
            {counterLabel}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={state.matchCount === 0}
              onPointerDown={(e) => e.preventDefault()}
              onPointerUp={() => {
                hapticImpact("light");
                scrollAware((v) => searchStep(v, -1));
              }}
              className="w-9 h-9 flex items-center justify-center rounded-full text-gray-600 bg-gray-100 active:bg-gray-200 disabled:opacity-30 disabled:active:bg-gray-100 transition-colors"
              aria-label="Occurrence précédente"
            >
              <IconChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              disabled={state.matchCount === 0}
              onPointerDown={(e) => e.preventDefault()}
              onPointerUp={() => {
                hapticImpact("light");
                scrollAware((v) => searchStep(v, 1));
              }}
              className="w-9 h-9 flex items-center justify-center rounded-full text-gray-600 bg-gray-100 active:bg-gray-200 disabled:opacity-30 disabled:active:bg-gray-100 transition-colors"
              aria-label="Occurrence suivante"
            >
              <IconChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <input
            value={state.replacement}
            onChange={(e) => setSearchReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                scrollAware((v) => replaceCurrentMatch(v, state.replacement));
                e.currentTarget.blur();
              }
            }}
            placeholder="Remplacer par"
            enterKeyHint="done"
            className="flex-1 min-w-0 outline-none text-base text-gray-800 placeholder:text-gray-400 py-2"
          />
          <button
            type="button"
            disabled={state.matchCount === 0}
            onPointerDown={(e) => e.preventDefault()}
            onPointerUp={() => {
              hapticImpact("light");
              scrollAware((v) => replaceCurrentMatch(v, state.replacement));
            }}
            className="h-9 px-3 shrink-0 rounded-full text-sm bg-gray-100 active:bg-gray-200 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            Remplacer
          </button>
          <button
            type="button"
            disabled={!hasQuery || state.matchCount === 0}
            onPointerDown={(e) => e.preventDefault()}
            onPointerUp={() => {
              hapticImpact("light");
              withActiveView((v) =>
                replaceAllMatches(
                  v,
                  state.query,
                  state.caseSensitive,
                  state.replacement
                )
              );
            }}
            className="h-9 px-3 shrink-0 rounded-full text-sm bg-gray-100 active:bg-gray-200 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            Tout
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
