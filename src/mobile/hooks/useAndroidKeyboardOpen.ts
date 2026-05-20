import { useEffect, useState } from "react";

const KEYBOARD_THRESHOLD_PX = 150;

/**
 * Sur Android (avec insets IME appliqués côté natif), le WebView se redimensionne
 * quand le clavier s'ouvre : window.innerHeight diminue. visualViewport ne voit
 * plus le clavier (puisqu'il correspond désormais à la zone visible), donc on
 * détecte l'ouverture via la baisse d'innerHeight par rapport au max observé.
 */
export function useAndroidKeyboardOpen(): boolean {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let maxHeight = window.innerHeight;
    const update = () => {
      const h = window.innerHeight;
      if (h > maxHeight) maxHeight = h;
      setIsOpen(maxHeight - h > KEYBOARD_THRESHOLD_PX);
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isOpen;
}
