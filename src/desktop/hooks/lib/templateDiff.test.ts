import { describe, expect, it } from "vitest";
import type { Frontmatter } from "../../../shared/lib/fileTreeHelpers";
import { applyRenameConflict, diffFrontmatter } from "./templateDiff";

describe("diffFrontmatter", () => {
  it("ajoute une prop texte simple avec sa valeur", () => {
    const changes = diffFrontmatter({}, { statut: "actif" });
    expect(changes).toEqual([
      { type: "addProp", key: "statut", value: "actif" },
    ]);
  });

  it("supprime une prop absente du prochain état", () => {
    const changes = diffFrontmatter({ statut: "actif" }, {});
    expect(changes).toEqual([{ type: "removeProp", key: "statut" }]);
  });

  it("force la valeur quand une prop texte change", () => {
    const changes = diffFrontmatter(
      { statut: "brouillon" },
      { statut: "actif" }
    );
    expect(changes).toEqual([
      { type: "forceValue", key: "statut", value: "actif" },
    ]);
  });

  it("ENUM : addProp reçoit le default, jamais la formule", () => {
    const changes = diffFrontmatter(
      {},
      { priorite: "$$ENUM([bas;haut],bas)$$" }
    );
    expect(changes).toEqual([
      { type: "addProp", key: "priorite", value: "bas" },
    ]);
  });

  it("ENUM : un changement de valeur ne force jamais (pas de forceValue)", () => {
    const changes = diffFrontmatter(
      { priorite: "$$ENUM([bas;haut],bas)$$" },
      { priorite: "$$ENUM([bas;haut;moyen],bas)$$" }
    );
    expect(changes.every((c) => c.type !== "forceValue")).toBe(true);
  });

  it("NUMBER format seul : addProp reçoit un littéral amorcé à 0 avec le format, jamais la formule vide", () => {
    const changes = diffFrontmatter(
      {},
      { poids: '$$NUMBER(, decimals=1, unit="kg")$$' }
    );
    expect(changes).toEqual([
      {
        type: "addProp",
        key: "poids",
        value: '$$NUMBER(0, decimals=1, unit="kg")$$',
      },
    ]);
  });

  it("NUMBER format seul : un changement de format produit forceNumberFormat, jamais forceValue", () => {
    const changes = diffFrontmatter(
      { poids: '$$NUMBER(, decimals=1, unit="kg")$$' },
      { poids: '$$NUMBER(, decimals=2, unit="g")$$' }
    );
    expect(changes).toEqual([
      { type: "forceNumberFormat", key: "poids", decimals: 2, unit: "g" },
    ]);
  });

  it("NUMBER avec expr non vide : reste un forceValue classique (valeur imposée en bloc)", () => {
    const changes = diffFrontmatter(
      { distance: '$$NUMBER(5, unit="km")$$' },
      { distance: '$$NUMBER(10, unit="km")$$' }
    );
    expect(changes).toEqual([
      {
        type: "forceValue",
        key: "distance",
        value: '$$NUMBER(10, unit="km")$$',
      },
    ]);
  });

  it("renommage simple (une ajoutée + une retirée) : préserve la valeur du template en template_value", () => {
    const changes = diffFrontmatter(
      { ancien: "valeur" },
      { nouveau: "valeur" }
    );
    expect(changes).toEqual([
      {
        type: "renameProp",
        old_key: "ancien",
        new_key: "nouveau",
        template_value: "valeur",
      },
    ]);
  });

  it("renommage : ENUM traité comme contrainte (template_value vide)", () => {
    const changes = diffFrontmatter(
      { ancien: "valeur" },
      { nouveau: "$$ENUM([a;b],a)$$" }
    );
    expect(changes).toEqual([
      {
        type: "renameProp",
        old_key: "ancien",
        new_key: "nouveau",
        template_value: "",
      },
    ]);
  });

  it("renommage : NUMBER format seul traité comme contrainte (template_value vide), au même titre que ENUM", () => {
    const changes = diffFrontmatter(
      { ancien: "valeur" },
      { nouveau: '$$NUMBER(, unit="kg")$$' }
    );
    expect(changes).toEqual([
      {
        type: "renameProp",
        old_key: "ancien",
        new_key: "nouveau",
        template_value: "",
      },
    ]);
  });
});

describe("applyRenameConflict", () => {
  const fm: Frontmatter = { a: "valeur A", b: "valeur B" };

  it("pas de conflit : renomme en préservant la valeur de old_key", () => {
    expect(applyRenameConflict(fm, "a", "c", "peu importe")).toEqual({
      b: "valeur B",
      c: "valeur A",
    });
  });

  it("conflit + valeur imposée (templateValue non vide) : le template prime", () => {
    expect(applyRenameConflict(fm, "a", "b", "valeur imposée")).toEqual({
      b: "valeur imposée",
    });
  });

  it("conflit + contrainte seule (templateValue vide, ex: ENUM/NUMBER format) : la valeur existante prime", () => {
    expect(applyRenameConflict(fm, "a", "b", "")).toEqual({ b: "valeur A" });
  });

  it("conflit + contrainte seule + old_key vide : adopte la valeur existante de new_key", () => {
    const fmWithEmpty: Frontmatter = { a: "", b: "valeur B" };
    expect(applyRenameConflict(fmWithEmpty, "a", "b", "")).toEqual({
      b: "valeur B",
    });
  });
});
