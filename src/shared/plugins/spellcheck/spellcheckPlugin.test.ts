import { Schema } from "@milkdown/kit/prose/model";
import { describe, expect, it } from "vitest";
import { buildBlockText } from "./spellcheckPlugin";

/** Schéma minimal reproduisant les nœuds pertinents (texte, hardbreak, formule atome). */
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    text: { group: "inline" },
    hardbreak: { inline: true, group: "inline" },
    inline_formula: { inline: true, group: "inline", atom: true },
  },
});

function paragraph(
  ...children: Parameters<typeof schema.nodes.paragraph.create>[1][]
) {
  return schema.nodes.paragraph.create(null, children as never);
}

describe("buildBlockText", () => {
  it("insère un espace réservé pour une formule au lieu de la sauter", () => {
    const block = paragraph(
      schema.text("avant "),
      schema.nodes.inline_formula.create(),
      schema.text(" après")
    );

    const { text } = buildBlockText(block, 0);

    // Ni espace double (le bug initial), ni les deux espaces collées.
    expect(text).not.toContain("  ");
    expect(text).toBe("avant ￼ après");
  });

  it("rapporte la plage octet de la formule pour le filtrage des suggestions", () => {
    const block = paragraph(
      schema.text("avant "),
      schema.nodes.inline_formula.create(),
      schema.text(" après")
    );

    const { atomByteRanges, text } = buildBlockText(block, 0);

    expect(atomByteRanges).toHaveLength(1);
    const [range] = atomByteRanges;
    // U+FFFC occupe 3 octets UTF-8, juste après "avant " (6 octets).
    expect(range).toEqual({ start: 6, end: 9 });
    expect(text.length).toBeGreaterThan(0);
  });

  it("mappe correctement les positions PM avant et après la formule", () => {
    // doc(paragraph(...)) : le paragraphe démarre à la position 0, son contenu à 1.
    const block = paragraph(
      schema.text("avant "),
      schema.nodes.inline_formula.create(),
      schema.text(" après")
    );

    const { byteToPos } = buildBlockText(block, 0);

    // "avant " = positions PM 1..7, la formule est en position 7 (taille 1),
    // " après" reprend en position PM 8.
    expect(byteToPos[0]).toBe(1); // 'a' de "avant"
    expect(byteToPos[6]).toBe(7); // début de la formule (espace réservé)
    expect(byteToPos[9]).toBe(8); // ' ' juste après la formule
  });

  it("ignore la formule elle-même (aucun texte transmis pour son contenu)", () => {
    const block = paragraph(schema.nodes.inline_formula.create());
    const { text } = buildBlockText(block, 0);
    expect(text).toBe("￼");
  });
});
