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
    // Garde-fou : un état "stuck-true" précédent ne doit pas suppress le click suivant.
    suppressNextClickRef.current = false;
    timerRef.current = setTimeout(() => {
      // Reset au début du fire pour partir d'un état propre, puis arm la suppression
      // du ghost click iOS qui va suivre le long-press.
      suppressNextClickRef.current = true;
      timerRef.current = null;
      onLongPress();
    }, 600);
  }, [onLongPress]);

  const cancel = useCallback(() => {
    // Si le timer était encore pending (gesture annulée avant long-press), on garantit
    // qu'aucun suppress n'a été armé. S'il avait déjà fire, suppressNextClickRef reste
    // à true pour que le ghost click iOS soit bien suppressé par handleClick.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      suppressNextClickRef.current = false;
    }
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
