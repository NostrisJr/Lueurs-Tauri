import { describe, expect, it } from "vitest";
import {
  applyFormatConstraint,
  formatNumberResult,
  isFormatOnlyNumber,
  isNumberFormula,
  isPlainNumberExpr,
  parseNumber,
  reconcileNumberFormat,
  serializeNumber,
} from "./numberProperty";

describe("isNumberFormula", () => {
  it("reconnaît la syntaxe NUMBER(...)", () => {
    expect(isNumberFormula('$$NUMBER(42, decimals=2, unit="km")$$')).toBe(true);
    expect(isNumberFormula("$$NUMBER(42)$$")).toBe(true);
  });

  it("rejette une formule ou un texte quelconque", () => {
    expect(isNumberFormula('$$self["a"] + 1$$')).toBe(false);
    expect(isNumberFormula("42")).toBe(false);
    expect(isNumberFormula(undefined)).toBe(false);
  });
});

describe("parseNumber", () => {
  it("parse expr seule", () => {
    expect(parseNumber("$$NUMBER(42)$$")).toEqual({
      expr: "42",
      decimals: undefined,
      unit: undefined,
    });
  });

  it("parse expr + decimals", () => {
    expect(parseNumber("$$NUMBER(42, decimals=2)$$")).toEqual({
      expr: "42",
      decimals: 2,
      unit: undefined,
    });
  });

  it("parse expr + decimals + unit", () => {
    expect(parseNumber('$$NUMBER(42, decimals=2, unit="km")$$')).toEqual({
      expr: "42",
      decimals: 2,
      unit: "km",
    });
  });

  it("parse expr + unit seule (sans decimals)", () => {
    expect(parseNumber('$$NUMBER(42, unit="km")$$')).toEqual({
      expr: "42",
      decimals: undefined,
      unit: "km",
    });
  });

  it("préserve une expression complexe contenant des virgules", () => {
    expect(
      parseNumber('$$NUMBER(round(self["a"], 2), decimals=1, unit="€")$$')
    ).toEqual({
      expr: 'round(self["a"], 2)',
      decimals: 1,
      unit: "€",
    });
  });

  it("renvoie null si la syntaxe ne correspond pas", () => {
    expect(parseNumber('$$self["a"]$$')).toBeNull();
    expect(parseNumber("texte simple")).toBeNull();
  });

  it("renvoie null si expr est vide et sans format (rien à contraindre)", () => {
    expect(parseNumber("$$NUMBER()$$")).toBeNull();
    expect(parseNumber("$$NUMBER(  )$$")).toBeNull();
  });

  it("accepte expr vide si decimals et/ou unit sont définis (contrainte de format seule)", () => {
    expect(parseNumber("$$NUMBER(, decimals=2)$$")).toEqual({
      expr: "",
      decimals: 2,
      unit: undefined,
    });
    expect(parseNumber('$$NUMBER(, unit="km")$$')).toEqual({
      expr: "",
      decimals: undefined,
      unit: "km",
    });
    expect(parseNumber('$$NUMBER(, decimals=1, unit="km")$$')).toEqual({
      expr: "",
      decimals: 1,
      unit: "km",
    });
  });
});

describe("serializeNumber", () => {
  it("round-trip avec tous les champs", () => {
    const def = { expr: "42", decimals: 2, unit: "km" };
    expect(parseNumber(serializeNumber(def))).toEqual(def);
  });

  it("round-trip expr seule", () => {
    const def = { expr: "42" };
    expect(parseNumber(serializeNumber(def))).toEqual({
      expr: "42",
      decimals: undefined,
      unit: undefined,
    });
  });

  it("round-trip format seul (expr vide)", () => {
    const def = { expr: "", decimals: 2, unit: "km" };
    expect(parseNumber(serializeNumber(def))).toEqual(def);
  });
});

describe("isFormatOnlyNumber", () => {
  it("vrai si expr vide et decimals ou unit défini", () => {
    expect(isFormatOnlyNumber({ expr: "", decimals: 2 })).toBe(true);
    expect(isFormatOnlyNumber({ expr: "", unit: "km" })).toBe(true);
    expect(isFormatOnlyNumber({ expr: "  ", unit: "km" })).toBe(true);
  });

  it("faux si expr non vide, même avec format", () => {
    expect(isFormatOnlyNumber({ expr: "42", decimals: 2, unit: "km" })).toBe(
      false
    );
  });

  it("faux si expr vide et aucun format (rien à contraindre)", () => {
    expect(isFormatOnlyNumber({ expr: "" })).toBe(false);
  });
});

describe("reconcileNumberFormat", () => {
  it("préserve l'expr d'un NUMBER existant, remplace decimals/unit", () => {
    expect(
      reconcileNumberFormat('$$NUMBER(42, decimals=2, unit="g")$$', {
        decimals: 1,
        unit: "kg",
      })
    ).toBe('$$NUMBER(42, decimals=1, unit="kg")$$');
  });

  it("reprend un littéral texte simple comme expr", () => {
    expect(reconcileNumberFormat("17", { decimals: 0, unit: "kg" })).toBe(
      '$$NUMBER(17, decimals=0, unit="kg")$$'
    );
  });

  it("amorce à 0 si la valeur actuelle n'est ni un NUMBER ni un littéral", () => {
    expect(reconcileNumberFormat("", { unit: "km" })).toBe(
      '$$NUMBER(0, unit="km")$$'
    );
    expect(reconcileNumberFormat("texte libre", { decimals: 2 })).toBe(
      "$$NUMBER(0, decimals=2)$$"
    );
  });

  it("préserve une formule (pas un littéral) comme expr", () => {
    expect(
      reconcileNumberFormat('$$NUMBER(round(self["a"], 2), unit="g")$$', {
        unit: "kg",
      })
    ).toBe('$$NUMBER(round(self["a"], 2), unit="kg")$$');
  });
});

describe("applyFormatConstraint", () => {
  it("remplace decimals/unit par la contrainte, préserve l'expr", () => {
    expect(
      applyFormatConstraint(
        { expr: "42", decimals: 5, unit: "truc" },
        { decimals: 1, unit: "kg" }
      )
    ).toEqual({ expr: "42", decimals: 1, unit: "kg" });
  });

  it("efface un decimals/unit local absent de la contrainte", () => {
    expect(
      applyFormatConstraint(
        { expr: "42", decimals: 5, unit: "truc" },
        { unit: "kg" }
      )
    ).toEqual({ expr: "42", decimals: undefined, unit: "kg" });
  });

  it("préserve un expr vide (héritier pas encore réconcilié)", () => {
    expect(
      applyFormatConstraint({ expr: "" }, { decimals: 2, unit: "kg" })
    ).toEqual({ expr: "", decimals: 2, unit: "kg" });
  });
});

describe("isPlainNumberExpr", () => {
  it("reconnaît un littéral entier ou décimal, positif ou négatif", () => {
    expect(isPlainNumberExpr("42")).toBe(true);
    expect(isPlainNumberExpr("-3.5")).toBe(true);
  });

  it("rejette une expression de formule", () => {
    expect(isPlainNumberExpr('self["a"] + 1')).toBe(false);
    expect(isPlainNumberExpr("round(1.2, 2)")).toBe(false);
  });
});

describe("formatNumberResult", () => {
  it("applique les décimales", () => {
    expect(formatNumberResult("1.2345", { decimals: 2 })).toBe("1.23");
  });

  it("applique l'unité en suffixe", () => {
    expect(formatNumberResult("42", { unit: "km" })).toBe("42 km");
  });

  it("applique décimales puis unité", () => {
    expect(formatNumberResult("1.2345", { decimals: 1, unit: "km" })).toBe(
      "1.2 km"
    );
  });

  it("laisse une valeur non-numérique inchangée", () => {
    expect(formatNumberResult("#ERREUR", { decimals: 2 })).toBe("#ERREUR");
  });
});
