import { useRef, useState, useCallback } from "react";

interface SwipeBackOptions {
  // Désactiver le swipe quand false (ex: plus de dossier parent)
  condition?: boolean;
}

interface SwipeBackResult {
  swipeTranslate: number;
  isTransitioning: boolean;
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

/** Swipe depuis le bord gauche pour déclencher un retour arrière. */
export function useMobileSwipeBack(
  onSwipeComplete: () => void,
  opts: SwipeBackOptions = {}
): SwipeBackResult {
  const { condition = true } = opts;

  const swipeDeltaRef = useRef(0);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const [swipeTranslate, setSwipeTranslate] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    swipeDeltaRef.current = 0;
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!condition) return;
      const dx = e.touches[0].clientX - touchStartXRef.current;
      const dy = e.touches[0].clientY - touchStartYRef.current;
      if (touchStartXRef.current > 30) return;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (dx < 0) return;
      swipeDeltaRef.current = dx;
      setSwipeTranslate(dx);
    },
    [condition]
  );

  const onTouchEnd = useCallback(() => {
    if (swipeDeltaRef.current > 80 && condition) {
      setIsTransitioning(true);
      setSwipeTranslate(window.innerWidth);
      setTimeout(() => {
        onSwipeComplete();
        setSwipeTranslate(0);
        setIsTransitioning(false);
      }, 200);
    } else {
      setSwipeTranslate(0);
    }
    swipeDeltaRef.current = 0;
  }, [condition, onSwipeComplete]);

  return {
    swipeTranslate,
    isTransitioning,
    touchHandlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
