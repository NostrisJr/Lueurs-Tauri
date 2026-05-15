import { useCallback, useRef } from "react";

/** Long-press de 600ms sur un élément tactile. */
export function useLongPress(onLongPress: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTouchStart = useCallback(() => {
    timerRef.current = setTimeout(onLongPress, 600);
  }, [onLongPress]);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { onTouchStart, onTouchEnd: cancel, onTouchMove: cancel };
}
