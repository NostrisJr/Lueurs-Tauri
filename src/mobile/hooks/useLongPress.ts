import { useCallback, useRef } from "react";

/**
 * Long-press de 600ms sur un élément tactile.
 * Prend en charge onClick directement pour supprimer le ghost click
 * que iOS synthétise après un long press.
 */
export function useLongPress(onLongPress: () => void, onClick: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Empêche le click synthétisé par iOS après un long press
  const suppressNextClickRef = useRef(false);

  const handleTouchStart = useCallback(() => {
    suppressNextClickRef.current = false;
    timerRef.current = setTimeout(() => {
      suppressNextClickRef.current = true;
      onLongPress();
    }, 600);
  }, [onLongPress]);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleClick = useCallback(() => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    onClick();
  }, [onClick]);

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: cancel,
    onTouchMove: cancel,
    onTouchCancel: cancel,
    onClick: handleClick,
  };
}
