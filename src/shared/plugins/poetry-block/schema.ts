import { $node } from "@milkdown/kit/utils";

export const poetryBlockSchema = $node("poetry_block", () => ({
  content: "block+",
  group: "block",
  defining: true,

  parseDOM: [{ tag: "div[data-poetry-block]" }],
  toDOM: () => ["div", { "data-poetry-block": "", class: "poetry-block" }, 0],

  parseMarkdown: {
    match: (node: any) => node.type === "poetry_block",
    runner: (state: any, node: any, type: any) => {
      state.openNode(type);
      state.next(node.children);
      state.closeNode();
    },
  },

  toMarkdown: {
    match: (node: any) => node.type.name === "poetry_block",
    runner: (state: any, node: any) => {
      state.openNode("paragraph");
      state.addNode("text", undefined, "§§");
      state.closeNode();
      state.next(node.content);
      state.openNode("paragraph");
      state.addNode("text", undefined, "§§");
      state.closeNode();
    },
  },
}));
