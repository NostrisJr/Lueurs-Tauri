import { describe, expect, it } from "vitest";
import {
  relativizeRefPaths,
  rewriteRefPaths,
  toVaultRelative,
} from "./refPaths";

describe("toVaultRelative", () => {
  it("retire le préfixe du vault", () => {
    expect(toVaultRelative("/vault/resources/img.png", "/vault")).toBe(
      "resources/img.png"
    );
  });

  it("gère un vaultPath déjà terminé par un /", () => {
    expect(toVaultRelative("/vault/resources/img.png", "/vault/")).toBe(
      "resources/img.png"
    );
  });

  it("est idempotent (chemin déjà relatif inchangé)", () => {
    expect(toVaultRelative("resources/img.png", "/vault")).toBe(
      "resources/img.png"
    );
  });

  it("laisse inchangé un chemin hors du vault", () => {
    expect(toVaultRelative("/autre/img.png", "/vault")).toBe("/autre/img.png");
  });
});

describe("relativizeRefPaths", () => {
  it("relativise un ref() absolu", () => {
    const result = relativizeRefPaths(
      'ref("/vault/note.md")["prop"]',
      "/vault"
    );
    expect(result).toBe('ref("note.md")["prop"]');
  });

  it("relativise plusieurs ref() dans la même formule", () => {
    const result = relativizeRefPaths(
      'ref("/vault/a.md")["x"] + ref("/vault/b.md")["y"]',
      "/vault"
    );
    expect(result).toBe('ref("a.md")["x"] + ref("b.md")["y"]');
  });

  it("renvoie la formule inchangée si vaultPath est null ou undefined", () => {
    const raw = 'ref("/vault/note.md")["prop"]';
    expect(relativizeRefPaths(raw, null)).toBe(raw);
    expect(relativizeRefPaths(raw, undefined)).toBe(raw);
  });

  it("ne modifie pas une formule sans ref()", () => {
    const raw = 'self["prop"] + 1';
    expect(relativizeRefPaths(raw, "/vault")).toBe(raw);
  });
});

describe("rewriteRefPaths", () => {
  it("réécrit un ref() dont le chemin correspond", () => {
    const result = rewriteRefPaths('ref("old.md")["prop"]', (p) =>
      p === "old.md" ? "new.md" : null
    );
    expect(result).toBe('ref("new.md")["prop"]');
  });

  it("laisse inchangé un ref() qui ne correspond pas", () => {
    const raw = 'ref("autre.md")["prop"]';
    expect(
      rewriteRefPaths(raw, (p) => (p === "old.md" ? "new.md" : null))
    ).toBe(raw);
  });

  it("réécrit plusieurs ref() dans la même formule", () => {
    const result = rewriteRefPaths(
      'ref("a.md")["x"] + ref("b.md")["y"]',
      (p) => (p === "a.md" ? "a2.md" : null)
    );
    expect(result).toBe('ref("a2.md")["x"] + ref("b.md")["y"]');
  });

  it("fonctionne aussi sur des chemins absolus (frontmatter)", () => {
    const result = rewriteRefPaths('ref("/vault/old.md")["prop"]', (p) =>
      p === "/vault/old.md" ? "/vault/new.md" : null
    );
    expect(result).toBe('ref("/vault/new.md")["prop"]');
  });

  it("ne modifie pas une formule sans ref()", () => {
    const raw = 'self["prop"] + 1';
    expect(rewriteRefPaths(raw, () => "peu importe")).toBe(raw);
  });
});
