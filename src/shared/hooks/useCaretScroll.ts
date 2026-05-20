import { type RefObject, useCallback, useEffect, useRef } from "react";

// --- Constantes ajustables pour le debug ---
export const CARET_BOTTOM_PADDING = 48; // marge sous le caret après scroll vers le bas (px)
export const CARET_TOP_PADDING = 24; // marge au-dessus du caret après scroll vers le haut (px)
export const SCROLL_DURATION_MS = 400; // durée de l'animation smooth (ms)

export const MOBILE_TOOLBAR_OFFSET = 60; // MobileFormattingBar : h-13 (52px) + gap bottom (8px)
export const MOBILE_HEADER_HEIGHT = 150;

export const DESKTOP_HEADER_HEIGHT = 100;

interface CaretScrollOptions {
  bottomInset?: number; // pixels obscurcis en bas (clavier + barre d'outils mobile)
  topInset?: number; // pixels obscurcis en haut (header fixe dont le container déborde)
}

/**
 * Garde le caret visible dans le scroll container lors de la frappe.
 * topInset : nécessaire quand le container commence plus haut que le contenu visible
 *            (ex. mobile : container commence à y=0 mais pt-23 masque les 92px du header).
 * Retourne scrollToCaretIfNeeded(instant?) pour un appel impératif.
 */
export function useCaretScroll(
  scrollContainerRef: RefObject<HTMLDivElement | null>,
  { bottomInset = 0, topInset = 0 }: CaretScrollOptions = {}
) {
  const rafIdRef = useRef<number | null>(null);

  const animateTo = useCallback((container: HTMLElement, target: number) => {
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    const from = container.scrollTop;
    const delta = target - from;
    if (Math.abs(delta) < 1) return;
    const t0 = performance.now();

    function step(now: number) {
      const t = Math.min((now - t0) / SCROLL_DURATION_MS, 1);
      container.scrollTop = from + delta * (1 - (1 - t) ** 3); // ease-out cubic
      rafIdRef.current = t < 1 ? requestAnimationFrame(step) : null;
    }

    rafIdRef.current = requestAnimationFrame(step);
  }, []);

  const scrollToCaretIfNeeded = useCallback(
    (instant = false) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        // getBoundingClientRect() retourne height=0 sur une ligne vide (ex. après Enter)
        const range = sel.getRangeAt(0);
        let rect = range.getBoundingClientRect();
        if (!rect.height) {
          const clientRects = range.getClientRects();
          if (clientRects.length > 0) {
            rect = clientRects[0];
          } else {
            // Dernier recours : rect du nœud contenant (ex. <p> vide avec <br>)
            const node = range.startContainer;
            const el = (
              node.nodeType === Node.TEXT_NODE ? node.parentElement : node
            ) as Element | null;
            if (el instanceof Element) rect = el.getBoundingClientRect();
          }
        }
        if (!rect.height && !rect.width) return;

        const containerRect = container.getBoundingClientRect();
        const visibleBottom =
          containerRect.bottom - bottomInset - CARET_BOTTOM_PADDING;
        const visibleTop = containerRect.top + topInset + CARET_TOP_PADDING;

        let delta = 0;
        if (rect.bottom > visibleBottom) delta = rect.bottom - visibleBottom;
        else if (rect.top < visibleTop) delta = rect.top - visibleTop;
        if (delta === 0) return;

        if (instant) {
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
          container.scrollTop += delta;
        } else {
          animateTo(container, container.scrollTop + delta);
        }
      });
    },
    [scrollContainerRef, bottomInset, topInset, animateTo]
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onInput = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement && target.type === "checkbox")
        return;
      scrollToCaretIfNeeded(false);
    };
    container.addEventListener("input", onInput, { capture: true });
    return () => {
      container.removeEventListener("input", onInput, { capture: true });
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, [scrollContainerRef, scrollToCaretIfNeeded]);

  return { scrollToCaretIfNeeded };
}
