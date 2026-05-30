import type { MarkType } from "@milkdown/kit/prose/model";
import type { EditorState } from "@milkdown/kit/prose/state";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import { createLogger } from "../../lib/logger";
import { HighlightColorPicker, type PickerState } from "./HighlightColorPicker";

const log = createLogger("highlight-color-picker");

// Étend la position survolée à toute la plage contiguë portant la marque
// highlight de même couleur (la marque peut couvrir plusieurs text nodes si
// du gras/italique la traverse).
function highlightRangeAt(
  state: EditorState,
  pos: number,
  hlType: MarkType
): { from: number; to: number; color: string } | null {
  const $pos = state.doc.resolve(pos);
  const after = $pos.nodeAfter;
  const mark = after && hlType.isInSet(after.marks);
  if (!after || !mark) return null;
  const color = mark.attrs.color as string;

  let from = pos;
  let to = pos + after.nodeSize;
  for (;;) {
    const before = state.doc.resolve(from).nodeBefore;
    const m = before && hlType.isInSet(before.marks);
    if (before && m && m.attrs.color === color) from -= before.nodeSize;
    else break;
  }
  for (;;) {
    const next = state.doc.resolve(to).nodeAfter;
    const m = next && hlType.isInSet(next.marks);
    if (next && m && m.attrs.color === color) to += next.nodeSize;
    else break;
  }
  return { from, to, color };
}

// ── Root React singleton ─────────────────────────────────────────────────────

let container: HTMLDivElement | null = null;
let root: Root | null = null;

let currentView: EditorView | null = null;
let currentRange: { from: number; to: number } | null = null;
let pickerState: PickerState | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function render() {
  root?.render(
    createElement(HighlightColorPicker, {
      state: pickerState,
      onPick: applyColor,
      onRemove: removeHighlight,
      onCancelHide: cancelHide,
      onScheduleHide: scheduleHide,
      onClickOutside: hidePicker,
    })
  );
}

function ensureRoot() {
  if (root) return;
  container = document.createElement("div");
  container.id = "lueurs-hl-picker";
  document.body.appendChild(container);
  root = createRoot(container);
}

// ── Affichage / masquage ───────────────────────────────────────────────────

function scheduleHide() {
  cancelHide();
  hideTimer = setTimeout(() => hidePicker(), 250);
}

function cancelHide() {
  if (hideTimer !== null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function hidePicker() {
  cancelHide();
  pickerState = null;
  currentRange = null;
  render();
}

function showPickerAt(
  markEl: HTMLElement,
  view: EditorView,
  range: { from: number; to: number }
) {
  ensureRoot();
  cancelHide();

  currentView = view;
  currentRange = range;

  const color = markEl.getAttribute("data-hl-color") ?? "yellow";

  // Positionné à gauche de la marque, centré verticalement (dotSize logique = 20)
  const rect = markEl.getBoundingClientRect();
  const dotSize = 20;
  const gap = 3;
  pickerState = {
    color,
    position: {
      left: rect.left - dotSize / 2 - gap,
      top: rect.top + rect.height / 2 - dotSize / 2,
    },
  };
  render();
}

// ── Actions sur le nœud ───────────────────────────────────────────────────

function applyColor(colorId: string) {
  if (!currentView || !currentRange) return;
  const view = currentView;
  const { from, to } = currentRange;

  view.focus();
  const hlType = view.state.schema.marks.highlight_inline;
  if (!hlType) return;

  const tr = view.state.tr
    .removeMark(from, to, hlType)
    .addMark(from, to, hlType.create({ color: colorId }));
  view.dispatch(tr);
  log.info("couleur surlignage modifiée", { colorId, from, to });

  // Reflète la nouvelle couleur sur le dot, puis laisse le picker se masquer
  if (pickerState) pickerState = { ...pickerState, color: colorId };
  render();
  scheduleHide();
}

function removeHighlight() {
  if (!currentView || !currentRange) return;
  const view = currentView;
  const { from, to } = currentRange;

  view.focus();
  const hlType = view.state.schema.marks.highlight_inline;
  if (!hlType) return;

  // Retire la marque sur la plage (texte et marques imbriquées conservés)
  const tr = view.state.tr.removeMark(from, to, hlType);
  view.dispatch(tr);
  log.info("surlignage supprimé", { from, to });
  hidePicker();
}

// ── Plugin ProseMirror ─────────────────────────────────────────────────────

const highlightPickerKey = new PluginKey("highlightColorPicker");

export const highlightColorPickerPlugin = $prose(
  () =>
    new Plugin({
      key: highlightPickerKey,
      props: {
        handleDOMEvents: {
          mouseover(view, event) {
            const target = (event.target as HTMLElement).closest<HTMLElement>(
              "mark.lueurs-hl[data-hl-color]"
            );
            if (!target) return false;

            // Trouver la plage ProseMirror de la marque highlight survolée
            try {
              const hlType = view.state.schema.marks.highlight_inline;
              if (!hlType) return false;
              const pos = view.posAtDOM(target, 0);
              if (pos < 0) return false;
              const range = highlightRangeAt(view.state, pos, hlType);
              if (!range) return false;
              showPickerAt(target, view, range);
            } catch {
              // DOM pas encore en sync, ignoré
            }
            return false;
          },
          mouseleave(_view, event) {
            const to = event.relatedTarget as HTMLElement | null;
            // Ne pas masquer si on déplace la souris vers le picker lui-même
            if (to && container?.contains(to)) return false;
            scheduleHide();
            return false;
          },
        },
      },
    })
);
