import type { EditorState } from "@milkdown/kit/prose/state";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { createLogger } from "../../lib/logger";
import { isMobile } from "../../lib/platform";
import { HighlightColorPicker } from "./HighlightColorPicker";
import {
  type PickerRange,
  highlightRangeAt,
  mapPickerRange,
} from "./picker-range";

const log = createLogger("highlight-color-picker");

// La pastille est un widget de décoration inséré dans le flux de l'éditeur :
// elle suit le texte au scroll, à la remontée du clavier et au rescroll vers
// le caret, ce qu'une position `fixed` calculée une fois ne pouvait pas faire.

const pickerKey = new PluginKey<PickerRange | null>("highlightColorPicker");

type PickerMeta = { show: PickerRange } | { hide: true };

let hideTimer: ReturnType<typeof setTimeout> | null = null;

function cancelHide() {
  if (hideTimer !== null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function hidePicker(view: EditorView) {
  cancelHide();
  if (!pickerKey.getState(view.state)) return;
  view.dispatch(view.state.tr.setMeta(pickerKey, { hide: true }));
}

function scheduleHide(view: EditorView) {
  cancelHide();
  hideTimer = setTimeout(() => hidePicker(view), 250);
}

// ── Actions sur le nœud ───────────────────────────────────────────────────

function applyColor(view: EditorView, colorId: string) {
  const range = pickerKey.getState(view.state);
  const hlType = view.state.schema.marks.highlight_inline;
  if (!range || !hlType) return;
  const { from, to } = range;

  view.focus();
  view.dispatch(
    view.state.tr
      .removeMark(from, to, hlType)
      .addMark(from, to, hlType.create({ color: colorId }))
  );
  log.info("couleur surlignage modifiée", { colorId, from, to });
  scheduleHide(view);
}

function removeHighlight(view: EditorView) {
  const range = pickerKey.getState(view.state);
  const hlType = view.state.schema.marks.highlight_inline;
  if (!range || !hlType) return;
  const { from, to } = range;

  view.focus();
  // Retire la marque sur la plage (texte et marques imbriquées conservées)
  view.dispatch(view.state.tr.removeMark(from, to, hlType));
  log.info("surlignage supprimé", { from, to });
  hidePicker(view);
}

// ── Widget ─────────────────────────────────────────────────────────────────

function createPickerWidget(view: EditorView, color: string) {
  // Ancre de taille nulle, calée en haut de la ligne : la pastille s'y
  // positionne en absolu, donc sans calcul de coordonnées à maintenir.
  const anchor = document.createElement("span");
  anchor.className = "lueurs-hl-picker-anchor";
  anchor.contentEditable = "false";
  anchor.style.cssText =
    "position:relative;display:inline-block;width:0;height:0;vertical-align:top;";

  const root = createRoot(anchor);
  root.render(
    createElement(HighlightColorPicker, {
      color,
      size: isMobile ? 16 : 12,
      onPick: (id) => applyColor(view, id),
      onRemove: () => removeHighlight(view),
      onCancelHide: cancelHide,
      onScheduleHide: () => scheduleHide(view),
      onClickOutside: () => hidePicker(view),
    })
  );
  return { anchor, root };
}

function buildDecorations(state: EditorState, view: EditorView | null) {
  const range = pickerKey.getState(state);
  const hlType = state.schema.marks.highlight_inline;
  if (!range || !hlType || !view) return DecorationSet.empty;

  const found = highlightRangeAt(state, range.from, hlType);
  if (!found) return DecorationSet.empty;

  return DecorationSet.create(state.doc, [
    Decoration.widget(
      found.from,
      () => {
        const { anchor, root } = createPickerWidget(view, found.color);
        // Démontage différé : destroy peut tomber pendant un rendu React
        (anchor as HTMLElement & { _root?: typeof root })._root = root;
        return anchor;
      },
      {
        // La couleur dans la clé recrée le widget quand elle change
        key: `hl-picker-${found.color}`,
        side: -1,
        stopEvent: () => true,
        ignoreSelection: true,
        destroy: (node) => {
          const root = (node as HTMLElement & { _root?: { unmount(): void } })
            ._root;
          if (root) queueMicrotask(() => root.unmount());
        },
      }
    ),
  ]);
}

// ── Plugin ProseMirror ─────────────────────────────────────────────────────

export const highlightColorPickerPlugin = $prose(() => {
  let editorView: EditorView | null = null;

  return new Plugin<PickerRange | null>({
    key: pickerKey,
    view(view) {
      editorView = view;
      return {
        destroy() {
          cancelHide();
          editorView = null;
        },
      };
    },
    state: {
      init: () => null,
      apply(tr, prev) {
        const meta = tr.getMeta(pickerKey) as PickerMeta | undefined;
        if (meta) return "hide" in meta ? null : meta.show;
        if (!tr.docChanged) return prev;
        return mapPickerRange(prev, (pos, assoc) => tr.mapping.map(pos, assoc));
      },
    },
    props: {
      decorations: (state) => buildDecorations(state, editorView),
      handleDOMEvents: {
        mouseover(view, event) {
          const target = (event.target as HTMLElement).closest<HTMLElement>(
            "mark.lueurs-hl[data-hl-color]"
          );
          if (!target) return false;

          try {
            const hlType = view.state.schema.marks.highlight_inline;
            if (!hlType) return false;
            const pos = view.posAtDOM(target, 0);
            if (pos < 0) return false;
            const range = highlightRangeAt(view.state, pos, hlType);
            if (!range) return false;
            cancelHide();
            const current = pickerKey.getState(view.state);
            if (current?.from === range.from && current.to === range.to)
              return false;
            view.dispatch(
              view.state.tr.setMeta(pickerKey, {
                show: { from: range.from, to: range.to },
              })
            );
          } catch {
            // DOM pas encore en sync, ignoré
          }
          return false;
        },
        mouseleave(view) {
          // Le widget est dans le DOM de l'éditeur : l'entrée de la souris sur
          // la pastille annule ce délai via onCancelHide.
          scheduleHide(view);
          return false;
        },
      },
    },
  });
});
