import { describe, expect, it } from "vitest";
import { computeTableColumns } from "./tableColumns";

describe("computeTableColumns", () => {
  it("dérive une colonne texte non imposée depuis un template à valeur vide", () => {
    const columns = computeTableColumns(
      [{ id: "t1", frontmatter: { statut: "" } }],
      {}
    );
    expect(columns).toEqual([
      {
        key: "statut",
        isImposed: false,
        enumConstraint: undefined,
        numberFormatConstraint: undefined,
        width: 180,
        templatePaths: ["t1"],
      },
    ]);
  });

  it("marque la colonne imposée quand le template a une valeur non vide", () => {
    const columns = computeTableColumns(
      [{ id: "t1", frontmatter: { statut: "actif" } }],
      {}
    );
    expect(columns[0].isImposed).toBe(true);
  });

  it("ignore les champs système du template", () => {
    const columns = computeTableColumns(
      [{ id: "t1", frontmatter: { __Type__: "__template__", statut: "" } }],
      {}
    );
    expect(columns.map((c) => c.key)).toEqual(["statut"]);
  });

  it("ENUM : colonne non imposée avec enumConstraint, dropdown pas verrouillage de valeur", () => {
    const columns = computeTableColumns(
      [{ id: "t1", frontmatter: { priorite: "$$ENUM([bas;haut],bas)$$" } }],
      {}
    );
    expect(columns[0].isImposed).toBe(false);
    expect(columns[0].enumConstraint?.default).toBe("bas");
  });

  it("NUMBER format seul : colonne non imposée avec numberFormatConstraint", () => {
    const columns = computeTableColumns(
      [
        {
          id: "t1",
          frontmatter: { poids: '$$NUMBER(, decimals=1, unit="kg")$$' },
        },
      ],
      {}
    );
    expect(columns[0].isImposed).toBe(false);
    expect(columns[0].numberFormatConstraint).toEqual({
      expr: "",
      decimals: 1,
      unit: "kg",
    });
  });

  it("NUMBER avec expr non vide : colonne imposée, pas de numberFormatConstraint", () => {
    const columns = computeTableColumns(
      [
        {
          id: "t1",
          frontmatter: { distance: '$$NUMBER(10, decimals=2, unit="mi")$$' },
        },
      ],
      {}
    );
    expect(columns[0].isImposed).toBe(true);
    expect(columns[0].numberFormatConstraint).toBeUndefined();
  });

  it("union de plusieurs templates : premier template gagne pour l'ordre, fusionne templatePaths sur clé partagée", () => {
    const columns = computeTableColumns(
      [
        { id: "t1", frontmatter: { a: "x", commun: "actif" } },
        { id: "t2", frontmatter: { b: "y", commun: "actif" } },
      ],
      {}
    );
    expect(columns.map((c) => c.key)).toEqual(["a", "commun", "b"]);
    const commun = columns.find((c) => c.key === "commun");
    expect(commun?.templatePaths).toEqual(["t1", "t2"]);
  });

  it("applique les largeurs sauvegardées, sinon la largeur par défaut", () => {
    const columns = computeTableColumns(
      [{ id: "t1", frontmatter: { statut: "" } }],
      { statut: 240 }
    );
    expect(columns[0].width).toBe(240);
  });
});
