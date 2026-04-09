import { useEffect, useState } from "react";

/**
 * Retourne true si le clavier iOS est ouvert.
 * Détecté via window.visualViewport : si la hauteur visible est réduite de plus de 20%,
 * le clavier est présent.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const check = () => setVisible(vv.height < window.innerHeight * 0.8);
    vv.addEventListener("resize", check);
    return () => vv.removeEventListener("resize", check);
  }, []);

  return visible;
}
