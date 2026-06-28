import { useRef, useState } from "react";
import { IconTrash } from "../../../shared/components/PlatformIcon";
import { hapticImpact } from "../../lib/haptics";

const BTN = 40; // diamètre du bouton rond
const PAD_R = 10; // marge droite du bouton
const GAP = 10; // espace entre l'onglet et le bouton
const SNAP_TO = PAD_R + BTN + GAP; // snap → cercle parfait avec gap
const CLOSE_THRESHOLD = 160;
const DIRECTION_LOCK_PX = 6;

type Phase = "idle" | "slideOut" | "collapse";

interface DragState {
  startX: number;
  startY: number;
  startOffset: number;
  confirmed: boolean;
  thresholdHit: boolean;
}

interface Props {
  children: React.ReactNode;
  onClose: () => void;
}

export function SwipeableTabRow({ children, onClose }: Props) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const drag = useRef<DragState | null>(null);

  function triggerClose() {
    hapticImpact("medium");
    setPhase("slideOut");
    setTimeout(() => setPhase("collapse"), 240);
    setTimeout(onClose, 460);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (phase !== "idle") return;
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffset: offsetX,
      confirmed: false,
      thresholdHit: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (!d.confirmed) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > DIRECTION_LOCK_PX) {
        d.confirmed = true;
        setIsDragging(true);
      } else if (Math.abs(dy) > DIRECTION_LOCK_PX) {
        drag.current = null;
        return;
      }
      return;
    }

    const next = Math.min(0, d.startOffset + dx);
    setOffsetX(next);

    if (!d.thresholdHit && next < -CLOSE_THRESHOLD) {
      d.thresholdHit = true;
      hapticImpact("light");
    } else if (d.thresholdHit && next >= -CLOSE_THRESHOLD) {
      d.thresholdHit = false;
    }
  }

  function handlePointerUp() {
    const d = drag.current;
    drag.current = null;
    setIsDragging(false);
    if (!d || !d.confirmed) return;

    if (offsetX < -CLOSE_THRESHOLD) {
      triggerClose();
    } else if (offsetX < -(SNAP_TO / 2)) {
      setOffsetX(-SNAP_TO);
    } else {
      setOffsetX(0);
    }
  }

  const closing = phase !== "idle";

  // La pill colle à la bordure droite de la note : son bord gauche = bord droit de la note
  const buttonW: number | string = closing
    ? "calc(100% + 4px)"
    : isDragging
      ? Math.max(0, -offsetX - PAD_R - GAP)
      : offsetX <= -(SNAP_TO / 2)
        ? BTN // cercle parfait au snap
        : 0;

  const buttonTransition = closing
    ? "width 240ms cubic-bezier(0.4, 0, 0.2, 1), right 240ms"
    : isDragging
      ? "none"
      : "width 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94)";

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={
        phase === "collapse"
          ? {
              maxHeight: 0,
              transition: "max-height 200ms ease-in",
              overflow: "hidden",
            }
          : { maxHeight: 120 }
      }
    >
      {/* Bouton : grandit de 0 → cercle pendant le swipe, puis s'étire en pill */}
      <button
        type="button"
        onClick={triggerClose}
        className="absolute top-1/2 bg-red-500 rounded-full flex items-center justify-center active:bg-red-600"
        style={{
          height: BTN,
          width: buttonW,
          right: closing ? -2 : PAD_R,
          transform: "translateY(-50%)",
          transition: buttonTransition,
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <IconTrash className="size-4.5 text-white shrink-0" />
      </button>

      {/* Rangée glissante */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: closing ? "translateX(-110%)" : `translateX(${offsetX}px)`,
          transition: closing
            ? "transform 240ms ease-in"
            : isDragging
              ? "none"
              : "transform 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          touchAction: "pan-y",
          userSelect: "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
