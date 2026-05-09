import { $node } from "@milkdown/kit/utils";

// Bloc didascalie : conteneur similaire à blockquote, délimité par `||` sur
// leur propre ligne. Bordures à gauche et à droite (cf DefaultStyle.css).
export const didascalieBlockSchema = $node("didascalie_block", () => ({
    content: "block+",
    group: "block",
    defining: true,

    parseDOM: [{ tag: "div[data-didascalie-block]" }],
    toDOM: () => [
        "div",
        { "data-didascalie-block": "", class: "didascalie-block" },
        0,
    ],

    parseMarkdown: {
        match: (node: any) => node.type === "didascalie_block",
        runner: (state: any, node: any, type: any) => {
            state.openNode(type);
            state.next(node.children);
            state.closeNode();
        },
    },

    toMarkdown: {
        match: (node: any) => node.type.name === "didascalie_block",
        runner: (state: any, node: any) => {
            state.openNode("paragraph");
            state.addNode("text", undefined, "||");
            state.closeNode();
            state.next(node.content);
            state.openNode("paragraph");
            state.addNode("text", undefined, "||");
            state.closeNode();
        },
    },
}));
