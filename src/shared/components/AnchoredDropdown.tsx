/**
 * AnchoredDropdown — dropdown positionné en fixed sous son ancre (desktop),
 * ou BottomSheet clavier-aware (mobile).
 */
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BottomSheet } from "../../mobile/components/BottomSheet/BottomSheet";
import { isMobile } from "../lib/platform";

interface AnchoredDropdownProps {
  anchorRef: { current: HTMLElement | null };
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function AnchoredDropdown({
  anchorRef,
  onClose,
  children,
  className = "",
}: AnchoredDropdownProps) {
  if (isMobile) {
    return <BottomSheet onClose={onClose}>{children}</BottomSheet>;
  }
  return (
    <DesktopDropdown
      anchorRef={anchorRef}
      onClose={onClose}
      className={className}
    >
      {children}
    </DesktopDropdown>
  );
}

// ── Dropdown desktop ───────────────────────────────────────────────────────

function DesktopDropdown({
  anchorRef,
  onClose,
  children,
  className,
}: AnchoredDropdownProps) {
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const DROPDOWN_HEIGHT = 240;

  // Recalculée au scroll (capture : un ancêtre scrollable ne bubble pas son
  // scroll) et au resize — sinon la popover, en position fixed, reste figée
  // à l'écran pendant que son ancre défile sous elle.
  useEffect(() => {
    function updatePos() {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const up = spaceBelow < DROPDOWN_HEIGHT && rect.top > DROPDOWN_HEIGHT;
      setOpenUpward(up);
      setPos({
        top: up ? rect.top : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [anchorRef]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      )
        onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, anchorRef]);

  if (!pos) return null;

  // Portail vers document.body : sous WebKit (webview Tauri), un ancêtre
  // `overflow: hidden` (ex: le panneau de réglages animé en hauteur du
  // frontmatter) peut rogner un descendant `position: fixed` alors que ça ne
  // devrait pas arriver sans containing block (transform/filter) — bug connu
  // de ce moteur. Rendre la popover directement sous <body> lui évite tout
  // ancêtre qui pourrait la clipper ou désynchroniser sa zone cliquable.
  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: openUpward ? undefined : pos.top,
        bottom: openUpward ? window.innerHeight - pos.top : undefined,
        left: pos.left,
        minWidth: Math.max(pos.width, 220),
        // Sous le NoteHeader sticky (z-20) : quand l'ancre défile sous le
        // header, la popover doit disparaître avec elle, pas rester flottante
        // par-dessus (comme le reste du contenu scrollé).
        zIndex: 15,
      }}
      className={`bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden whitespace-normal ${className}`}
    >
      {children}
    </div>,
    document.body
  );
}
