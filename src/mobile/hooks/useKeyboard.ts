import { useEffect, useState } from "react";

interface KeyboardState {
  /** Hauteur du clavier (px) — non nulle sur iOS et Android sans insets natifs. */
  height: number;
  /** Le clavier est visible (iOS / Android sans insets). */
  isOpen: boolean;
  /** Le clavier est visible sur Android avec insets IME natifs. */
  isAndroidOpen: boolean;
}

const KEYBOARD_THRESHOLD_PX = 150;

/**
 * Détecte l'état du clavier mobile.
 *
 * - iOS / Android sans insets : `height` et `isOpen` via `visualViewport`.
 * - Android avec insets natifs (MainActivity.kt) : le WebView se redimensionne,
 *   `visualViewport` ne voit plus le clavier → `isAndroidOpen` via `innerHeight`.
 */
// État initial lu directement au montage (pas figé à "clavier fermé") : si le
// clavier était DÉJÀ ouvert avant que ce hook ne monte (ex: une nouvelle
// BottomSheet ouverte pendant qu'on tapait déjà dans un autre champ), aucun
// resize/scroll de visualViewport ne se reproduit puisque rien ne change
// côté clavier — un state initialisé à { height: 0, isOpen: false } restait
// alors faux indéfiniment, laissant la sheet se positionner comme si de rien
// n'était (et donc se faire recouvrir par le clavier déjà là).
function readKeyboardState(): KeyboardState {
  const vv = window.visualViewport;
  const height = vv
    ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
    : 0;
  return {
    height,
    isOpen: height > 50,
    // Non détectable sans historique (comparé à un maxHeight observé au fil
    // du temps, cf. l'effet plus bas) : reste à false tant que ce premier
    // resize n'est pas encore passé — cas Android avec insets IME natifs
    // uniquement, pas le bug rapporté (iOS/Android sans insets, via height/
    // isOpen ci-dessus, corrigés par ce montage synchrone).
    isAndroidOpen: false,
  };
}

export function useKeyboard(): KeyboardState {
  const [state, setState] = useState<KeyboardState>(readKeyboardState);

  // iOS / Android sans insets — visualViewport
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const h = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setState((prev) => ({ ...prev, height: h, isOpen: h > 50 }));
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // Android avec insets IME natifs — innerHeight
  useEffect(() => {
    let maxHeight = window.innerHeight;
    const update = () => {
      const h = window.innerHeight;
      if (h > maxHeight) maxHeight = h;
      const isAndroidOpen = maxHeight - h > KEYBOARD_THRESHOLD_PX;
      setState((prev) => ({ ...prev, isAndroidOpen }));
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return state;
}
