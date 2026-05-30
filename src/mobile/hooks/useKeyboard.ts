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
export function useKeyboard(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({
    height: 0,
    isOpen: false,
    isAndroidOpen: false,
  });

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
