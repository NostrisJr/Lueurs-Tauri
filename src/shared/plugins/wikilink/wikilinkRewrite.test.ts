import { describe, expect, it } from "vitest";
import {
  rewriteMediaHrefs,
  rewriteNoteLinkHrefs,
  stripBrokenMediaLinks,
} from "./wikilinkRewrite";

describe("rewriteNoteLinkHrefs", () => {
  it("réécrit un lien simple", () => {
    const { body, changed } = rewriteNoteLinkHrefs(
      "voir [Note](old.md) pour plus",
      (href) => (href === "old.md" ? "new.md" : null)
    );
    expect(body).toBe("voir [Note](new.md) pour plus");
    expect(changed).toBe(true);
  });

  it("préserve le titre entre guillemets", () => {
    const { body } = rewriteNoteLinkHrefs(
      '[Note](old.md "Mon titre")',
      () => "new.md"
    );
    expect(body).toBe('[Note](new.md "Mon titre")');
  });

  it("préserve le wrapping <> pour un chemin avec espaces", () => {
    const { body } = rewriteNoteLinkHrefs(
      "[Note](<old file.md>)",
      () => "new file.md"
    );
    expect(body).toBe("[Note](<new file.md>)");
  });

  it("ajoute le wrapping <> si le nouveau chemin contient un espace", () => {
    const { body } = rewriteNoteLinkHrefs(
      "[Note](old.md)",
      () => "new file.md"
    );
    expect(body).toBe("[Note](<new file.md>)");
  });

  it("ignore les images", () => {
    const { body, changed } = rewriteNoteLinkHrefs(
      "![Alt](old.md)",
      () => "new.md"
    );
    expect(body).toBe("![Alt](old.md)");
    expect(changed).toBe(false);
  });

  it("ne modifie rien si mapHref renvoie null", () => {
    const { body, changed } = rewriteNoteLinkHrefs(
      "[Note](old.md)",
      () => null
    );
    expect(body).toBe("[Note](old.md)");
    expect(changed).toBe(false);
  });

  it("ne modifie rien si mapHref renvoie le même href", () => {
    const { changed } = rewriteNoteLinkHrefs("[Note](old.md)", (href) => href);
    expect(changed).toBe(false);
  });

  it("réécrit plusieurs liens dans le même corps", () => {
    const { body } = rewriteNoteLinkHrefs("[A](a.md) et [B](b.md)", (href) =>
      href === "a.md" ? "a2.md" : null
    );
    expect(body).toBe("[A](a2.md) et [B](b.md)");
  });
});

describe("rewriteMediaHrefs", () => {
  it("réécrit une image", () => {
    const { body, changed } = rewriteMediaHrefs("![Alt](old.png)", (href) =>
      href === "old.png" ? "new.png" : null
    );
    expect(body).toBe("![Alt](new.png)");
    expect(changed).toBe(true);
  });

  it("réécrit un lien audio (même syntaxe que les wikilinks)", () => {
    const { body, changed } = rewriteMediaHrefs("[Titre](old.mp3)", (href) =>
      href === "old.mp3" ? "new.mp3" : null
    );
    expect(body).toBe("[Titre](new.mp3)");
    expect(changed).toBe(true);
  });

  it("réécrit image et wikilink dans le même corps", () => {
    const { body } = rewriteMediaHrefs(
      "![Alt](old.png) et [Note](old.png)",
      (href) => (href === "old.png" ? "new.png" : null)
    );
    expect(body).toBe("![Alt](new.png) et [Note](new.png)");
  });

  it("préserve le wrapping <> pour une image dont le nouveau chemin a un espace", () => {
    const { body } = rewriteMediaHrefs("![Alt](old.png)", () => "new file.png");
    expect(body).toBe("![Alt](<new file.png>)");
  });
});

describe("stripBrokenMediaLinks", () => {
  it("remplace un wikilink par son texte surligné en rouge", () => {
    const { body, changed } = stripBrokenMediaLinks(
      "voir [Ma note](old.md) ici",
      (href) => href === "old.md"
    );
    expect(body).toBe("voir =={red}Ma note== ici");
    expect(changed).toBe(true);
  });

  it("remplace une image par son alt surligné en rouge", () => {
    const { body } = stripBrokenMediaLinks(
      "![Photo](old.png)",
      (href) => href === "old.png"
    );
    expect(body).toBe("=={red}Photo==");
  });

  it("retire entièrement une image sans alt", () => {
    const { body } = stripBrokenMediaLinks(
      "![](old.png)",
      (href) => href === "old.png"
    );
    expect(body).toBe("");
  });

  it("ne touche pas aux liens qui ne correspondent pas", () => {
    const raw = "[Autre](autre.md)";
    const { body, changed } = stripBrokenMediaLinks(
      raw,
      (href) => href === "old.md"
    );
    expect(body).toBe(raw);
    expect(changed).toBe(false);
  });

  it("gère plusieurs liens cassés dans le même corps", () => {
    const { body } = stripBrokenMediaLinks(
      "[A](old.md) et ![B](old.png)",
      (href) => href === "old.md" || href === "old.png"
    );
    expect(body).toBe("=={red}A== et =={red}B==");
  });
});
