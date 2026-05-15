import { useCallback, useRef, useState } from "react";
import { hapticImpact, hapticSelection } from "../lib/haptics";

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

  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const complete = useCallback(() => {
    hapticImpact("medium");
    setIsAnimating(true);
    setSwipeProgress(1);
    isTracking.current = false;
    hasTriggeredSelection.current = false;
    setTimeout(() => {
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
        setTimeout(() => setIsAnimating(false), DURATION);
      });
    });
  }, []);

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
