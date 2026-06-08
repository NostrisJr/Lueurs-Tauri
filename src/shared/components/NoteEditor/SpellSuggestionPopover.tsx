import { useEffect, useRef } from "react";
import type { SpellPopoverPayload } from "../../plugins/spellcheck/spellcheckState";

interface Props {
  payload: SpellPopoverPayload | null;
  /** Applique un remplacement sur la plage [from, to) de la faute. */
  onApply: (from: number, to: number, replacement: string) => void;
  /** Ajoute le mot au dictionnaire ignoré du vault. */
  onIgnore: (word: string) => void;
  onClose: () => void;
}

/**
 * Popover flottant affiché au clic sur une faute soulignée. Liste le message du
 * correcteur et les remplacements proposés. Positionné en coordonnées écran via
 * le `rect` fourni par le plugin ProseMirror.
 */
export function SpellSuggestionPopover({
  payload,
  onApply,
  onIgnore,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!payload) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Positionné en coords écran figées : au scroll, le mot bouge mais pas le
    // popover → on ferme. Capture pour attraper le scroll de n'importe quel conteneur.
    const onScroll = () => onClose();
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [payload, onClose]);

  if (!payload) return null;

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-44 max-w-72 rounded-lg border border-gray-200 bg-white shadow-lg py-1 text-sm"
      style={{ left: payload.rect.left, top: payload.rect.bottom + 4 }}
    >
      <p className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-100">
        {payload.message}
      </p>
      {payload.replacements.length === 0 ? (
        <p className="px-3 py-2 text-gray-400">Aucune suggestion</p>
      ) : (
        payload.replacements.map((rep) => (
          <button
            key={rep}
            type="button"
            onClick={() => onApply(payload.from, payload.to, rep)}
            className="block w-full text-left px-3 py-1.5 text-gray-800 hover:bg-gray-100 cursor-default"
          >
            {rep}
          </button>
        ))
      )}
      {payload.category === "spelling" && (
        <button
          type="button"
          onClick={() => onIgnore(payload.word)}
          className="block w-full text-left px-3 py-1.5 text-gray-500 hover:bg-gray-100 cursor-default border-t border-gray-100"
        >
          Ignorer ce mot
        </button>
      )}
    </div>
  );
}
