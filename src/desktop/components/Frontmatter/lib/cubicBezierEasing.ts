/**
 * Résout un cubic-bezier(x1,y1,x2,y2) comme le fait le moteur CSS (portage de
 * l'algorithme UnitBezier de WebKit) — pour animer autre chose que du CSS
 * (ici scrollTop) exactement sur la même courbe qu'une transition CSS
 * existante, image par image, pas seulement aux deux extrémités.
 */
export function cubicBezierEasing(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  function sampleX(t: number) {
    return ((ax * t + bx) * t + cx) * t;
  }
  function sampleDerivativeX(t: number) {
    return (3 * ax * t + 2 * bx) * t + cx;
  }

  function solveT(x: number): number {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-6) return t;
      const d = sampleDerivativeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-6) return t;
      if (dx > 0) hi = t;
      else lo = t;
      t = (hi + lo) / 2;
    }
    return t;
  }

  return (t: number) => {
    const u = solveT(t);
    return ((ay * u + by) * u + cy) * u;
  };
}

// Tailwind "ease-out" (--ease-out du thème par défaut) : cubic-bezier(0, 0, 0.2, 1) —
// différent du mot-clé CSS natif "ease-out" (0, 0, 0.58, 1).
export const tailwindEaseOut = cubicBezierEasing(0, 0, 0.2, 1);
