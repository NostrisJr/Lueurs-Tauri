import { describe, expect, it } from "vitest";
import type { NoteFile } from "../hooks/useFileTree";
import {
  computeFormula,
  dehumanizeFormula,
  humanizeFormula,
  isFormula,
  isFormulaError,
} from "./formulas";

function note(overrides: Partial<NoteFile> = {}): NoteFile {
  return {
    kind: "file",
    id: "note.md",
    name: "note",
    type: null,
    title: "Note",
    body: "",
    frontmatter: {},
    tags: [],
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("isFormula", () => {
  it("reconnaît une formule $$...$$", () => {
    expect(isFormula('$$self["a"]$$')).toBe(true);
  });

  it("rejette une valeur non-formule", () => {
    expect(isFormula("simple texte")).toBe(false);
    expect(isFormula(42)).toBe(false);
    expect(isFormula(undefined)).toBe(false);
  });
});

describe("isFormulaError", () => {
  it("reconnaît les marqueurs d'erreur et de cycle", () => {
    expect(isFormulaError("#ERREUR")).toBe(true);
    expect(isFormulaError("#CYCLE")).toBe(true);
    expect(isFormulaError("42")).toBe(false);
  });
});

describe("humanizeFormula", () => {
  it("remplace un chemin ref() résolu par le nom de la note", () => {
    const resolver = (path: string) =>
      path === "/vault/autre.md" ? note({ name: "Autre" }) : undefined;
    expect(humanizeFormula('ref("/vault/autre.md")["x"]', resolver)).toBe(
      'ref("Autre")["x"]'
    );
  });

  it("laisse le chemin inchangé si la note n'est pas résolue", () => {
    const resolver = () => undefined;
    expect(humanizeFormula('ref("/vault/inconnu.md")["x"]', resolver)).toBe(
      'ref("/vault/inconnu.md")["x"]'
    );
  });
});

describe("dehumanizeFormula", () => {
  it("remplace un nom de note par son chemin absolu", () => {
    const notesByName = new Map([["Autre", "/vault/autre.md"]]);
    expect(dehumanizeFormula('ref("Autre")["x"]', notesByName)).toBe(
      'ref("/vault/autre.md")["x"]'
    );
  });

  it("laisse un chemin déjà absolu inchangé", () => {
    const notesByName = new Map<string, string>();
    const raw = 'ref("/vault/autre.md")["x"]';
    expect(dehumanizeFormula(raw, notesByName)).toBe(raw);
  });

  it("laisse inchangé si le nom n'est pas trouvé", () => {
    const notesByName = new Map<string, string>();
    const raw = 'ref("Inconnue")["x"]';
    expect(dehumanizeFormula(raw, notesByName)).toBe(raw);
  });
});

describe("computeFormula", () => {
  it("évalue une expression arithmétique simple", () => {
    expect(computeFormula("$$1 + 2$$", {})).toBe("3");
  });

  it('substitue self["prop"] par la valeur numérique', () => {
    expect(
      computeFormula('$$self["a"] + self["b"]$$', { a: "2", b: "3" })
    ).toBe("5");
  });

  it("traite une propriété absente comme 0", () => {
    expect(computeFormula('$$self["manquant"] + 1$$', {})).toBe("1");
  });

  it("applique round(n, decimals)", () => {
    expect(computeFormula("$$round(1.2345, 2)$$", {})).toBe("1.23");
  });

  it("applique iif(cond, alors, sinon)", () => {
    expect(
      computeFormula('$$iif(self["a"] > 5, "grand", "petit")$$', { a: "10" })
    ).toBe("grand");
  });

  it("renvoie #ERREUR sur une expression invalide", () => {
    expect(computeFormula("$$this is not valid js((($$", {})).toBe("#ERREUR");
  });

  it("détecte une référence circulaire directe", () => {
    const vars = { a: '$$self["a"]$$' };
    expect(computeFormula(vars.a, vars)).toBe("#CYCLE");
  });

  it("renvoie la valeur brute si ce n'est pas une formule", () => {
    expect(computeFormula("texte simple", {})).toBe("texte simple");
  });

  it("évalue NUMBER(expr) et applique decimals + unit au résultat", () => {
    expect(
      computeFormula('$$NUMBER(self["a"], decimals=1, unit="km")$$', {
        a: "3.456",
      })
    ).toBe("3.5 km");
  });

  it("NUMBER avec un littéral simple reste éditable comme un nombre", () => {
    expect(computeFormula("$$NUMBER(42, decimals=2)$$", {})).toBe("42.00");
  });

  it("NUMBER propage #ERREUR sans le reformater", () => {
    expect(
      computeFormula("$$NUMBER(this is not valid js(((, decimals=2)$$", {})
    ).toBe("#ERREUR");
  });

  it("NUMBER format seul (contrainte de template, expr vide) : aperçu déclaratif, jamais #ERREUR", () => {
    expect(computeFormula('$$NUMBER(, decimals=1, unit="km")$$', {})).toBe(
      "0.0 km"
    );
    expect(computeFormula('$$NUMBER(, unit="kg")$$', {})).toBe("0 kg");
    expect(computeFormula("$$NUMBER(, decimals=2)$$", {})).toBe("0.00");
  });

  it("évalue ENUM(...) et renvoie la valeur choisie (default), pas la liste d'options", () => {
    expect(computeFormula("$$ENUM([Todo;Doing;Done],Doing)$$", {})).toBe(
      "Doing"
    );
  });

  it("ENUM sans default explicite retombe sur la première option", () => {
    expect(computeFormula("$$ENUM([Todo;Doing;Done])$$", {})).toBe("Todo");
  });

  it("self[\"prop\"] référence la valeur choisie d'une propriété ENUM encore brute (ex: la note template elle-même, qui n'a pas d'héritier littéral)", () => {
    expect(
      computeFormula('$$self["statut"]$$', {
        statut: "$$ENUM([Todo;Doing;Done],Doing)$$",
      })
    ).toBe("Doing");
  });
});
