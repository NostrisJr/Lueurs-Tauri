/**
 * node-view.ts — rendu d'une formule inline (DOM impératif, pas React).
 *
 * Deux rendus possibles selon la formule :
 *  - générale (Nombre ou brute) : `ƒ <résultat>`, même symbole que le
 *    frontmatter. Clic → popup d'édition complet (mode "edit").
 *  - ENUM : pill coloré (comme EnumValueSelector) affichant la valeur
 *    courante. Clic sur le pill → dropdown rapide de sélection (mode
 *    "value", cf. InlineFormulaPopup) ; icône réglages en survol (coin
 *    haut-droit) → popup complet (switcher + options, mode "edit").
 *
 * Pas de React par nœud : il peut y en avoir beaucoup et le rendu est
 * trivial (cf. mémoire project-plugins-react-migration) — d'où l'icône
 * réglages en simple glyphe unicode plutôt qu'un IconGearshape React.
 */

import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";
import type { EditorView, NodeView } from "@milkdown/kit/prose/view";
import {
  enumValueState,
  optionColor,
  parseEnum,
} from "../../lib/FrontmatterPicker/enumProperty";
import { computeFormula, isFormulaError } from "../../lib/formulas";
import {
  formulaInner,
  inlineFormulaBridge,
  registerInlineFormulaView,
  setInlineFormulaEdit,
} from "./inlineFormulaState";

const SVG_NS = "http://www.w3.org/2000/svg";
// Icône réglages (Feather "settings", licence MIT) en SVG plutôt qu'un glyphe
// unicode ⚙ — cf. commentaire CSS associé (.inline-formula-gear svg).
function createGearIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "3");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute(
    "d",
    "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
  );
  svg.append(circle, path);
  return svg;
}

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

    // Pill ENUM (alternative au sigil ƒ + résultat) + icône réglages.
    const pill = document.createElement("span");
    pill.className = "inline-formula-button-pill";
    const pillText = document.createElement("span");
    pillText.className = "inline-formula-button-pill-text";
    // Chevron : même affordance "ceci est un dropdown" qu'EnumValueSelector —
    // sans lui, le pill se confond visuellement avec du texte surligné (même
    // palette de couleurs, cf. plugin highlight).
    const pillChevron = document.createElement("span");
    pillChevron.className = "inline-formula-button-pill-chevron";
    pillChevron.textContent = "▾";
    const gear = document.createElement("span");
    gear.className = "inline-formula-gear";
    gear.title = "Réglages de la formule";
    gear.append(createGearIcon());
    pill.append(pillText, pillChevron, gear);

    let currentNode = initialNode;
    // Bascule le contenu de `dom` entre {sigil, result} et {pill} — jamais les
    // deux à la fois : un simple toggle CSS laissait le sigil "ƒ" présent (donc
    // pris en compte dans le flux inline, décalant le pill) quand la formule
    // passait en ENUM, cf. remarque utilisateur. `replaceChildren` retire
    // réellement l'un ou l'autre du DOM plutôt que de le masquer visuellement.
    let displayMode: "formula" | "enum" | null = null;

    function render() {
      const raw = currentNode.attrs.raw as string;
      const enumDef = parseEnum(raw);

      if (enumDef) {
        if (displayMode !== "enum") {
          dom.replaceChildren(pill);
          displayMode = "enum";
        }
        dom.classList.remove("inline-formula-error", "inline-formula-empty");
        const state = enumValueState(enumDef.default, enumDef);
        pill.dataset.tone =
          state === "invalid"
            ? "invalid"
            : state === "placeholder"
              ? "placeholder"
              : (optionColor(enumDef.default, enumDef) ?? "neutral");
        pillText.textContent = enumDef.default || "—";
        return;
      }

      if (displayMode !== "formula") {
        dom.replaceChildren(sigil, result);
        displayMode = "formula";
      }

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
      const isError = isFormulaError(computed);
      dom.classList.toggle("inline-formula-error", isError);
      result.textContent = computed || "—";
    }

    render();
    // Recalcul quand l'arbre de notes change (résultat dépend d'autres notes).
    const unregister = registerInlineFormulaView(render);

    function nodeCoords(pos: number) {
      const c = view.coordsAtPos(pos);
      return { left: c.left, top: c.top, bottom: c.bottom };
    }

    function openEditor() {
      const pos = getPos();
      if (pos === undefined) return;
      setInlineFormulaEdit({
        pos,
        raw: currentNode.attrs.raw as string,
        coords: nodeCoords(pos),
        mode: "edit",
      });
    }

    function openValuePicker() {
      const pos = getPos();
      if (pos === undefined) return;
      setInlineFormulaEdit({
        pos,
        raw: currentNode.attrs.raw as string,
        coords: nodeCoords(pos),
        mode: "value",
        anchorEl: dom,
      });
    }

    // Icône réglages : toujours le popup complet, même sur un pill ENUM.
    gear.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEditor();
    });

    // Clic ailleurs sur le nœud → dropdown rapide pour un ENUM, popup
    // complet sinon (empêche aussi PM de simplement poser le curseur).
    dom.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const isEnum = !!parseEnum(currentNode.attrs.raw as string);
      if (isEnum) openValuePicker();
      else openEditor();
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
