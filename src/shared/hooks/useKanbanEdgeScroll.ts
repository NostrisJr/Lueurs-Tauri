import { useCallback, useEffect, useRef } from "react";
import { stepColumnScrollLeft } from "../lib/kanbanColumnScroll";
import { createLogger } from "../lib/logger";

const log = createLogger("KanbanEdgeScroll");

// Cadence de répétition tant que la carte reste sur une bande de bord — laisse
// le temps au défilement lissé d'aboutir et de se lire avant le pas suivant.
const STEP_INTERVAL_MS = 550;

export type EdgeDirection = -1 | 0 | 1;

/**
 * Défilement du board colonne par colonne pendant un drag, tant que la carte
 * reste sur une bande de bord. La colonne visée est centrée, jamais alignée à
 * gauche : sinon la colonne d'arrivée se retrouve sous le pointeur, collée au
 * bord d'où l'on vient.
 *
 * Retourne le pilote de direction : -1 (gauche), 1 (droite), 0 (arrêt).
 */
export function useKanbanEdgeScroll(
  boardRef: React.RefObject<HTMLDivElement | null>
) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const directionRef = useRef<EdgeDirection>(0);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    directionRef.current = 0;
  }, []);

  const scrollOneColumn = useCallback(
    (direction: -1 | 1) => {
      const board = boardRef.current;
      if (!board) return;

      const columns = Array.from(
        board.querySelectorAll<HTMLElement>("[data-kanban-column]")
      ).map((el) => ({ start: el.offsetLeft, size: el.offsetWidth }));

      const target = stepColumnScrollLeft(
        columns,
        board.scrollLeft,
        board.clientWidth,
        board.scrollWidth,
        direction
      );
      // Butée atteinte : inutile de continuer à réveiller le timer.
      if (target === null) {
        log.info("bord du board atteint", { direction });
        stop();
        return;
      }
      board.scrollTo({ left: target, behavior: "smooth" });
    },
    [boardRef, stop]
  );

  const setDirection = useCallback(
    (direction: EdgeDirection) => {
      if (direction === directionRef.current) return;
      stop();
      if (direction === 0) return;

      directionRef.current = direction;
      log.info("navigation par bande de bord", { direction });
      scrollOneColumn(direction);
      timerRef.current = setInterval(
        () => scrollOneColumn(direction),
        STEP_INTERVAL_MS
      );
    },
    [scrollOneColumn, stop]
  );

  useEffect(() => stop, [stop]);

  return setDirection;
}
