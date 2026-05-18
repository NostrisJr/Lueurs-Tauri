/**
 * BottomSheet — modal slide-up clavier-aware.
 *
 * Positionnement :
 *   - Sans clavier : height 40vh, translateY 0  → occupe le bas de l'écran
 *   - Avec clavier  : height 75vh, translateY -keyboardHeight → bord bas
 *     coïncide avec le haut du clavier, contenu visible au-dessus
 *
 * Monté dans un Portal (document.body) pour échapper aux overflow:hidden parents.
 * Swipe vers le bas pour fermer.
 */
import { type ReactNode, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Squircle } from "react-ios-corners";
import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";

interface Props {
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function BottomSheet({ onClose, children, title }: Props) {
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();
  const startYRef = useRef(0);
  const [swipe, setSwipe] = useState(0);

  const sheetHeight = isKeyboardOpen ? "80vh" : "45vh";

  const sheet = (
    // biome-ignore lint/a11y/useKeyWithClickEvents: overlay tactile
    <div className="fixed inset-0 z-50 bg-gray-600/30" onClick={onClose}>
      <Squircle
        radius={50}
        className="fixed left-0 right-0 -bottom-10 bg-white py-10 px-4 flex flex-col overflow-hidden"
        style={{
          height: sheetHeight,
          transform: `translateY(${-keyboardHeight + swipe}px)`,
          transition: swipe === 0 ? "height 0.25s ease-out" : undefined,
          filter: "drop-shadow(0px -4px 20px rgba(0,0,0,0.12))",
        }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        onTouchStart={(e: React.TouchEvent) => {
          startYRef.current = e.touches[0].clientY;
        }}
        onTouchMove={(e: React.TouchEvent) => {
          const dy = e.touches[0].clientY - startYRef.current;
          if (dy > 0) setSwipe(dy);
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
            paddingBottom: `calc(${keyboardHeight}px + env(safe-area-inset-bottom) + 16px)`,
          }}
        >
          {children}
        </div>
      </Squircle>
    </div>
  );

  return createPortal(sheet, document.body);
}
