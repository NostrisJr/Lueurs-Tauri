/**
 * useMobileLinkLongPress.ts
 *
 * Sur mobile, appui long sur un lien (<a>) → ouvre le menu d'actions
 * (mobileLinkMenuAtom). Le tap simple reste géré par le plugin note-link (navigation).
 * Supprime le clic de navigation qui suivrait l'appui long.
 */

import { editorViewCtx } from "@milkdown/kit/core";
import { useSetAtom } from "jotai";
import { useEffect } from "react";
import type { RefObject } from "react";
import { mobileLinkMenuAtom } from "../../../lib/atoms";
import { isMobile } from "../../../lib/platform";
import { linkRangeAt } from "../../../plugins/wikilink/wikilinkPlugin";
import type { Editor } from "../MarkdownEditor";

const MOVE_THRESHOLD = 8;
const LONG_PRESS_MS = 450;

export function useMobileLinkLongPress(
  editorRef: RefObject<Editor | null>,
  wrapperRef: RefObject<HTMLDivElement | null>
) {
  const setLinkMenu = useSetAtom(mobileLinkMenuAtom);

  useEffect(() => {
    if (!isMobile) return;
    const el = wrapperRef.current;
    if (!el) return;

    let suppressClick = false;

    const onTouchStart = (e: TouchEvent) => {
      const linkEl = (e.target as HTMLElement).closest("a");
      if (!linkEl) return;

      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      let moved = false;

      const timer = window.setTimeout(() => {
        if (moved) return;
        const editor = editorRef.current;
        if (!editor) return;
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const result = view.posAtCoords({ left: startX, top: startY });
          if (!result) return;
          const info = linkRangeAt(view.state, result.pos);
          if (!info) return;
          suppressClick = true;
          (document.activeElement as HTMLElement)?.blur();
          setLinkMenu({
            range: { from: info.from, to: info.to },
            href: info.href,
            text: info.text,
          });
        });
      }, LONG_PRESS_MS);

      const onMove = (ev: TouchEvent) => {
        const t = ev.touches[0];
        if (
          Math.abs(t.clientX - startX) > MOVE_THRESHOLD ||
          Math.abs(t.clientY - startY) > MOVE_THRESHOLD
        ) {
          moved = true;
          window.clearTimeout(timer);
        }
      };

      const cleanup = () => {
        window.clearTimeout(timer);
        el.removeEventListener("touchmove", onMove);
        el.removeEventListener("touchend", cleanup);
        el.removeEventListener("touchcancel", cleanup);
      };

      el.addEventListener("touchmove", onMove, { passive: true });
      el.addEventListener("touchend", cleanup, { once: true });
      el.addEventListener("touchcancel", cleanup, { once: true });
    };

    // Supprime le clic de navigation déclenché par la NodeView après un appui long
    const onClickCapture = (e: MouseEvent) => {
      if (suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        suppressClick = false;
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [editorRef, wrapperRef, setLinkMenu]);
}
