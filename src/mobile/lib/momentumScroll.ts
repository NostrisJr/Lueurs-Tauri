// Inertie de scroll rejouée à la main : les rangées avec drag-to-reorder
// (cf. MobileRowGestures) passent en touchAction "none" pour empêcher le
// scroll natif de voler le geste de déplacement, ce qui désactive au passage
// l'inertie native du conteneur au relâchement du doigt. On la reproduit ici
// pour ne pas perdre la fluidité du scroll normal (avant tout appui long).

// En dessous, l'inertie est jugée terminée (px/ms).
const MIN_VELOCITY = 0.02;
// Taux de décélération "normal" d'UIScrollView (iOS), appliqué par ms écoulée.
const DECELERATION = 0.998;

// Une seule inertie active par conteneur : plusieurs rangées différentes
// peuvent déclencher un scroll sur le même conteneur scrollable au fil des
// gestes successifs, il faut donc pouvoir arrêter l'inertie d'une rangée
// depuis une autre (ou depuis un nouveau toucher sur le conteneur lui-même).
const activeRaf = new WeakMap<HTMLElement, number>();

export function stopMomentumScroll(container: HTMLElement) {
  const raf = activeRaf.get(container);
  if (raf !== undefined) {
    cancelAnimationFrame(raf);
    activeRaf.delete(container);
  }
}

// vy : vitesse verticale signée en px/ms au relâchement (même convention que
// le scroll image par image, `scrollTop -= dy` : positif = doigt vers le bas).
export function startMomentumScroll(container: HTMLElement, vy: number) {
  stopMomentumScroll(container);
  if (Math.abs(vy) < MIN_VELOCITY) return;

  let velocity = vy;
  let lastTime = performance.now();

  function tick(now: number) {
    const dt = now - lastTime;
    lastTime = now;
    velocity *= DECELERATION ** dt;
    container.scrollTop -= velocity * dt;

    const atTop = container.scrollTop <= 0;
    const atBottom =
      container.scrollTop >= container.scrollHeight - container.clientHeight;
    if (
      Math.abs(velocity) < MIN_VELOCITY ||
      (atTop && velocity > 0) ||
      (atBottom && velocity < 0)
    ) {
      activeRaf.delete(container);
      return;
    }
    activeRaf.set(container, requestAnimationFrame(tick));
  }

  activeRaf.set(container, requestAnimationFrame(tick));
}
