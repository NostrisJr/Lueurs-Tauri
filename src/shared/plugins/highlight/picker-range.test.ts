import { Schema } from "@milkdown/kit/prose/model";
import { EditorState } from "@milkdown/kit/prose/state";
import { describe, expect, it } from "vitest";
import { highlightRangeAt, mapPickerRange } from "./picker-range";

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "text*" },
    text: {},
  },
  marks: {
    highlight_inline: { attrs: { color: { default: "yellow" } } },
    strong: {},
  },
});
const hl = schema.marks.highlight_inline;

function stateOf(...parts: [string, any[]?][]) {
  const nodes = parts.map(([text, marks]) => schema.text(text, marks));
  return EditorState.create({
    doc: schema.node("doc", null, [schema.node("paragraph", null, nodes)]),
  });
}

describe("highlightRangeAt", () => {
  it("étend à la plage contiguë de même couleur, gras compris", () => {
    const y = hl.create({ color: "yellow" });
    const state = stateOf(
      ["ab "],
      ["cd", [y]],
      ["ef", [y, schema.marks.strong.create()]],
      [" gh"]
    );
    // Paragraphe ouvre en 1 : "ab " = 1..4, "cd" = 4..6, "ef" = 6..8
    expect(highlightRangeAt(state, 5, hl)).toEqual({
      from: 4,
      to: 8,
      color: "yellow",
    });
  });

  it("s'arrête à un changement de couleur", () => {
    const state = stateOf(
      ["ab", [hl.create({ color: "yellow" })]],
      ["cd", [hl.create({ color: "blue" })]]
    );
    expect(highlightRangeAt(state, 1, hl)).toEqual({
      from: 1,
      to: 3,
      color: "yellow",
    });
  });

  it("renvoie null hors surlignage", () => {
    expect(highlightRangeAt(stateOf(["abc"]), 2, hl)).toBeNull();
  });
});

describe("mapPickerRange", () => {
  it("décale la plage avec une insertion en amont", () => {
    expect(mapPickerRange({ from: 4, to: 8 }, (p) => p + 3)).toEqual({
      from: 7,
      to: 11,
    });
  });

  it("abandonne la plage si elle s'effondre", () => {
    expect(mapPickerRange({ from: 4, to: 8 }, () => 5)).toBeNull();
  });

  it("laisse null tel quel", () => {
    expect(mapPickerRange(null, (p) => p)).toBeNull();
  });
});
