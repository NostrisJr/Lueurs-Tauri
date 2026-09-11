import { describe, expect, it } from "vitest";
import { parsePreviewBlocks } from "./parseMarkdownPreview";

describe("parsePreviewBlocks — badges", () => {
  it("formule inline non calculable → badge kind=formula avec [...]", () => {
    const blocks = parsePreviewBlocks("Le total fait $$2 + 2$$ euros.");
    expect(blocks).toEqual([
      {
        type: "paragraph",
        segments: [
          { type: "text", value: "Le total fait " },
          { type: "badge", kind: "formula", label: "[...]" },
          { type: "text", value: " euros." },
        ],
      },
    ]);
  });

  it("image inline → badge kind=image avec l'alt en label", () => {
    const blocks = parsePreviewBlocks("Voir ![Un chat](chat.png) ici.");
    expect(blocks).toEqual([
      {
        type: "paragraph",
        segments: [
          { type: "text", value: "Voir " },
          { type: "badge", kind: "image", label: "Un chat" },
          { type: "text", value: " ici." },
        ],
      },
    ]);
  });

  it("image seule sur sa ligne → bloc badge kind=image", () => {
    const blocks = parsePreviewBlocks("![Un chat](chat.png)");
    expect(blocks).toEqual([
      { type: "badge", kind: "image", label: "Un chat" },
    ]);
  });

  it("lien audio seul sur sa ligne → bloc badge kind=audio", () => {
    const blocks = parsePreviewBlocks("[Mémo vocal](memo.mp3)");
    expect(blocks).toEqual([
      { type: "badge", kind: "audio", label: "Mémo vocal" },
    ]);
  });

  it("bloc de code → bloc badge kind=code", () => {
    const blocks = parsePreviewBlocks("```\nconst x = 1;\n```");
    expect(blocks).toEqual([
      { type: "badge", kind: "code", label: "Bloc de code" },
    ]);
  });

  it("tableau → bloc badge kind=table", () => {
    const blocks = parsePreviewBlocks("| a | b |\n| - | - |");
    expect(blocks).toEqual([
      { type: "badge", kind: "table", label: "Tableau" },
    ]);
  });
});

describe("parsePreviewBlocks — sauts de vers (poésie)", () => {
  it("<br/> littéral → segment linebreak dédié (pas fondu dans le texte)", () => {
    const blocks = parsePreviewBlocks("Vers un<br/>Vers deux<br />Vers trois");
    expect(blocks).toEqual([
      {
        type: "paragraph",
        segments: [
          { type: "text", value: "Vers un" },
          { type: "linebreak" },
          { type: "text", value: "Vers deux" },
          { type: "linebreak" },
          { type: "text", value: "Vers trois" },
        ],
      },
    ]);
  });
});
