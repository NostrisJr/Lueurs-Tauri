import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

// Doit correspondre à la durée de transition CSS (duration-200) utilisée pour
// la hauteur des panneaux (cf. useAnimatedHeight) — le temps de laisser
// l'animation de fermeture se jouer avant de démonter réellement le contenu.
export const CLOSE_TRANSITION_MS = 200;

/**
 * Gère le déroulé en place d'un panneau d'édition dans une ligne de
 * frontmatter (remplace l'ancienne modale flottante) : transition d'ouverture
 * ET de fermeture (via `visible`, qui reste vrai le temps de l'animation de
 * repli), et fermeture/commit quand le focus quitte vraiment le panneau.
 *
 * `commit` est lu à chaque fermeture (via containerProps ou handleFieldDone),
 * donc toujours la version la plus récente passée par l'appelant — pas de ref
 * nécessaire côté appelant.
 */
export function useExpandPanel(
  expanded: boolean,
  close: () => void,
  commit: () => void
) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(expanded);
  const pendingBlurCheckRef = useRef<number | null>(null);

  useEffect(() => {
    if (expanded) {
      setVisible(true);
      const id = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(id);
    }
    // Fermeture : on retransitionne d'abord vers replié, puis on démonte
    // réellement une fois l'animation terminée.
    setMounted(false);
    const timeout = setTimeout(() => setVisible(false), CLOSE_TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [expanded]);

  function commitAndClose() {
    // Un appel explicite (roue, Entrée, Échap) rend caduque toute vérification
    // de blur déjà programmée pour cette même session d'édition — sans ça,
    // le blur du clic qui a déclenché CET appel se re-déclenche une frame
    // plus tard et rejoue commit+close une seconde fois (avec le brouillon
    // d'un rendu déjà obsolète), ce qui pouvait rouvrir le panneau en
    // fonction de la course entre les deux.
    if (pendingBlurCheckRef.current !== null) {
      cancelAnimationFrame(pendingBlurCheckRef.current);
      pendingBlurCheckRef.current = null;
    }
    commit();
    close();
  }

  // Vérifie où le focus atterrit réellement, une frame après un blur — jamais
  // via `relatedTarget` : sur WebKit/macOS (le WebView de Tauri), cliquer un
  // <button> ne lui donne pas le focus, relatedTarget vaut alors `null` et
  // ferait croire à tort que le focus a quitté le panneau (ex: cliquer
  // l'onglet Texte/Nombre fermerait le panneau avant même que le type ne
  // change). Différer laisse le temps au nouveau champ, remonté avec
  // autoFocus après le changement, de reprendre le focus.
  function checkFocusAfterBlur() {
    pendingBlurCheckRef.current = requestAnimationFrame(() => {
      pendingBlurCheckRef.current = null;
      if (!panelRef.current?.contains(document.activeElement)) {
        commitAndClose();
      }
    });
  }

  const containerProps = {
    ref: panelRef,
    onBlur: checkFocusAfterBlur,
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        commitAndClose();
      }
    },
  };

  return {
    mounted,
    visible,
    handleFieldDone: checkFocusAfterBlur,
    containerProps,
    // Fermeture immédiate (commit + close synchrones) — pour un déclencheur
    // qui sait déjà, sans ambiguïté, que le panneau doit se refermer (ex. un
    // second clic sur la roue de réglages), plutôt que de dépendre du blur
    // différé d'une frame (qui course alors avec le clic rouvrant le panneau).
    commitAndClose,
  };
}
