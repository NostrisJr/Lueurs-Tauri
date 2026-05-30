import { $mark } from "@milkdown/kit/utils";

// Mark `didascalie_inline` : texte stylé `||texte||` sur disque, rendu `| texte |`
// (pipes en pseudo-éléments CSS, cf. DefaultStyle.css).
// - `inclusive: false` : le curseur juste après la marque n'est pas dedans → on
//   peut taper du texte normal après le dernier mot, même en fin de ligne.
// - `excludes: "_"` : aucune autre marque imbriquée (évite `||**x**||` qui se
//   reparserait en `||` + strong + `||`, donc perte de la didascalie).
export const didascalieInlineSchema = $mark("didascalie_inline", () => ({
  inclusive: false,
  excludes: "_",

  parseDOM: [{ tag: "span[data-didascalie-inline]" }],
  toDOM: () => [
    "span",
    { "data-didascalie-inline": "", class: "didascalie-inline" },
    0,
  ],

  parseMarkdown: {
    // biome-ignore lint/suspicious/noExplicitAny: API Milkdown non typée strictement
    match: (node: any) => node.type === "didascalie_inline",
    // biome-ignore lint/suspicious/noExplicitAny: idem
    runner: (state: any, node: any, markType: any) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },

  toMarkdown: {
    // biome-ignore lint/suspicious/noExplicitAny: idem
    match: (mark: any) => mark.type.name === "didascalie_inline",
    // biome-ignore lint/suspicious/noExplicitAny: idem
    runner: (state: any, mark: any) => {
      // Émet un nœud mdast `didascalie_inline` ; le handler remark-stringify
      // (remark-inline.ts) le sérialise en `||texte||`.
      state.withMark(mark, "didascalie_inline");
    },
  },
}));
