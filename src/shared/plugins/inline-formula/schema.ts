/**
 * schema.ts — nœud ProseMirror `inline_formula`.
 *
 * Nœud atome inline (leaf, non éditable comme du texte) : son AFFICHAGE (résultat
 * calculé) diffère de sa SOURCE (la formule). Une marque ne convient donc pas —
 * et un nœud atome délègue ses frontières/caret à ProseMirror (pas les bugs
 * WebKit des nœuds à contenu, cf. mémoire inline-styles-as-marks).
 *
 * Sérialisation : `$$expr$$` (chemins absolus dans ref()), round-trip par
 * remark-inline-formula.ts. La vraie évaluation/affichage est dans node-view.ts.
 */

import { $node } from "@milkdown/kit/utils";
import { formulaInner } from "./inlineFormulaState";

export const inlineFormulaSchema = $node("inline_formula", () => ({
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  marks: "",

  attrs: {
    // Formule brute complète `$$…$$` ; vide = `$$$$`.
    raw: { default: "$$$$" },
  },

  parseDOM: [
    {
      tag: "span[data-inline-formula]",
      // biome-ignore lint/suspicious/noExplicitAny: API Milkdown non typée strictement
      getAttrs: (dom: any) => ({
        raw: dom.getAttribute?.("data-raw") ?? "$$$$",
      }),
    },
  ],
  // biome-ignore lint/suspicious/noExplicitAny: idem
  toDOM: (node: any) => [
    "span",
    {
      "data-inline-formula": "",
      "data-raw": node.attrs.raw,
      contenteditable: "false",
    },
  ],

  // ── Parser Markdown → ProseMirror ─────────────────────────────────────
  parseMarkdown: {
    // biome-ignore lint/suspicious/noExplicitAny: idem
    match: (node: any) => node.type === "inline_formula",
    // biome-ignore lint/suspicious/noExplicitAny: idem
    runner: (state: any, node: any, type: any) => {
      state.addNode(type, { raw: node.value ?? "$$$$" });
    },
  },

  // ── Sérialiseur ProseMirror → Markdown ────────────────────────────────
  // Émet un nœud mdast `inline_formula` { value } ; le handler remark-stringify
  // (remark-inline-formula.ts) renvoie `value` verbatim (pas d'échappement des
  // `*`, `_`, etc. présents dans l'expression).
  toMarkdown: {
    // biome-ignore lint/suspicious/noExplicitAny: idem
    match: (node: any) => node.type.name === "inline_formula",
    // biome-ignore lint/suspicious/noExplicitAny: idem
    runner: (state: any, node: any) => {
      // 3e arg = `value` du nœud mdast ; lu verbatim par le handler stringify.
      // Formule vide (`$$$$`, édition en cours) → rien sur disque.
      const raw = node.attrs.raw as string;
      const isEmpty = formulaInner(raw).trim() === "";
      state.addNode("inline_formula", undefined, isEmpty ? "" : raw);
    },
  },
}));
