// Zone en bord haut/bas d'un conteneur scrollable où le scroll auto s'engage
// pendant un déplacement au doigt.
const AUTOSCROLL_EDGE_PX = 70;
// Vitesse max (px/frame), atteinte au bord extrême — proportionnelle à la
// pénétration dans la zone, comme le fait dnd-kit/la plupart des libs mobiles.
const AUTOSCROLL_MAX_STEP_PX = 14;

interface Options {
  /** Conteneur scrollable, relu à chaque frame (peut être monté après le départ). */
  container: () => HTMLElement | null;
  /** Position courante du doigt en coordonnées viewport. */
  point: () => { x: number; y: number };
  /** Appelé uniquement sur les frames où le conteneur a réellement défilé. */
  onScroll?: (x: number, y: number) => void;
}

/**
 * Boucle rAF de scroll automatique pendant un drag au doigt.
 *
 * Pilotée en rAF et non par un nudge à chaque `pointermove` : ces derniers se
 * raréfient dès que le doigt reste immobile en bord de liste, précisément le
 * moment où l'utilisateur attend que ça défile.
 *
 * Retourne la fonction d'arrêt.
 */
export function startDragAutoscroll({
  container,
  point,
  onScroll,
}: Options): () => void {
  let raf = 0;
  let running = true;

  function tick() {
    if (!running) return;
    const el = container();
    if (el) {
      const rect = el.getBoundingClientRect();
      const { x, y } = point();
      const distTop = y - rect.top;
      const distBottom = rect.bottom - y;
      let scrolled = false;
      if (distTop < AUTOSCROLL_EDGE_PX) {
        const intensity = 1 - Math.max(0, distTop) / AUTOSCROLL_EDGE_PX;
        el.scrollTop -= AUTOSCROLL_MAX_STEP_PX * intensity;
        scrolled = true;
      } else if (distBottom < AUTOSCROLL_EDGE_PX) {
        const intensity = 1 - Math.max(0, distBottom) / AUTOSCROLL_EDGE_PX;
        el.scrollTop += AUTOSCROLL_MAX_STEP_PX * intensity;
        scrolled = true;
      }
      // Le doigt est immobile pendant l'autoscroll (aucun pointermove) mais la
      // liste défile sous lui : la cible survolée doit être réévaluée ici, sinon
      // elle reste figée sur celle d'avant le défilement.
      if (scrolled) onScroll?.(x, y);
    }
    raf = requestAnimationFrame(tick);
  }

  raf = requestAnimationFrame(tick);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
  };
}
