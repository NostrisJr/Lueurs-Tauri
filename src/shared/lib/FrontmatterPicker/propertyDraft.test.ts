import { describe, expect, it } from "vitest";
import {
  changeDraftType,
  makeEmptyFormulaDraft,
  makeInitialDraft,
  serializeDraft,
  withFormatConstraint,
} from "./propertyDraft";

describe("makeInitialDraft", () => {
  it("détecte une formule NUMBER", () => {
    expect(makeInitialDraft('$$NUMBER(1+1, decimals=2, unit="km")$$')).toEqual({
      type: "number",
      text: "1+1",
      numberDef: { expr: "1+1", decimals: 2, unit: "km" },
      enumDef: { options: [], default: "" },
    });
  });

  it("détecte une formule ENUM", () => {
    const draft = makeInitialDraft("$$ENUM([a;b],a)$$");
    expect(draft.type).toBe("enum");
    expect(draft.enumDef).toEqual({
      options: [{ value: "a" }, { value: "b" }],
      default: "a",
    });
  });

  it("traite une formule brute (non NUMBER/ENUM) comme Nombre", () => {
    expect(makeInitialDraft('$$self["a"]+1$$')).toEqual({
      type: "number",
      text: 'self["a"]+1',
      numberDef: { expr: 'self["a"]+1' },
      enumDef: { options: [], default: "" },
    });
  });

  it("traite une valeur non-formule comme Texte", () => {
    expect(makeInitialDraft("bonjour")).toEqual({
      type: "text",
      text: "bonjour",
      numberDef: { expr: "bonjour" },
      enumDef: { options: [], default: "" },
    });
  });
});

describe("makeEmptyFormulaDraft", () => {
  it("démarre en Nombre, expression vide", () => {
    expect(makeEmptyFormulaDraft()).toEqual({
      type: "number",
      text: "",
      numberDef: { expr: "" },
      enumDef: { options: [], default: "" },
    });
  });
});

describe("withFormatConstraint", () => {
  it("ne change rien sans contrainte", () => {
    const draft = makeInitialDraft("bonjour");
    expect(withFormatConstraint(draft, undefined)).toEqual(draft);
  });

  it("force le type Nombre et impose decimals/unit, en préservant l'expr", () => {
    const draft = makeInitialDraft("bonjour");
    expect(
      withFormatConstraint(draft, { expr: "", decimals: 2, unit: "km" })
    ).toEqual({
      type: "number",
      text: "bonjour",
      numberDef: { expr: "bonjour", decimals: 2, unit: "km" },
      enumDef: { options: [], default: "" },
    });
  });
});

describe("changeDraftType", () => {
  it("ne fait rien si le type ne change pas", () => {
    const draft = makeInitialDraft("bonjour");
    expect(changeDraftType(draft, "text")).toBe(draft);
  });

  it("Texte → Nombre reprend le texte tel quel comme expression", () => {
    const draft = makeInitialDraft("42");
    const next = changeDraftType(draft, "number");
    expect(next.type).toBe("number");
    expect(next.numberDef.expr).toBe("42");
  });

  it("Nombre → Texte reprend l'expression comme texte", () => {
    const draft = makeInitialDraft("$$NUMBER(1+1)$$");
    const next = changeDraftType(draft, "text");
    expect(next.type).toBe("text");
    expect(next.text).toBe("1+1");
  });

  it("Texte → Bouton amorce une première option avec le texte tapé", () => {
    const draft = makeInitialDraft("bonjour");
    const next = changeDraftType(draft, "enum");
    expect(next.type).toBe("enum");
    expect(next.enumDef).toEqual({
      options: [{ value: "bonjour" }],
      default: "bonjour",
    });
  });

  it("Nombre → Bouton amorce une première option avec l'expression", () => {
    const draft = changeDraftType(makeInitialDraft("42"), "number");
    const next = changeDraftType(draft, "enum");
    expect(next.enumDef).toEqual({
      options: [{ value: "42" }],
      default: "42",
    });
  });

  it("→ Bouton crée quand même une première option (vide) si le contenu précédent est vide — pour toujours avoir quelque chose à focus", () => {
    const draft = makeInitialDraft("");
    const next = changeDraftType(draft, "enum");
    expect(next.enumDef).toEqual({ options: [{ value: "" }], default: "" });
  });

  it("→ Bouton garde les options déjà présentes (va-et-vient Bouton→Nombre→Bouton)", () => {
    const enumDraft = makeInitialDraft("$$ENUM([a;b],a)$$");
    const numberDraft = changeDraftType(enumDraft, "number");
    const backToEnum = changeDraftType(numberDraft, "enum");
    expect(backToEnum.enumDef).toEqual(enumDraft.enumDef);
  });

  it("Bouton → Nombre repart d'une expression vide", () => {
    const draft = makeInitialDraft("$$ENUM([a;b],a)$$");
    const next = changeDraftType(draft, "number");
    expect(next.numberDef.expr).toBe("");
  });

  it("Bouton → Texte reprend la valeur par défaut", () => {
    const draft = makeInitialDraft("$$ENUM([a;b],b)$$");
    const next = changeDraftType(draft, "text");
    expect(next.text).toBe("b");
  });
});

describe("serializeDraft", () => {
  it("Texte : renvoie le texte tel quel", () => {
    const draft = makeInitialDraft("bonjour");
    expect(serializeDraft(draft)).toBe("bonjour");
  });

  it("Nombre : sérialise en $$NUMBER(...)$$", () => {
    const draft = makeInitialDraft("42");
    const number = changeDraftType(draft, "number");
    expect(serializeDraft(number)).toBe("$$NUMBER(42)$$");
  });

  it("Nombre avec expression vide et sans format → texte vide", () => {
    const draft = makeEmptyFormulaDraft();
    expect(serializeDraft(draft)).toBe("");
  });

  it("Nombre avec expression vide mais format imposé → contrainte de format seule", () => {
    const draft = makeEmptyFormulaDraft();
    expect(serializeDraft(draft, { expr: "", decimals: 2, unit: "km" })).toBe(
      '$$NUMBER(, decimals=2, unit="km")$$'
    );
  });

  it("Bouton : filtre les options vides avant de sérialiser", () => {
    const draft = makeInitialDraft("$$ENUM([a;b],a)$$");
    const withEmptyOption = {
      ...draft,
      enumDef: {
        ...draft.enumDef,
        options: [...draft.enumDef.options, { value: "" }],
      },
    };
    expect(serializeDraft(withEmptyOption)).toBe(serializeDraft(draft));
  });

  it("Bouton sans options → texte vide", () => {
    const draft = changeDraftType(makeInitialDraft(""), "enum");
    expect(serializeDraft(draft)).toBe("");
  });

  it("decimals/unit imposés par un template écrasent le brouillon local", () => {
    const draft = changeDraftType(makeInitialDraft("42"), "number");
    const withLocalFormat = {
      ...draft,
      numberDef: { ...draft.numberDef, decimals: 5, unit: "px" },
    };
    expect(
      serializeDraft(withLocalFormat, { expr: "", decimals: 1, unit: "km" })
    ).toBe('$$NUMBER(42, decimals=1, unit="km")$$');
  });
});
