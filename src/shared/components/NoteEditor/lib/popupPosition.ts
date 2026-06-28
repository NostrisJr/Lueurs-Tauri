/**
 * popupPosition.ts
 *
 * Positionne un popup ancré sous (ou au-dessus de) un point de l'éditeur, en
 * restant dans le viewport : bascule au-dessus si débordement bas, clamp horizontal.
 * Coordonnées en repère viewport (pour `position: fixed`).
 */

export interface AnchorCoords {
  left: number;
  top: number;
  bottom: number;
}

const MARGIN = 8;
const GAP = 6;

export function clampPopup(
  anchor: AnchorCoords,
  width: number,
  estHeight: number
): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = anchor.left;
  if (left + width > vw - MARGIN) left = vw - width - MARGIN;
  if (left < MARGIN) left = MARGIN;

  // Sous l'ancre par défaut ; au-dessus si ça déborde en bas.
  let top = anchor.bottom + GAP;
  if (top + estHeight > vh - MARGIN) {
    const above = anchor.top - estHeight - GAP;
    top = above >= MARGIN ? above : Math.max(MARGIN, vh - estHeight - MARGIN);
  }

  return { left, top };
}
