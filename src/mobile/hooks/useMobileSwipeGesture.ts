import { useCallback, useEffect, useRef, useState } from "react";
import { hapticImpact, hapticSelection } from "../lib/haptics";
import { useVisibilityRecovery } from "./useVisibilityRecovery";

interface SwipeGestureOptions {
  enabled?: boolean;
  edgeWidth?: number;
  completionThreshold?: number;
  /** Bord de départ du geste — "left" (retour, défaut) ou "right" (ex: accès aux onglets). */
  edge?: "left" | "right";
  /** Délai (ms) avant d'appeler onComplete après un swipe réussi — laisse le
   * temps à une éventuelle transition pilotée par swipeProgress de se jouer
   * (cf. retour arrière : les deux couches glissent avant le démontage).
   * Mettre à 0 si l'appelant n'anime rien de tel — sinon latence perçue pour rien. */
  completeDelay?: number;
  /** Sélecteur CSS : un toucher démarrant dans un élément qui matche (ou un de
   * ses ancêtres) n'arme pas le geste — laisse l'élément gérer lui-même son tap
   * / appui long (ex: le switcher d'espaces, qui chevauche la zone de bord). */
  excludeSelector?: string;
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
 * Swipe depuis un bord d'écran (gauche = retour arrière par défaut, droit = ex.
 * accès aux onglets) déclenchant onComplete au-delà du seuil.
 * Expose swipeProgress (0–1) pour animer simultanément deux couches (actuelle + précédente).
 * Cancel = spring vers 0 via double rAF pour garantir que la transition CSS est active.
 */
export function useMobileSwipeGesture(
  onComplete: () => void,
  opts: SwipeGestureOptions = {}
): SwipeGestureResult {
  const {
    enabled = true,
    edgeWidth = 30,
    completionThreshold = 0.4,
    edge = "left",
    completeDelay = DURATION,
    excludeSelector,
  } = opts;
  const sign = edge === "left" ? 1 : -1;

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
    }, completeDelay);
  }, [onComplete, completeDelay]);

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
      const distanceFromEdge = edge === "left" ? x : window.innerWidth - x;
      if (!enabled || distanceFromEdge > edgeWidth) {
        isTracking.current = false;
        return;
      }
      if (
        excludeSelector &&
        (e.target as HTMLElement).closest(excludeSelector)
      ) {
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
    [enabled, edgeWidth, edge, excludeSelector]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isTracking.current) return;
      const dx = (e.touches[0].clientX - touchStartX.current) * sign;
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
    },
    [sign]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isTracking.current) return;
      const dx = (e.changedTouches[0].clientX - touchStartX.current) * sign;
      const dt = Math.max(Date.now() - touchStartTime.current, 1);
      const velocity = dx / dt;
      const progress = dx / window.innerWidth;
      if (dx > 0 && (progress >= completionThreshold || velocity > 0.5)) {
        complete();
      } else {
        cancel();
      }
    },
    [completionThreshold, complete, cancel, sign]
  );

  return {
    swipeProgress,
    isAnimating,
    touchHandlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}

export { EASING, DURATION };
