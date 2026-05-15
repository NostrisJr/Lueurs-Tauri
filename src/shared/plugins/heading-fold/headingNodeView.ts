import { sfChevronRight } from "@bradleyhodges/sfsymbols";
import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import type {
  EditorView,
  NodeView,
  ViewMutationRecord,
} from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { createLogger } from "../../lib/logger";
import { findSectionEnd, headingFoldPluginKey } from "./headingFoldPlugin";

const log = createLogger("heading-fold-view");

function isHeadingFolded(view: EditorView, pos: number): boolean {
  const pluginState = headingFoldPluginKey.getState(view.state);
  if (!pluginState) return false;
  return (
    pluginState.find(undefined, undefined, (s) => s.foldedByHeading === pos)
      .length > 0
  );
}

/** Crée un SVG SF Symbols chevron.right réutilisable */
function createChevronSVG(): SVGSVGElement {
  /* TODO : pourquoi pas les symboles SF ? */
  const { viewBox, svgPathData } = sfChevronRight;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  for (const { d } of svgPathData) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  return svg;
}

function buildHeadingNodeView(
  initialNode: ProsemirrorNode,
  view: EditorView,
  getPos: () => number | undefined
): NodeView {
  const level = initialNode.attrs.level as number;

  const dom = document.createElement(`h${level}`);

  const btn = document.createElement("span");
  btn.className = "fold-btn";
  btn.contentEditable = "false";
  btn.setAttribute("aria-label", "Replier/déplier la section");
  btn.appendChild(createChevronSVG());

  // Initialisation correcte de l'état fold — couvre les reconstructions mid-session
  const initPos = getPos();
  dom.dataset.folded = String(
    initPos != null ? isHeadingFolded(view, initPos) : false
  );

  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const pos = getPos();
    if (pos == null) return;

    const currentlyFolded = isHeadingFolded(view, pos);
    const fold = !currentlyFolded;

    const tr = view.state.tr.setMeta(headingFoldPluginKey, { pos, fold });

    // Déplacer le curseur hors de la zone si elle va être masquée
    if (fold) {
      const headingNode = view.state.doc.nodeAt(pos);
      if (headingNode) {
        const headingLevel = headingNode.attrs.level as number;
        const sectionEnd = findSectionEnd(view.state.doc, pos, headingLevel);
        const contentStart = pos + headingNode.nodeSize;
        const { from } = view.state.selection;
        if (from >= contentStart && from < sectionEnd) {
          const newSel = TextSelection.near(
            view.state.doc.resolve(contentStart - 1),
            -1
          );
          tr.setSelection(newSel);
        }
      }
    }

    // Mise à jour anticipée pour éviter la latence visuelle
    dom.dataset.folded = String(fold);
    log.info("toggle fold heading", { pos, fold });
    view.dispatch(tr);
    view.focus();
  });

  const contentDOM = document.createElement("span");
  contentDOM.className = "heading-content";

  dom.appendChild(btn);
  dom.appendChild(contentDOM);

  return {
    dom,
    contentDOM,

    update(updatedNode: ProsemirrorNode) {
      if (updatedNode.type.name !== "heading") return false;
      // Forcer la recréation si le niveau change (les balises HTML sont immuables)
      if (updatedNode.attrs.level !== level) return false;

      // Synchroniser l'état fold
      const pos = getPos();
      if (pos != null) {
        dom.dataset.folded = String(isHeadingFolded(view, pos));
      }
      return true;
    },

    ignoreMutation(mutation: ViewMutationRecord) {
      const target = mutation.target as globalThis.Node;
      // Mutations sur le bouton (hors contentDOM)
      if (btn.contains(target) || target === btn) return true;
      // Changement de data-folded sur le heading lui-même — piloté par le plugin, pas PM
      if (
        target === dom &&
        "attributeName" in mutation &&
        mutation.attributeName === "data-folded"
      )
        return true;
      return false;
    },
  };
}

const headingNodeViewKey = new PluginKey("headingNodeView");

export const headingNodeViewPlugin = $prose(
  () =>
    new Plugin({
      key: headingNodeViewKey,
      props: {
        nodeViews: {
          heading: buildHeadingNodeView,
        },
      },
    })
);
