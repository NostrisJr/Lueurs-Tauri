import { describe, expect, it } from "vitest";
import { computeTemplateConstraints } from "./templateConstraints";

describe("computeTemplateConstraints", () => {
  it("verrouille la clé sans imposer la valeur quand le template a une valeur vide", () => {
    const result = computeTemplateConstraints([{ statut: "" }]);
    expect(result.lockedKeys.has("statut")).toBe(true);
    expect(result.lockedValues.has("statut")).toBe(false);
  });

  it("verrouille clé + valeur quand le template a une valeur non vide", () => {
    const result = computeTemplateConstraints([{ statut: "actif" }]);
    expect(result.lockedKeys.has("statut")).toBe(true);
    expect(result.lockedValues.has("statut")).toBe(true);
  });

  it("ignore les champs système du template", () => {
    const result = computeTemplateConstraints([
      { __Type__: "__template__", statut: "actif" },
    ]);
    expect(result.lockedKeys.has("__Type__")).toBe(false);
  });

  it("ENUM : verrouille la clé via enumConstraints, jamais lockedValues", () => {
    const result = computeTemplateConstraints([
      { priorite: "$$ENUM([bas;haut],bas)$$" },
    ]);
    expect(result.lockedKeys.has("priorite")).toBe(true);
    expect(result.lockedValues.has("priorite")).toBe(false);
    expect(result.enumConstraints.get("priorite")?.default).toBe("bas");
  });

  it("NUMBER format seul : verrouille la clé via numberFormatConstraints, jamais lockedValues", () => {
    const result = computeTemplateConstraints([
      { poids: '$$NUMBER(, decimals=1, unit="kg")$$' },
    ]);
    expect(result.lockedKeys.has("poids")).toBe(true);
    expect(result.lockedValues.has("poids")).toBe(false);
    expect(result.numberFormatConstraints.get("poids")).toEqual({
      expr: "",
      decimals: 1,
      unit: "kg",
    });
  });

  it("NUMBER avec expr non vide : reste une valeur imposée (lockedValues), pas une contrainte de format", () => {
    const result = computeTemplateConstraints([
      { distance: '$$NUMBER(10, decimals=2, unit="mi")$$' },
    ]);
    expect(result.lockedValues.has("distance")).toBe(true);
    expect(result.numberFormatConstraints.has("distance")).toBe(false);
  });

  it("fusionne les contraintes de plusieurs templates", () => {
    const result = computeTemplateConstraints([
      { a: "actif" },
      { b: "$$ENUM([x;y],x)$$" },
      { c: '$$NUMBER(, unit="km")$$' },
    ]);
    expect([...result.lockedKeys]).toEqual(["a", "b", "c"]);
    expect(result.lockedValues.has("a")).toBe(true);
    expect(result.enumConstraints.has("b")).toBe(true);
    expect(result.numberFormatConstraints.has("c")).toBe(true);
  });
});
