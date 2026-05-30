import type { EditorState } from "@milkdown/kit/prose/state";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { MarkType } from "@milkdown/kit/prose/model";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { createLogger } from "../../lib/logger";
import { HIGHLIGHT_COLORS, getHighlightSolid } from "./colors";

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

// ── Singleton DOM ──────────────────────────────────────────────────────────

let pickerEl: HTMLDivElement | null = null;
let dotEl: HTMLButtonElement | null = null;
let dropdownEl: HTMLDivElement | null = null;

let currentView: EditorView | null = null;
let currentRange: { from: number; to: number } | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let dropdownOpen = false;

function ensurePicker() {
  if (pickerEl) return;

  pickerEl = document.createElement("div");
  pickerEl.id = "lueurs-hl-picker";
  pickerEl.style.cssText = `
    position:fixed;display:none;z-index:9999;
    align-items:center;gap:6px;
  `;

  // Taille adaptée selon le type d'appareil (touch = mobile)
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
  const dotSize = isTouchDevice ? 16 : 12;

  // Cercle de couleur cliquable
  const dot = document.createElement("button");
  dot.type = "button";
  dot.style.cssText = `
    width:${dotSize}px;height:${dotSize}px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.8);
    box-shadow:0 1px 4px rgba(0,0,0,0.25);cursor:pointer;
    padding:0;flex-shrink:0;outline:none;transition:transform 0.1s;
    touch-action:none;
  `;
  dot.addEventListener("mouseenter", () => {
    cancelHide();
    dot.style.transform = "scale(1.2)";
  });
  dot.addEventListener("mouseleave", () => {
    dot.style.transform = "";
    if (!dropdownOpen) scheduleHide();
  });
  dot.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleDropdown();
  });
  dotEl = dot;

  // Dropdown de couleurs
  const dropdown = document.createElement("div");
  dropdown.style.cssText = `
    position:absolute;left:0;top:18px;
    background:white;border:1px solid rgba(0,0,0,0.08);
    border-radius:10px;padding:6px;
    box-shadow:0 4px 20px rgba(0,0,0,0.12);
    display:none;flex-wrap:wrap;gap:5px;width:120px;
  `;
  dropdown.addEventListener("mouseenter", cancelHide);
  dropdown.addEventListener("mouseleave", () => scheduleHide());

  // Swatches
  for (const c of HIGHLIGHT_COLORS) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.title = c.label;
    swatch.dataset.colorId = c.id;
    swatch.style.cssText = `
      width:20px;height:20px;border-radius:50%;border:2px solid transparent;
      background:${c.solid};cursor:pointer;padding:0;outline:none;
      transition:transform 0.1s,border-color 0.1s;
    `;
    swatch.addEventListener("mouseenter", () => {
      swatch.style.transform = "scale(1.15)";
    });
    swatch.addEventListener("mouseleave", () => {
      swatch.style.transform = "";
    });
    swatch.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyColor(c.id);
    });
    dropdown.appendChild(swatch);
  }

  // Bouton supprimer le surlignage
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.title = "Supprimer le surlignage";
  removeBtn.style.cssText = `
    width:20px;height:20px;border-radius:50%;border:1.5px solid #e5e7eb;
    background:white;cursor:pointer;padding:0;outline:none;
    display:flex;align-items:center;justify-content:center;
    font-size:11px;color:#9ca3af;
    transition:transform 0.1s,background 0.1s;
  `;
  removeBtn.textContent = "✕";
  removeBtn.addEventListener("mouseenter", () => {
    removeBtn.style.background = "#fee2e2";
    removeBtn.style.color = "#ef4444";
  });
  removeBtn.addEventListener("mouseleave", () => {
    removeBtn.style.background = "white";
    removeBtn.style.color = "#9ca3af";
  });
  removeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeHighlight();
  });
  dropdown.appendChild(removeBtn);
  dropdownEl = dropdown;

  pickerEl.appendChild(dot);
  pickerEl.appendChild(dropdown);

  document.body.appendChild(pickerEl);

  // Clic en dehors → fermer
  document.addEventListener("mousedown", (e) => {
    if (pickerEl && !pickerEl.contains(e.target as Node)) {
      hidePicker();
    }
  });
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
  if (pickerEl) pickerEl.style.display = "none";
  dropdownOpen = false;
  if (dropdownEl) dropdownEl.style.display = "none";
  currentRange = null;
}

function showPickerAt(
  markEl: HTMLElement,
  view: EditorView,
  range: { from: number; to: number }
) {
  ensurePicker();
  cancelHide();

  currentView = view;
  currentRange = range;

  const color = markEl.getAttribute("data-hl-color") ?? "yellow";

  if (dotEl) dotEl.style.background = getHighlightSolid(color);

  if (dropdownEl) {
    for (const sw of dropdownEl.querySelectorAll<HTMLButtonElement>(
      "[data-color-id]"
    )) {
      sw.style.borderColor =
        sw.dataset.colorId === color ? "#374151" : "transparent";
    }
  }

  if (pickerEl) {
    const rect = markEl.getBoundingClientRect();
    const dotSize = 20;
    const gap = 3;
    pickerEl.style.left = `${rect.left - (dotSize / 2) - gap}px`;
    pickerEl.style.top = `${rect.top + rect.height / 2 - dotSize / 2}px`;
    pickerEl.style.display = "flex";
  }
}

function toggleDropdown() {
  if (!dropdownEl) return;
  dropdownOpen = !dropdownOpen;
  dropdownEl.style.display = dropdownOpen ? "flex" : "none";
  if (!dropdownOpen) scheduleHide();
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

  if (dotEl) dotEl.style.background = getHighlightSolid(colorId);
  if (dropdownEl) {
    for (const sw of dropdownEl.querySelectorAll<HTMLButtonElement>(
      "[data-color-id]"
    )) {
      sw.style.borderColor =
        sw.dataset.colorId === colorId ? "#374151" : "transparent";
    }
    dropdownOpen = false;
    dropdownEl.style.display = "none";
  }
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
            if (to && pickerEl?.contains(to)) return false;
            scheduleHide();
            return false;
          },
        },
      },
    })
);
