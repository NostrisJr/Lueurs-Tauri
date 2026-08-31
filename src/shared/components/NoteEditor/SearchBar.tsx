/**
 * SearchBar.tsx
 *
 * Barre recherche/remplacement (Cmd+F) — singleton monté dans
 * NoteEditor, comme InlineFormulaPopup/WikilinkEditPopup. Piloté par
 * searchState.ts (ouverture via le menu natif macOS ou le menu "..." mobile),
 * agit sur l'éditeur actif via searchPlugin.ts.
 */

import { editorViewCtx } from "@milkdown/kit/core";
import type { EditorView } from "@milkdown/kit/prose/view";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { MOBILE_HEADER_HEIGHT } from "../../hooks/useCaretScroll";
import { isMobile } from "../../lib/platform";
import {
  clearSearch,
  getActiveMatchFrom,
  replaceAllMatches,
  replaceCurrentMatch,
  runSearch,
  searchStep,
} from "../../plugins/search/searchPlugin";
import {
  closeSearchBar,
  getSearchBarState,
  setSearchCaseSensitive,
  setSearchQuery,
  setSearchReplacement,
  subscribeSearchBar,
} from "../../plugins/search/searchState";
import {
  IconChevronLeft,
  IconChevronRight,
  IconMagnifyingglass,
  IconTextformat,
  IconXmark,
} from "../PlatformIcon";
import { Squircle } from "../Squircle";
import { activeEditorRef } from "./lib/activeEditorRef";
import { scrollPosIntoViewLikeEditing } from "./lib/editorScroll";

function withActiveView(fn: (view: EditorView) => void) {
  activeEditorRef.current?.action((ctx) => {
    try {
      fn(ctx.get(editorViewCtx));
    } catch {
      /* editorViewCtx pas encore injecté */
    }
  });
}

// Exécute une action de recherche puis scrolle vers l'occurrence active avec
// les marges du header fixe (le scroll natif ProseMirror `.scrollIntoView()`
// les ignore et la cible finit masquée — cf. scrollPosIntoViewLikeEditing,
// déjà utilisé par WikilinkEditPopup pour la même raison).
function runAndScroll(action: (view: EditorView) => void) {
  withActiveView((v) => {
    action(v);
    const pos = getActiveMatchFrom(v);
    if (pos !== null) scrollPosIntoViewLikeEditing(v, pos);
  });
}

export function SearchBar() {
  const state = useSyncExternalStore(subscribeSearchBar, getSearchBarState);
  const queryRef = useRef<HTMLInputElement>(null);
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
      runAndScroll((v) => runSearch(v, query, caseSensitive));
    }
  }, [state.open]);

  // Changement de note (remontage, cf. key={activeNote.id} dans NoteEditor) :
  // referme la barre pour ne pas la retrouver ouverte sur la note suivante.
  useEffect(() => {
    return () => {
      closeSearchBar();
    };
  }, []);

  const handleClose = useCallback(() => {
    withActiveView((v) => {
      clearSearch(v);
      v.focus();
    });
    closeSearchBar();
  }, []);

  if (!state.open) return null;

  const hasQuery = state.query.length > 0;
  const counterLabel = !hasQuery
    ? ""
    : state.matchCount === 0
      ? "Aucun résultat"
      : `${state.matchIndex + 1}/${state.matchCount}`;

  const bar = (
    <div
      className={clsx(
        "fixed z-50",
        isMobile ? "left-2 right-2" : "top-16 right-4 w-96"
      )}
      style={isMobile ? { top: MOBILE_HEADER_HEIGHT } : undefined}
    >
      {/* Couche d'ombre séparée, non clippée : box-shadow ignore le clip-path de
          Squircle (d'où rounded-2xl ici, pas la vraie forme squircle — invisible
          vu le flou). Et filter: drop-shadow sur le panneau lui-même serait trop
          faible : son alpha est presque nul (bg-white/10, effet verre), or
          drop-shadow module l'ombre par l'alpha source. Même contournement que
          le menu vitré de FileTreeHeader. */}
      <div className="absolute inset-0 rounded-2xl shadow-xl" />
      {/* Panneau vitré : un seul Squircle. Un second clip-path imbriqué pour la
          bordure (essayé plus haut dans l'historique) opacifiait le fond derrière
          lui (bg-gray-200 de l'anneau) et bloquait le backdrop-blur — le verre
          redevenait un gris plat. La bordure vit donc en dehors, cf. plus bas. */}
      <Squircle
        radius={16}
        className="relative overflow-hidden backdrop-blur-xs bg-white/10"
      >
        <div className="flex items-center gap-1 px-2 py-1.5">
          <IconMagnifyingglass className="size-4 text-gray-400 shrink-0" />
          <input
            ref={queryRef}
            value={state.query}
            onChange={(e) => {
              const query = e.target.value;
              setSearchQuery(query);
              runAndScroll((v) => runSearch(v, query, state.caseSensitive));
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                handleClose();
              } else if (e.key === "Enter") {
                e.preventDefault();
                runAndScroll((v) => searchStep(v, e.shiftKey ? -1 : 1));
              }
            }}
            placeholder="Rechercher"
            className="flex-1 min-w-0 outline-none text-sm text-gray-800 placeholder:text-gray-400"
          />
          <span className="text-xs text-gray-400 tabular-nums shrink-0 px-1 whitespace-nowrap">
            {counterLabel}
          </span>
          <button
            type="button"
            title="Sensible à la casse"
            onClick={() => {
              const next = !state.caseSensitive;
              setSearchCaseSensitive(next);
              runAndScroll((v) => runSearch(v, state.query, next));
            }}
            className={clsx(
              "w-7 h-7 shrink-0 flex items-center justify-center rounded-md hover:bg-gray-100 hover:text-amber-600l disabled:opacity-30 disabled:hover:bg-transparent transition-colors",
              state.caseSensitive &&
                "text-amber-600 bg-gray-100 hover:bg-gray-200/70"
            )}
          >
            <IconTextformat className="size-4" />
          </button>
          <button
            type="button"
            title="Précédent"
            disabled={state.matchCount === 0}
            onClick={() => runAndScroll((v) => searchStep(v, -1))}
            className={clsx(
              "w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            )}
          >
            <IconChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            title="Suivant"
            disabled={state.matchCount === 0}
            onClick={() => runAndScroll((v) => searchStep(v, 1))}
            className={clsx(
              "w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            )}
          >
            <IconChevronRight className="size-4" />
          </button>
          <button
            type="button"
            title="Fermer"
            onClick={handleClose}
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <IconXmark className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-gray-100">
          <input
            value={state.replacement}
            onChange={(e) => setSearchReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                handleClose();
              } else if (e.key === "Enter") {
                e.preventDefault();
                runAndScroll((v) => replaceCurrentMatch(v, state.replacement));
              }
            }}
            placeholder="Remplacer par"
            className="flex-1 min-w-0 outline-none text-sm text-gray-800 placeholder:text-gray-400 pl-5"
          />
          <button
            type="button"
            disabled={state.matchCount === 0}
            onClick={() =>
              runAndScroll((v) => replaceCurrentMatch(v, state.replacement))
            }
            className="text-xs px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100 transition-colors whitespace-nowrap"
          >
            Remplacer
          </button>
          <button
            type="button"
            disabled={!hasQuery || state.matchCount === 0}
            onClick={() =>
              withActiveView((v) =>
                replaceAllMatches(
                  v,
                  state.query,
                  state.caseSensitive,
                  state.replacement
                )
              )
            }
            className="text-xs px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100 transition-colors whitespace-nowrap"
          >
            Tout remplacer
          </button>
        </div>
      </Squircle>
      {/* Bordure par-dessus, sur son propre calque non clippé : rounded-2xl (un
          vrai border-radius, pas un clip-path) pour que `border` suive le
          contour sans être coupée aux angles ; sans fond, donc sans opacifier
          le verre du panneau en dessous. */}
      <div className="absolute inset-0 rounded-2xl border border-gray-200 pointer-events-none" />
    </div>
  );

  return createPortal(bar, document.body);
}
