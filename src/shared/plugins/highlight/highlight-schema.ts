import { $mark } from "@milkdown/kit/utils";
import { getHighlightBg } from "./colors";

/**
 * Mark `highlight_inline` : surlignage `=={color}texte==` (ou `==texte==`),
 * rendu `<mark>`. Marque (et non nœud) → frontières gérées nativement par
 * ProseMirror : caret avant/après, Entrée, Backspace fonctionnent sans plugin.
 * - `inclusive: false` : on sort de la marque en tapant après le dernier mot.
 * - marques imbriquées autorisées (gras, italique…) à l'intérieur.
 */
export const highlightInlineSchema = $mark("highlight_inline", () => ({
  inclusive: false,

  attrs: { color: { default: "yellow" } },

  parseDOM: [
    {
      tag: "mark[data-hl-color]",
      getAttrs: (node: Element) => ({
        color: node.getAttribute("data-hl-color") ?? "yellow",
      }),
    },
  ],
  // biome-ignore lint/suspicious/noExplicitAny: API Milkdown non typée strictement
  toDOM: (mark: any) => {
    const color = mark.attrs.color as string;
    return [
      "mark",
      {
        "data-hl-color": color,
        class: "lueurs-hl",
        style: `background-color:${getHighlightBg(color)};border-radius:3px;padding:0 2px;`,
      },
      0,
    ];
  },

  parseMarkdown: {
    // biome-ignore lint/suspicious/noExplicitAny: idem
    match: (node: any) => node.type === "highlight",
    // biome-ignore lint/suspicious/noExplicitAny: idem
    runner: (state: any, node: any, markType: any) => {
      const color = node.color ?? "yellow";
      state.openMark(markType, { color });
      state.next(node.children);
      state.closeMark(markType);
    },
  },

  toMarkdown: {
    // biome-ignore lint/suspicious/noExplicitAny: idem
    match: (mark: any) => mark.type.name === "highlight_inline",
    // biome-ignore lint/suspicious/noExplicitAny: idem
    runner: (state: any, mark: any) => {
      // Émet un nœud mdast `highlight` ; sérialisé en `=={color}texte==` par le
      // handler remark-stringify (remark-highlight.ts).
      state.withMark(mark, "highlight", undefined, { color: mark.attrs.color });
    },
  },
}));
