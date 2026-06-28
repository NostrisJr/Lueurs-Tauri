import type { EditorState } from "@milkdown/kit/prose/state";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";

const customCaretKey = new PluginKey("customCaret");

// Aux frontières d'une mark à boîte horizontale (code inline, didascalie…), les
// deux côtés de la position ne coïncident pas (padding, pseudo-pipes). Le caret
// custom doit tomber là où le glyphe va réellement s'insérer : il portera
// `storedMarks ?? $from.marks()`. S'il partage la marque-frontière avec le
// contenu de gauche → caret collé à gauche (-1), sinon à droite (+1).
// Sans effet sur les marks sans boîte (gras/italique : -1 et +1 coïncident).
function caretSide(state: EditorState): 1 | -1 {
  const { $from } = state.selection;
  const eff = state.storedMarks ?? $from.marks();
  const before = $from.nodeBefore?.marks ?? [];
  const after = $from.nodeAfter?.marks ?? [];
  const types = new Set([...before, ...after].map((m) => m.type));
  for (const type of types) {
    const inBefore = !!type.isInSet(before);
    if (inBefore === !!type.isInSet(after)) continue; // pas une frontière
    return !!type.isInSet(eff) === inBefore ? -1 : 1;
  }
  return 1;
}

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
          const side = caretSide(view.state);
          const coords = view.coordsAtPos(from, side);
          const domRef = view.domAtPos(from, side);
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

        // Auto-focus au montage pour rendre le caret visible dès l'ouverture (surtout sur notes vides).
        requestAnimationFrame(() => {
          if (!editorView.destroy) {
            editorView.focus();
            reposition(editorView, true);
          }
        });

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
