/**
 * BottomSheet — modal slide-up clavier-aware.
 *
 * Positionnement :
 *   - Sans clavier : bottom=0, height=45vh → le bas du sheet est au ras de l'écran
 *   - Avec clavier  : bottom=keyboardHeight, height ≤ zone visible − marge
 *     → le sheet se pose juste au-dessus du clavier
 *
 * Les coins bas sont droits : le clavier (ou le bas de l'écran) forme visuellement
 * la base du sheet, les coins bas ne sont jamais visibles.
 * Coins haut en squircle (superellipse iOS via notre composant Squircle).
 *
 * Monté dans un Portal (document.body) pour échapper aux overflow:hidden parents.
 * Swipe vers le bas pour fermer.
 */
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Squircle } from "../../../shared/components/Squircle";
import { useKeyboard } from "../../hooks/useKeyboard";

// Durée de l'animation de sortie (doit matcher la transition transform ci-dessous)
const EXIT_DURATION_MS = 300;

interface Props {
  onClose: () => void;
  children: ReactNode;
  title?: string;
  /** Fraction de la hauteur du viewport utilisée (sans clavier). Défaut : 0.45 */
  heightFraction?: number;
}

export function BottomSheet({
  onClose,
  children,
  title,
  heightFraction = 0.45,
}: Props) {
  const { height: keyboardHeight, isOpen: isKeyboardOpen } = useKeyboard();
  const startYRef = useRef(0);
  const swipeAllowedRef = useRef(true);
  const [swipe, setSwipe] = useState(0);

  // N'active le scroll (et le momentum iOS) que si le contenu dépasse
  // réellement la hauteur disponible, sinon iOS autorise un léger rubber-band
  // même sans overflow.
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  // Monté fermé (hors écran) puis ouvert une frame plus tard, pour que la transition
  // CSS ait deux états distincts à interpoler (sinon le sheet apparaît déjà en place).
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== undefined) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const container = contentRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;
    const check = () =>
      setCanScroll(inner.scrollHeight > container.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(container);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  // Fermeture "gestuelle" (overlay/swipe) : joue l'animation de sortie avant
  // de démonter réellement via onClose.
  function requestClose() {
    if (closing) return;
    setClosing(true);
    closeTimeoutRef.current = window.setTimeout(onClose, EXIT_DURATION_MS);
  }

  // Hauteur disponible au-dessus du clavier (ou de l'écran entier)
  const visibleH = window.innerHeight - keyboardHeight;
  const sheetH = isKeyboardOpen
    ? Math.min(Math.round(visibleH * 0.85), visibleH - 40)
    : Math.round(window.innerHeight * heightFraction);
  const translateY = closing || !entered ? "100%" : `${swipe}px`;

  const sheet = (
    // stopPropagation : évite que le tap sur l'overlay remonte dans l'arbre React
    // vers un BottomSheet parent (ex: NoteSelector au-dessus du BottomSheet formule).
    // biome-ignore lint/a11y/useKeyWithClickEvents: overlay tactile
    <div
      className="fixed inset-0 z-50 bg-gray-600/30"
      onClick={(e) => {
        e.stopPropagation();
        requestClose();
      }}
    >
      <Squircle
        topRadius={28}
        className="fixed left-0 right-0 bg-white flex flex-col"
        style={{
          bottom: keyboardHeight,
          height: sheetH,
          transform: `translateY(${translateY})`,
          transition:
            swipe === 0
              ? "bottom 0.3s ease-out, height 0.3s ease-out, transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)"
              : undefined,
          filter: "drop-shadow(0px -4px 20px rgba(0,0,0,0.12))",
        }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        onTouchStart={(e: React.TouchEvent) => {
          startYRef.current = e.touches[0].clientY;
          // Le swipe-to-close ne doit s'engager que si le contenu est déjà
          // scrollé en haut, sinon il vole le geste de scroll interne (ex:
          // remonter dans la liste d'emojis) et referme la sheet par erreur.
          swipeAllowedRef.current = (contentRef.current?.scrollTop ?? 0) <= 0;
        }}
        onTouchMove={(e: React.TouchEvent) => {
          if (!swipeAllowedRef.current) return;
          const dy = e.touches[0].clientY - startYRef.current;
          if (dy > 0) {
            setSwipe(dy);
            // Seuil 10px avant preventDefault : en dessous, iOS interprète comme
            // un tap et synthétise un click ; preventDefault trop tôt le tue.
            if (dy > 10) e.preventDefault();
          }
        }}
        onTouchEnd={() => {
          if (swipe > 60) {
            setSwipe(0);
            requestClose();
          } else {
            setSwipe(0);
          }
        }}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-2 shrink-0" />
        {title && (
          <p className="px-4 pb-2 text-sm text-gray-400 uppercase tracking-wide shrink-0">
            {title}
          </p>
        )}
        <div
          ref={contentRef}
          className="flex-1"
          data-scrollable
          style={{
            overflowY: canScroll ? "auto" : "hidden",
            WebkitOverflowScrolling: canScroll ? "touch" : undefined,
            paddingBottom: isKeyboardOpen
              ? "4px"
              : "calc(env(safe-area-inset-bottom) + 4px)",
          }}
        >
          <div ref={innerRef}>{children}</div>
        </div>
      </Squircle>
    </div>
  );

  return createPortal(sheet, document.body);
}
