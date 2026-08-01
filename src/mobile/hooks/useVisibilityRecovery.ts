import { useEffect } from "react";

/**
 * Filet de sécurité WKWebView : les timers/rAF JS peuvent geler quand l'app
 * passe en arrière-plan (transition, swipe, etc. bloqués à mi-course). Appelle
 * `onVisible` dès que l'app redevient au premier plan, pour forcer une fin
 * propre côté appelant (chaque cas de figure a son propre nettoyage).
 */
export function useVisibilityRecovery(onVisible: () => void) {
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      onVisible();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [onVisible]);
}
