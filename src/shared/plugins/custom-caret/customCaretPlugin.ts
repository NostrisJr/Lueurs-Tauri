import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";

const customCaretKey = new PluginKey("customCaret");

export const customCaretPlugin = $prose(
  () =>
    new Plugin({
      key: customCaretKey,
      view(editorView) {
        const caret = document.createElement("div");
        caret.className = "custom-caret";
        document.body.appendChild(caret);

        function reposition(view: typeof editorView, noTransition: boolean) {
          const { selection } = view.state;

          if (!selection.empty || !view.hasFocus()) {
            caret.style.display = "none";
            return;
          }

          const { from } = selection;
          const coords = view.coordsAtPos(from);
          const domRef = view.domAtPos(from);
          const node = domRef.node;
          const el =
            node.nodeType === Node.TEXT_NODE
              ? (node.parentElement as Element)
              : (node as Element);
          const fontSize = el
            ? Number.parseFloat(getComputedStyle(el).fontSize)
            : 16;
          const lineH = coords.bottom - coords.top;

          const prevLeft = Number.parseFloat(caret.style.left) || 0;
          const prevTop = Number.parseFloat(caret.style.top) || 0;
          const dist =
            Math.abs(coords.left - prevLeft) + Math.abs(coords.top - prevTop);
          if (noTransition || dist > 120) caret.classList.add("no-transition");
          else caret.classList.remove("no-transition");

          caret.style.left = `${coords.left}px`;
          caret.style.top = `${coords.top + (lineH - fontSize) / 2}px`;
          caret.style.height = `${fontSize}px`;
          caret.style.display = "block";
        }

        function update(view: typeof editorView, prevState?: unknown) {
          const fromScroll = typeof prevState === "boolean" ? prevState : false;
          reposition(view, fromScroll);
          if (!fromScroll) {
            caret.style.animation = "none";
            requestAnimationFrame(() => {
              caret.style.animation = "";
            });
          }
        }

        // Les marqueurs ## animent max-width sur ::before (0.16s). WebKit ne met pas
        // à jour getBoundingClientRect pendant cette transition → snap après transitionend.
        // L'événement bubble depuis .heading-content jusqu'à editorView.dom.
        function onTransitionEnd(e: TransitionEvent) {
          if (e.propertyName === "max-width") {
            reposition(editorView, true);
          }
        }
        editorView.dom.addEventListener("transitionend", onTransitionEnd);

        function onScroll() {
          update(editorView, true);
        }
        document.addEventListener("scroll", onScroll, true);

        return {
          update,
          destroy() {
            editorView.dom.removeEventListener(
              "transitionend",
              onTransitionEnd
            );
            document.removeEventListener("scroll", onScroll, true);
            caret.remove();
          },
        };
      },
    })
);
