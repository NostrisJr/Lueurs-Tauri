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
import { type ReactNode, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useKeyboard } from "../../hooks/useKeyboard";
import { Squircle } from "../../../shared/components/Squircle";

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
  const [swipe, setSwipe] = useState(0);

  // Hauteur disponible au-dessus du clavier (ou de l'écran entier)
  const visibleH = window.innerHeight - keyboardHeight;
  const sheetH = isKeyboardOpen
    ? Math.min(Math.round(visibleH * 0.85), visibleH - 40)
    : Math.round(window.innerHeight * heightFraction);

  const sheet = (
    // biome-ignore lint/a11y/useKeyWithClickEvents: overlay tactile
    <div className="fixed inset-0 z-50 bg-gray-600/30" onClick={onClose}>
      <Squircle
        topRadius={28}
        className="fixed left-0 right-0 bg-white flex flex-col"
        style={{
          bottom: keyboardHeight,
          height: sheetH,
          transform: `translateY(${swipe}px)`,
          transition:
            swipe === 0
              ? "bottom 0.3s ease-out, height 0.3s ease-out, transform 0.15s ease-out"
              : undefined,
          filter: "drop-shadow(0px -4px 20px rgba(0,0,0,0.12))",
        }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        onTouchStart={(e: React.TouchEvent) => {
          startYRef.current = e.touches[0].clientY;
        }}
        onTouchMove={(e: React.TouchEvent) => {
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
            onClose();
            setSwipe(0);
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
          className="overflow-y-auto flex-1"
          data-scrollable
          style={{
            WebkitOverflowScrolling: "touch",
            paddingBottom: isKeyboardOpen
              ? "4px"
              : "calc(env(safe-area-inset-bottom) + 4px)",
          }}
        >
          {children}
        </div>
      </Squircle>
    </div>
  );

  return createPortal(sheet, document.body);
}
