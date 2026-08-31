import { useDrag } from "@use-gesture/react";
import { useRef } from "react";
import { hapticImpact } from "../../../lib/haptics";
import { startMomentumScroll } from "../../../lib/momentumScroll";

// Durée d'appui avant le drag — même standard que l'appui long du file tree
// (cf. MobileRowGestures), mais ici aucun menu ne s'interpose : l'appui long
// déclenche le déplacement directement.
const LONG_PRESS_MS = 500;
// Rayon de tolérance pendant l'attente du long-press (cf. MobileRowGestures).
const HOLD_JITTER_PX = 10;

interface Options {
  onDragStart: (x: number, y: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  onDragCancel: () => void;
}

/**
 * Appui long → drag direct, sur le modèle de MobileRowGestures mais réduit à
 * un seul geste possible (pas de menu, pas de swipe).
 *
 * Le board kanban scrolle sur deux axes indépendants — horizontalement pour
 * changer de colonne ([data-kanban-board]), verticalement pour la page entière
 * ([data-scrollable], posé par MobileEditor) — et la carte doit rester
 * scrollable tant que l'appui long n'a pas pris. touchAction se fige au
 * pointerdown pour toute la durée du toucher (WebKit) : on le passe à "none"
 * dès le départ et on rejoue le scroll à la main sur l'axe dominant du geste,
 * jusqu'à ce que le timer expire.
 */
export function useMobileCardDrag({
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: Options) {
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<"idle" | "dragging">("idle");
  const axisLockRef = useRef<"x" | "y" | null>(null);
  const boardElRef = useRef<HTMLElement | null>(null);
  const pageElRef = useRef<HTMLElement | null>(null);
  const lastPointRef = useRef({ x: 0, y: 0 });

  function clearHoldTimer() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    clearHoldTimer();
    axisLockRef.current = null;
    phaseRef.current = "idle";
    lastPointRef.current = { x: e.clientX, y: e.clientY };
    const target = e.target as HTMLElement;
    boardElRef.current = target.closest<HTMLElement>("[data-kanban-board]");
    pageElRef.current = target.closest<HTMLElement>("[data-scrollable]");
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      phaseRef.current = "dragging";
      hapticImpact("medium");
      onDragStart(lastPointRef.current.x, lastPointRef.current.y);
    }, LONG_PRESS_MS);
  }

  function handlePointerUp() {
    clearHoldTimer();
  }

  const bind = useDrag(
    (state) => {
      const {
        last,
        xy: [x, y],
        movement: [mx, my],
        delta: [dx, dy],
        velocity: [vx, vy],
        direction: [dirX, dirY],
        canceled,
        tap,
        event,
      } = state;

      lastPointRef.current = { x, y };

      if (phaseRef.current === "dragging") {
        event?.preventDefault?.();
        if (last || canceled) {
          phaseRef.current = "idle";
          if (canceled) onDragCancel();
          else onDragEnd(x, y);
        } else {
          onDragMove(x, y);
        }
        return;
      }

      if (last) clearHoldTimer();
      if (tap) return;

      if (holdTimerRef.current) {
        if (Math.hypot(mx, my) <= HOLD_JITTER_PX) return;
        clearHoldTimer();
      }

      // Appui long écarté (mouvement franc avant expiration) : rejoue le
      // scroll natif à la main sur l'axe dominant, verrouillé pour le reste
      // du geste — jamais de bascule en cours de route.
      event?.preventDefault?.();
      if (!axisLockRef.current) {
        axisLockRef.current = Math.abs(mx) > Math.abs(my) ? "x" : "y";
      }

      if (axisLockRef.current === "x") {
        const board = boardElRef.current;
        if (board) {
          board.scrollLeft -= dx;
          if (last) startMomentumScroll(board, dirX * vx, "x");
        }
      } else {
        const page = pageElRef.current;
        if (page) {
          page.scrollTop -= dy;
          if (last) startMomentumScroll(page, dirY * vy, "y");
        }
      }
    },
    { filterTaps: true }
  );

  return {
    armProps: {
      onPointerDown: handlePointerDown,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onLostPointerCapture: handlePointerUp,
    },
    bind,
    style: {
      touchAction: "none" as const,
      userSelect: "none" as const,
      WebkitTouchCallout: "none" as const,
    },
  };
}
