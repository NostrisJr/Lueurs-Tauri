import { $node } from "@milkdown/kit/utils";

// Nœud inline `didascalie_inline` : contenu texte uniquement, rendu via NodeView
// avec deux pipes non-éditables de part et d'autre. Stocké `|texte|` sur disque.
export const didascalieInlineSchema = $node("didascalie_inline", () => ({
    inline: true,
    group: "inline",
    content: "text*",
    // Pas de marks pour éviter l'ambiguïté de parsing (|*texte*| serait
    // interprété par remark comme texte + emphasis + texte, pas comme didascalie).
    marks: "",

    parseDOM: [{ tag: "span[data-didascalie-inline]" }],
    toDOM: () => ["span", { "data-didascalie-inline": "" }, 0],

    parseMarkdown: {
        match: (node: any) => node.type === "didascalie_inline",
        runner: (state: any, node: any, type: any) => {
            state.openNode(type);
            state.next(node.children);
            state.closeNode();
        },
    },

    toMarkdown: {
        match: (node: any) => node.type.name === "didascalie_inline",
        runner: (state: any, node: any) => {
            // Émet 3 text nodes frères dans le parent (typiquement un paragraph) :
            // |, contenu, |. remark-stringify concatène en `|texte|`.
            state.addNode("text", undefined, "|");
            state.next(node.content);
            state.addNode("text", undefined, "|");
        },
    },
}));
