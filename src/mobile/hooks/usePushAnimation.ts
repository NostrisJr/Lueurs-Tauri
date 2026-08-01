/**
 * usePushAnimation — machine d'état pour l'animation push (slide depuis la droite).
 *
 * Gère le cycle : initial → animating → null.
 * L'appelant reçoit `trigger()` pour démarrer, `phase` pour piloter les styles,
 * et `isActive` comme shorthand de `phase !== null`.
 *
 * L'astuce useLayoutEffect + requestAnimationFrame garantit que le premier frame
 * est rendu en position "initial" (hors écran) avant la transition CSS.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useVisibilityRecovery } from "./useVisibilityRecovery";

export function usePushAnimation(duration: number) {
  const [phase, setPhase] = useState<"initial" | "animating" | null>(null);
  const isActiveRef = useRef(false);
  const rafRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  // Déclenche la transition CSS après que le frame "initial" a été peint
  useEffect(() => {
    if (phase !== "initial") return;
    rafRef.current = requestAnimationFrame(() => {
      setPhase("animating");
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setPhase(null);
        isActiveRef.current = false;
      }, duration);
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, duration]);

  // Démarre l'animation — sans effet si déjà en cours
  const trigger = useCallback(() => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;
    setPhase("initial");
  }, []);

  // Filet de sécurité : en WKWebView, les timers JS peuvent geler quand l'app passe
  // en arrière-plan pendant un slide, laissant `phase` bloqué à "animating" — et
  // isActiveRef=true ignore alors tout nouveau trigger() au retour au premier plan.
  // On force la fin propre (snap à l'état final) dès que l'app redevient visible.
  useVisibilityRecovery(
    useCallback(() => {
      if (!isActiveRef.current) return;
      clearTimeout(timeoutRef.current);
      cancelAnimationFrame(rafRef.current);
      setPhase(null);
      isActiveRef.current = false;
    }, [])
  );

  return { phase, isActive: phase !== null, trigger };
}
