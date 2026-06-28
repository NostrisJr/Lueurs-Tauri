import { editorViewCtx } from "@milkdown/kit/core";
import { useSetAtom } from "jotai";
import { useEffect } from "react";
import type { RefObject } from "react";
import type { Editor } from "../MarkdownEditor";
import { mobileSpellPopupAtom } from "../../../lib/atoms";
import { isMobile } from "../../../lib/platform";
import { getSpellSuggestionAtPos } from "../../../plugins/spellcheck/spellcheckPlugin";

const MOVE_THRESHOLD = 8;

/**
 * Sur mobile, intercepte les taps sur les mots soulignés par le correcteur
 * (.hugo-spell / .hugo-grammar) et ouvre le popup de correction via l'atom.
 * Appelle preventDefault() uniquement sur ces mots pour ne pas perturber
 * la saisie normale.
 */
export function useMobileSpellTap(
  editorRef: RefObject<Editor | null>,
  wrapperRef: RefObject<HTMLDivElement | null>
) {
  const setSpellPopup = useSetAtom(mobileSpellPopupAtom);

  useEffect(() => {
    if (!isMobile) return;
    const el = wrapperRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const spellEl = (e.target as HTMLElement).closest(
        ".hugo-spell, .hugo-grammar"
      );
      if (!spellEl) return;

      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;

      e.preventDefault();

      let moved = false;

      const onMove = (ev: TouchEvent) => {
        const t = ev.touches[0];
        if (
          Math.abs(t.clientX - startX) > MOVE_THRESHOLD ||
          Math.abs(t.clientY - startY) > MOVE_THRESHOLD
        ) {
          moved = true;
        }
      };

      const onEnd = () => {
        cleanup();
        if (moved) return;
        const editor = editorRef.current;
        if (!editor) return;
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const result = view.posAtCoords({ left: startX, top: startY });
          if (!result) return;
          const suggestion = getSpellSuggestionAtPos(view, result.pos);
          if (suggestion) {
            // Rentre le clavier avant d'afficher le menu
            (document.activeElement as HTMLElement)?.blur();
            setSpellPopup(suggestion);
          }
        });
      };

      const cleanup = () => {
        el.removeEventListener("touchmove", onMove);
        el.removeEventListener("touchend", onEnd);
        el.removeEventListener("touchcancel", cleanup);
      };

      el.addEventListener("touchmove", onMove, { passive: true });
      el.addEventListener("touchend", onEnd, { once: true });
      el.addEventListener("touchcancel", cleanup, { once: true });
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    return () => el.removeEventListener("touchstart", onTouchStart);
  }, [editorRef, wrapperRef, setSpellPopup]);
}
