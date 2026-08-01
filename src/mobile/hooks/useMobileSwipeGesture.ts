import { useCallback, useEffect, useRef, useState } from "react";
import { hapticImpact, hapticSelection } from "../lib/haptics";
import { useVisibilityRecovery } from "./useVisibilityRecovery";

interface SwipeGestureOptions {
  enabled?: boolean;
  edgeWidth?: number;
  completionThreshold?: number;
}

export interface SwipeGestureResult {
  swipeProgress: number;
  isAnimating: boolean;
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
}

const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
const DURATION = 300;

/**
 * Swipe depuis le bord gauche pour déclencher un retour arrière.
 * Expose swipeProgress (0–1) pour animer simultanément deux couches (actuelle + précédente).
 * Cancel = spring vers 0 via double rAF pour garantir que la transition CSS est active.
 */
export function useMobileSwipeGesture(
  onComplete: () => void,
  opts: SwipeGestureOptions = {}
): SwipeGestureResult {
  const { enabled = true, edgeWidth = 30, completionThreshold = 0.4 } = opts;

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const isTracking = useRef(false);
  const hasTriggeredSelection = useRef(false);
  const rafRef = useRef<number>(0);
  // Pour clear les timers d'animation au démontage (sinon setSwipeProgress/setIsAnimating
  // peuvent être appelés sur un composant démonté).
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const complete = useCallback(() => {
    hapticImpact("medium");
    // Sans ça, le champ actif (éditeur) garde le focus derrière la vue qui
    // glisse hors écran, et le clavier reste ouvert par-dessus.
    (document.activeElement as HTMLElement | null)?.blur();
    setIsAnimating(true);
    setSwipeProgress(1);
    isTracking.current = false;
    hasTriggeredSelection.current = false;
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    completeTimerRef.current = setTimeout(() => {
      completeTimerRef.current = null;
      onComplete();
      setSwipeProgress(0);
      setIsAnimating(false);
    }, DURATION);
  }, [onComplete]);

  const cancel = useCallback(() => {
    isTracking.current = false;
    hasTriggeredSelection.current = false;
    // Double rAF : active la transition CSS dans un frame, puis déclenche la valeur cible
    setIsAnimating(true);
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        setSwipeProgress(0);
        if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
        cancelTimerRef.current = setTimeout(() => {
          cancelTimerRef.current = null;
          setIsAnimating(false);
        }, DURATION);
      });
    });
  }, []);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    },
    []
  );

  // Filet de sécurité : en WKWebView, les timers JS peuvent geler si l'app passe en
  // arrière-plan pendant l'animation de complete()/cancel(), laissant swipeProgress/
  // isAnimating bloqués à mi-course. Au retour au premier plan, on termine
  // immédiatement l'action en cours plutôt que d'attendre un timer qui ne viendra
  // peut-être jamais.
  useVisibilityRecovery(
    useCallback(() => {
      if (completeTimerRef.current) {
        clearTimeout(completeTimerRef.current);
        completeTimerRef.current = null;
        onComplete();
        setSwipeProgress(0);
        setIsAnimating(false);
      } else if (cancelTimerRef.current) {
        clearTimeout(cancelTimerRef.current);
        cancelTimerRef.current = null;
        setSwipeProgress(0);
        setIsAnimating(false);
      }
    }, [onComplete])
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const x = e.touches[0].clientX;
      if (!enabled || x > edgeWidth) {
        isTracking.current = false;
        return;
      }
      e.stopPropagation();
      touchStartX.current = x;
      touchStartY.current = e.touches[0].clientY;
      touchStartTime.current = Date.now();
      isTracking.current = true;
      hasTriggeredSelection.current = false;
    },
    [enabled, edgeWidth]
  );

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isTracking.current) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(dy) > Math.abs(dx) && dx < 10) {
      isTracking.current = false;
      return;
    }
    if (dx <= 0) return;
    const progress = Math.min(dx / window.innerWidth, 1);
    if (progress > 0.05 && !hasTriggeredSelection.current) {
      hapticSelection();
      hasTriggeredSelection.current = true;
    }
    setSwipeProgress(progress);
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isTracking.current) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dt = Math.max(Date.now() - touchStartTime.current, 1);
      const velocity = dx / dt;
      const progress = dx / window.innerWidth;
      if (dx > 0 && (progress >= completionThreshold || velocity > 0.5)) {
        complete();
      } else {
        cancel();
      }
    },
    [completionThreshold, complete, cancel]
  );

  return {
    swipeProgress,
    isAnimating,
    touchHandlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}

export { EASING, DURATION };
