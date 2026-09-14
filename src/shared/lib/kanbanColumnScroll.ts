/** Position et largeur d'une colonne dans le contenu du board (coordonnées de layout). */
export interface ColumnSpan {
  start: number;
  size: number;
}

/** Index de la colonne dont le centre est le plus proche du centre visible, -1 si aucune. */
export function currentColumnIndex(
  columns: ColumnSpan[],
  scrollLeft: number,
  viewportWidth: number
): number {
  const viewCenter = scrollLeft + viewportWidth / 2;
  let best = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  columns.forEach((col, i) => {
    const dist = Math.abs(col.start + col.size / 2 - viewCenter);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}

/**
 * `scrollLeft` visant la colonne voisine (direction -1/+1) **centrée** dans la
 * vue, borné aux extrémités du board. `null` quand il n'y a rien à faire : pas
 * de colonne dans cette direction, ou board entièrement visible.
 */
export function stepColumnScrollLeft(
  columns: ColumnSpan[],
  scrollLeft: number,
  viewportWidth: number,
  scrollWidth: number,
  direction: -1 | 1
): number | null {
  const maxScroll = scrollWidth - viewportWidth;
  if (maxScroll <= 0) return null;

  const current = currentColumnIndex(columns, scrollLeft, viewportWidth);
  const next = columns[current + direction];
  if (current === -1 || !next) return null;

  const target = Math.min(
    maxScroll,
    Math.max(0, next.start + next.size / 2 - viewportWidth / 2)
  );
  // Déjà en butée de ce côté : inutile de relancer un défilement immobile.
  return target === scrollLeft ? null : target;
}

/**
 * Direction de navigation selon la proximité du pointeur avec un bord du board :
 * -1 (colonne précédente), 1 (suivante), 0 hors des bandes. Le bord de début
 * l'emporte si les deux bandes se recouvrent.
 *
 * Le pointeur peut être au-delà du bord (doigt en limite d'écran) : la bande
 * reste active, elle n'est bornée que vers l'intérieur.
 */
export function edgeDirection(
  x: number,
  left: number,
  right: number,
  edgeWidth: number
): -1 | 0 | 1 {
  if (x - left < edgeWidth) return -1;
  if (right - x < edgeWidth) return 1;
  return 0;
}
