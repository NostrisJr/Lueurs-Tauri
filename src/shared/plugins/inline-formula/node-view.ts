/**
 * node-view.ts — rendu d'une formule inline (DOM impératif, pas React).
 *
 * Affiche `ƒ <résultat>` (même symbole que le frontmatter). Clic → ouvre le popup
 * d'édition. Pas de React par nœud : il peut y en avoir beaucoup et le rendu est
 * trivial (cf. mémoire project-plugins-react-migration).
 */

import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";
import type { EditorView, NodeView } from "@milkdown/kit/prose/view";
import { computeFormula } from "../../lib/formulas";
import {
  formulaInner,
  inlineFormulaBridge,
  registerInlineFormulaView,
  setInlineFormulaEdit,
} from "./inlineFormulaState";

export function createInlineFormulaNodeView() {
  return function inlineFormulaNodeView(
    initialNode: ProsemirrorNode,
    view: EditorView,
    getPos: () => number | undefined
  ): NodeView {
    const dom = document.createElement("span");
    dom.className = "inline-formula";
    dom.setAttribute("data-inline-formula", "");
    dom.contentEditable = "false";

    const sigil = document.createElement("span");
    sigil.className = "inline-formula-sigil";
    sigil.textContent = "ƒ";
    const result = document.createElement("span");
    result.className = "inline-formula-result";
    dom.append(sigil, result);

    let currentNode = initialNode;

    function render() {
      const raw = currentNode.attrs.raw as string;
      const inner = formulaInner(raw).trim();
      if (!inner) {
        result.textContent = "…";
        dom.classList.remove("inline-formula-error");
        dom.classList.add("inline-formula-empty");
        return;
      }
      dom.classList.remove("inline-formula-empty");
      const ctx = inlineFormulaBridge.current;
      const computed = ctx
        ? computeFormula(raw, ctx.vars, ctx.children, ctx.noteResolver)
        : inner;
      const isError = computed === "#ERREUR";
      dom.classList.toggle("inline-formula-error", isError);
      result.textContent = computed || "—";
    }

    render();
    // Recalcul quand l'arbre de notes change (résultat dépend d'autres notes).
    const unregister = registerInlineFormulaView(render);

    function openEditor() {
      const pos = getPos();
      if (pos === undefined) return;
      const coords = view.coordsAtPos(pos);
      setInlineFormulaEdit({
        pos,
        raw: currentNode.attrs.raw as string,
        coords: { left: coords.left, top: coords.top, bottom: coords.bottom },
      });
    }

    // Clic → ouvre le popup (empêche PM de simplement poser le curseur).
    dom.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEditor();
    });

    return {
      dom,
      update(updated: ProsemirrorNode) {
        if (updated.type.name !== "inline_formula") return false;
        currentNode = updated;
        render();
        return true;
      },
      // Atome : on gère l'interaction (clic → popup) nous-mêmes.
      stopEvent() {
        return true;
      },
      ignoreMutation() {
        return true;
      },
      selectNode() {
        dom.classList.add("inline-formula-selected");
      },
      deselectNode() {
        dom.classList.remove("inline-formula-selected");
      },
      destroy() {
        unregister();
      },
    };
  };
}
