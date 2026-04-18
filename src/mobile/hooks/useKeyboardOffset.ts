import { useEffect, useState } from "react";

/**
 * Retourne la hauteur du clavier iOS en px (0 si clavier fermé).
 * Basé sur window.visualViewport : quand le clavier apparaît, visualViewport.height
 * diminue tandis que window.innerHeight reste stable (layout viewport fixe).
 * Utilisé pour translater les panneaux fixed vers le haut et étendre le
 * paddingBottom des zones scrollables.
 */
export function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const kb = window.innerHeight - vv.height - vv.offsetTop;
      setOffset(Math.max(0, kb));
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return offset;
}
