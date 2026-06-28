/**
 * editorScroll.ts
 *
 * Scrolle une position de l'éditeur dans la vue en réutilisant les marges du
 * scroll automatique à l'édition (useCaretScroll) : marge haute = inset header +
 * CARET_TOP_PADDING (sinon la cible reste sous le header fixe), marge basse
 * symétrique. Scroll instantané : `coordsAtPos` est lisible juste après.
 */

import type { EditorView } from "@milkdown/kit/prose/view";
import {
  CARET_BOTTOM_PADDING,
  CARET_TOP_PADDING,
  DESKTOP_HEADER_HEIGHT,
  MOBILE_HEADER_HEIGHT,
  MOBILE_TOOLBAR_OFFSET,
} from "../../../hooks/useCaretScroll";
import { isDesktop } from "../../../lib/platform";

function scrollableAncestor(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el;
  while (node) {
    const style = getComputedStyle(node);
    if (
      /(auto|scroll)/.test(style.overflowY) &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** Scrolle `pos` dans la vue avec les mêmes marges que la frappe (instantané). */
export function scrollPosIntoViewLikeEditing(view: EditorView, pos: number) {
  const coords = view.coordsAtPos(pos);
  const container = scrollableAncestor(view.dom as HTMLElement);
  if (!container) {
    try {
      const domPos = view.domAtPos(pos);
      const el =
        domPos.node instanceof Element
          ? domPos.node
          : domPos.node.parentElement;
      el?.scrollIntoView({ block: "center" });
    } catch {
      // pos hors limites → ignore
    }
    return;
  }

  const cRect = container.getBoundingClientRect();
  const topInset = isDesktop ? DESKTOP_HEADER_HEIGHT : MOBILE_HEADER_HEIGHT;
  const bottomInset = isDesktop ? 0 : MOBILE_TOOLBAR_OFFSET;
  const visibleTop = cRect.top + topInset + CARET_TOP_PADDING;
  const visibleBottom = cRect.bottom - bottomInset - CARET_BOTTOM_PADDING;

  let delta = 0;
  if (coords.bottom > visibleBottom) delta = coords.bottom - visibleBottom;
  else if (coords.top < visibleTop) delta = coords.top - visibleTop;
  if (delta !== 0) container.scrollTop += delta;
}
