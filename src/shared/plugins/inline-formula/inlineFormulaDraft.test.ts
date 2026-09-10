import { describe, expect, it } from "vitest";
import {
  deriveInlineFormulaDraft,
  serializeInlineFormulaDraft,
  switchInlineFormulaMode,
} from "./inlineFormulaDraft";

describe("deriveInlineFormulaDraft", () => {
  it("reconnaît une formule ENUM", () => {
    const draft = deriveInlineFormulaDraft("$$ENUM([a;b],a)$$");
    expect(draft.mode).toBe("enum");
    expect(draft.enumDef.options.map((o) => o.value)).toEqual(["a", "b"]);
    expect(draft.enumDef.default).toBe("a");
  });

  it("reconnaît une formule NUMBER", () => {
    const draft = deriveInlineFormulaDraft(
      '$$NUMBER(1+1, decimals=2, unit="km")$$'
    );
    expect(draft.mode).toBe("number");
    expect(draft.numberDef).toEqual({ expr: "1+1", decimals: 2, unit: "km" });
  });

  it("traite une formule brute héritée comme Nombre, expr reprise telle quelle", () => {
    const draft = deriveInlineFormulaDraft('$$self["a"] + 1$$');
    expect(draft.mode).toBe("number");
    expect(draft.numberDef.expr).toBe('self["a"] + 1');
  });

  it("traite une formule vide comme Nombre, expr vide", () => {
    const draft = deriveInlineFormulaDraft("$$$$");
    expect(draft.mode).toBe("number");
    expect(draft.numberDef.expr).toBe("");
  });
});

describe("switchInlineFormulaMode", () => {
  it("ne change rien si le mode cible est déjà actif", () => {
    const draft = deriveInlineFormulaDraft("$$1+1$$");
    expect(switchInlineFormulaMode(draft, "number")).toBe(draft);
  });

  it("Nombre → Bouton conserve enumDef, ne touche pas numberDef", () => {
    const draft = deriveInlineFormulaDraft("$$1+1$$");
    const next = switchInlineFormulaMode(draft, "enum");
    expect(next.mode).toBe("enum");
    expect(next.enumDef).toEqual(draft.enumDef);
  });

  it("Bouton → Nombre repart d'une expression vierge", () => {
    const draft = deriveInlineFormulaDraft("$$ENUM([a;b],a)$$");
    const next = switchInlineFormulaMode(draft, "number");
    expect(next.mode).toBe("number");
    expect(next.numberDef).toEqual({ expr: "" });
  });
});

describe("serializeInlineFormulaDraft", () => {
  it("sérialise Nombre en $$NUMBER(...)$$", () => {
    expect(
      serializeInlineFormulaDraft({
        mode: "number",
        numberDef: { expr: "1+1", decimals: 2 },
        enumDef: { options: [], default: "" },
      })
    ).toBe("$$NUMBER(1+1, decimals=2)$$");
  });

  it("expr vide sans format → formule vide (suppression du nœud)", () => {
    expect(
      serializeInlineFormulaDraft({
        mode: "number",
        numberDef: { expr: "  " },
        enumDef: { options: [], default: "" },
      })
    ).toBe("$$$$");
  });

  it("expr vide avec format seul → contrainte de format préservée", () => {
    expect(
      serializeInlineFormulaDraft({
        mode: "number",
        numberDef: { expr: "", unit: "km" },
        enumDef: { options: [], default: "" },
      })
    ).toBe('$$NUMBER(, unit="km")$$');
  });

  it("sérialise Bouton en filtrant les options vides", () => {
    expect(
      serializeInlineFormulaDraft({
        mode: "enum",
        numberDef: { expr: "" },
        enumDef: {
          options: [{ value: "a" }, { value: "" }, { value: "b" }],
          default: "a",
        },
      })
    ).toBe("$$ENUM([a;b],a)$$");
  });

  it("Bouton sans option valide → formule vide", () => {
    expect(
      serializeInlineFormulaDraft({
        mode: "enum",
        numberDef: { expr: "" },
        enumDef: { options: [{ value: "" }], default: "" },
      })
    ).toBe("$$$$");
  });
});
