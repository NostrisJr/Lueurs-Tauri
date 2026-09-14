// Zone en bord haut/bas d'un conteneur scrollable où le scroll auto s'engage
// pendant un déplacement au doigt ou au curseur.
export const AUTOSCROLL_EDGE_PX = 70;
// Vitesse max (px/frame), atteinte au bord extrême — proportionnelle à la
// pénétration dans la zone, comme le fait dnd-kit/la plupart des libs mobiles.
export const AUTOSCROLL_MAX_STEP_PX = 14;

interface Options {
  /** Conteneur scrollable, relu à chaque frame (peut être monté après le départ). */
  container: () => HTMLElement | null;
  /** Position courante du doigt en coordonnées viewport. */
  point: () => { x: number; y: number };
  /** Appelé uniquement sur les frames où le conteneur a réellement défilé. */
  onScroll?: (x: number, y: number) => void;
  /** Axe scrollé — "y" (défaut) pour une liste verticale, "x" pour un board horizontal. */
  axis?: "x" | "y";
  /**
   * Gèle le défilement tant que c'est vrai — pour une cible de dépôt posée dans
   * une zone de bord, qui serait sinon impossible à viser sans déclencher le
   * défilement qu'elle recouvre.
   */
  paused?: (point: { x: number; y: number }) => boolean;
}

/**
 * Pas de défilement (px) à appliquer pour une position de pointeur donnée sur
 * un axe : négatif vers le début du conteneur, positif vers sa fin, 0 hors des
 * zones de bord. Le bord de début l'emporte si les deux zones se recouvrent
 * (conteneur plus étroit que deux zones).
 */
export function computeAutoscrollStep(
  pos: number,
  start: number,
  end: number
): number {
  const distStart = pos - start;
  if (distStart < AUTOSCROLL_EDGE_PX) {
    const intensity = 1 - Math.max(0, distStart) / AUTOSCROLL_EDGE_PX;
    return -AUTOSCROLL_MAX_STEP_PX * intensity;
  }
  const distEnd = end - pos;
  if (distEnd < AUTOSCROLL_EDGE_PX) {
    const intensity = 1 - Math.max(0, distEnd) / AUTOSCROLL_EDGE_PX;
    return AUTOSCROLL_MAX_STEP_PX * intensity;
  }
  return 0;
}

/**
 * Boucle rAF de scroll automatique pendant un drag au doigt ou au curseur.
 *
 * Pilotée en rAF et non par un nudge à chaque `pointermove` : ces derniers se
 * raréfient dès que le pointeur reste immobile en bord de liste, précisément le
 * moment où l'utilisateur attend que ça défile.
 *
 * Retourne la fonction d'arrêt.
 */
export function startDragAutoscroll({
  container,
  point,
  onScroll,
  axis = "y",
  paused,
}: Options): () => void {
  let raf = 0;
  let running = true;

  function tick() {
    if (!running) return;
    const el = container();
    const p = point();
    if (el && !paused?.(p)) {
      const rect = el.getBoundingClientRect();
      const { x, y } = p;
      const step =
        axis === "y"
          ? computeAutoscrollStep(y, rect.top, rect.bottom)
          : computeAutoscrollStep(x, rect.left, rect.right);
      if (step !== 0) {
        if (axis === "y") el.scrollTop += step;
        else el.scrollLeft += step;
        // Le pointeur est immobile pendant l'autoscroll (aucun pointermove) mais
        // la liste défile sous lui : la cible survolée doit être réévaluée ici,
        // sinon elle reste figée sur celle d'avant le défilement.
        onScroll?.(x, y);
      }
    }
    raf = requestAnimationFrame(tick);
  }

  raf = requestAnimationFrame(tick);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
  };
}
