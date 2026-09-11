import { describe, expect, it } from "vitest";
import { SystemField } from "../noteTypes";
import {
  bakeNoteFormulas,
  buildDirTree,
  collectFormulaRefPaths,
  collectNoteRefPaths,
  collectResourceRefs,
  collectWikilinkTargets,
  dedupeName,
  resourceSubDir,
  rewriteFormulaRefPaths,
  rewriteResourceRefs,
  rewriteWikilinkRefs,
  sanitizeResourceName,
  scanBrokenRefs,
  tagSpace,
  unlinkWikilinks,
} from "./bundleShared";

describe("collectResourceRefs", () => {
  it("détecte une image", () => {
    expect(collectResourceRefs("![alt](resources/images/photo.png)")).toEqual([
      "resources/images/photo.png",
    ]);
  });

  it("détecte un lien audio (même syntaxe qu'un wikilink, désambiguïsé par extension)", () => {
    expect(collectResourceRefs("[Titre](resources/audio/voix.mp3)")).toEqual([
      "resources/audio/voix.mp3",
    ]);
  });

  it("ignore un wikilink vers une autre note", () => {
    expect(collectResourceRefs("[Autre note](Notes/autre.md)")).toEqual([]);
  });

  it("ignore un lien sans extension reconnue", () => {
    expect(collectResourceRefs("[Site](https://exemple.fr)")).toEqual([]);
  });

  it("déduplique les références répétées à la même ressource", () => {
    const body =
      "![a](resources/images/x.png) puis ![b](resources/images/x.png)";
    expect(collectResourceRefs(body)).toEqual(["resources/images/x.png"]);
  });

  it("collecte plusieurs ressources distinctes", () => {
    const body =
      "![img](resources/images/a.png)\n\n[son](resources/audio/b.mp3)";
    expect(collectResourceRefs(body)).toEqual([
      "resources/images/a.png",
      "resources/audio/b.mp3",
    ]);
  });

  it("ignore le contenu sans lien", () => {
    expect(collectResourceRefs("simple texte sans lien")).toEqual([]);
  });
});

describe("rewriteResourceRefs", () => {
  it("réécrit une image mappée", () => {
    const mapping = new Map([
      ["resources/images/a.png", "resources/images/b.png"],
    ]);
    expect(rewriteResourceRefs("![alt](resources/images/a.png)", mapping)).toBe(
      "![alt](resources/images/b.png)"
    );
  });

  it("réécrit un lien audio mappé", () => {
    const mapping = new Map([
      ["resources/audio/a.mp3", "resources/audio/b.mp3"],
    ]);
    expect(rewriteResourceRefs("[Titre](resources/audio/a.mp3)", mapping)).toBe(
      "[Titre](resources/audio/b.mp3)"
    );
  });

  it("laisse un wikilink vers une note inchangé même si son href apparaît dans le mapping", () => {
    const mapping = new Map([
      ["Notes/autre.md", "resources/images/leurre.png"],
    ]);
    expect(rewriteResourceRefs("[Autre](Notes/autre.md)", mapping)).toBe(
      "[Autre](Notes/autre.md)"
    );
  });

  it("laisse une ressource non présente dans le mapping inchangée", () => {
    const mapping = new Map<string, string>();
    expect(rewriteResourceRefs("![alt](resources/images/a.png)", mapping)).toBe(
      "![alt](resources/images/a.png)"
    );
  });

  it("préserve le titre entre guillemets", () => {
    const mapping = new Map([
      ["resources/images/a.png", "resources/images/b.png"],
    ]);
    const body = '![alt](resources/images/a.png "Mon titre")';
    expect(rewriteResourceRefs(body, mapping)).toBe(
      '![alt](resources/images/b.png "Mon titre")'
    );
  });
});

describe("resourceSubDir", () => {
  it("classe les extensions image", () => {
    expect(resourceSubDir("photo.png")).toBe("images");
    expect(resourceSubDir("photo.JPG")).toBe("images");
  });

  it("classe les extensions audio", () => {
    expect(resourceSubDir("voix.mp3")).toBe("audio");
  });

  it("renvoie null pour une extension non embarquable (vidéo, note, inconnue)", () => {
    expect(resourceSubDir("clip.mp4")).toBeNull();
    expect(resourceSubDir("note.md")).toBeNull();
    expect(resourceSubDir("archive.zip")).toBeNull();
  });
});

describe("dedupeName", () => {
  it("renvoie le nom tel quel en l'absence de collision", () => {
    expect(dedupeName(new Set(), "photo.png")).toBe("photo.png");
  });

  it("suffixe ( 2) sur une première collision, en préservant l'extension", () => {
    expect(dedupeName(new Set(["photo.png"]), "photo.png")).toBe(
      "photo (2).png"
    );
  });

  it("incrémente tant qu'il y a collision", () => {
    const existing = new Set(["photo.png", "photo (2).png", "photo (3).png"]);
    expect(dedupeName(existing, "photo.png")).toBe("photo (4).png");
  });

  it("gère un nom sans extension", () => {
    expect(dedupeName(new Set(["fichier"]), "fichier")).toBe("fichier (2)");
  });
});

describe("sanitizeResourceName", () => {
  it("laisse un nom déjà valide inchangé", () => {
    expect(sanitizeResourceName("photo_01.png")).toBe("photo_01.png");
  });

  it("remplace les caractères non autorisés (espaces, accents) par _", () => {
    expect(sanitizeResourceName("photo été 2024.png")).toBe(
      "photo__t__2024.png"
    );
  });
});

// Uint8Array factice : buildDirTree ne regarde que les clés, pas le contenu.
const DUMMY = new Uint8Array();

describe("buildDirTree", () => {
  it("regroupe les fichiers directement sous le préfixe racine", () => {
    const files = {
      "tree/Recettes/Recettes.md": DUMMY,
      "tree/Recettes/Tarte.md": DUMMY,
      "resources/images/x.png": DUMMY,
      "manifest.json": DUMMY,
    };
    const tree = buildDirTree(files, "tree/Recettes/");
    expect(tree.files.map((f) => f.name).sort()).toEqual([
      "Recettes.md",
      "Tarte.md",
    ]);
    expect(tree.subDirs.size).toBe(0);
  });

  it("crée récursivement les sous-dossiers", () => {
    const files = {
      "tree/Recettes/Recettes.md": DUMMY,
      "tree/Recettes/Sous-dossier/Sous-dossier.md": DUMMY,
      "tree/Recettes/Sous-dossier/Autre.md": DUMMY,
    };
    const tree = buildDirTree(files, "tree/Recettes/");
    expect(tree.files.map((f) => f.name)).toEqual(["Recettes.md"]);
    const sub = tree.subDirs.get("Sous-dossier");
    expect(sub).toBeDefined();
    expect(sub?.files.map((f) => f.name).sort()).toEqual([
      "Autre.md",
      "Sous-dossier.md",
    ]);
  });

  it("préserve la clé zip d'origine pour chaque fichier", () => {
    const files = { "tree/Recettes/Tarte.md": DUMMY };
    const tree = buildDirTree(files, "tree/Recettes/");
    expect(tree.files[0]).toEqual({
      name: "Tarte.md",
      key: "tree/Recettes/Tarte.md",
    });
  });

  it("ignore les entrées hors du préfixe racine", () => {
    const files = {
      "tree/Autre/Note.md": DUMMY,
      "manifest.json": DUMMY,
    };
    const tree = buildDirTree(files, "tree/Recettes/");
    expect(tree.files).toEqual([]);
    expect(tree.subDirs.size).toBe(0);
  });

  it("ignore une entrée égale au préfixe exact (dossier vide sans nom de fichier)", () => {
    const files = { "tree/Recettes/": DUMMY };
    const tree = buildDirTree(files, "tree/Recettes/");
    expect(tree.files).toEqual([]);
  });
});

describe("tagSpace", () => {
  it("laisse le frontmatter inchangé si space est absent", () => {
    const fm = { Status: "ok" };
    expect(tagSpace(fm, null)).toBe(fm);
    expect(tagSpace(fm, undefined)).toBe(fm);
  });

  it("ajoute l'espace à un frontmatter sans __Space__", () => {
    const fm = tagSpace({}, "Perso");
    expect(fm[SystemField.SPACE]).toEqual(["Perso"]);
  });

  it("ajoute l'espace à une liste __Space__ existante", () => {
    const fm = tagSpace({ [SystemField.SPACE]: ["Travail"] }, "Perso");
    expect(fm[SystemField.SPACE]).toEqual(["Travail", "Perso"]);
  });

  it("ne duplique pas un espace déjà présent", () => {
    const fm = tagSpace({ [SystemField.SPACE]: ["Perso"] }, "Perso");
    expect(fm[SystemField.SPACE]).toEqual(["Perso"]);
  });
});

describe("collectWikilinkTargets", () => {
  it("détecte un wikilink", () => {
    expect(collectWikilinkTargets("[Autre](Notes/autre.md)")).toEqual([
      "Notes/autre.md",
    ]);
  });

  it("ignore une image ou un lien audio", () => {
    expect(collectWikilinkTargets("![alt](resources/images/x.png)")).toEqual(
      []
    );
    expect(collectWikilinkTargets("[son](resources/audio/x.mp3)")).toEqual([]);
  });

  it("ignore un lien externe", () => {
    expect(collectWikilinkTargets("[Site](https://exemple.fr)")).toEqual([]);
  });
});

describe("unlinkWikilinks", () => {
  it("retire le lien et garde le libellé pour une cible visée", () => {
    const body = unlinkWikilinks(
      "voir [Autre note](Notes/autre.md) ici",
      new Set(["Notes/autre.md"])
    );
    expect(body).toBe("voir Autre note ici");
  });

  it("laisse un wikilink hors cible inchangé", () => {
    const body = unlinkWikilinks(
      "[Note](Notes/n.md)",
      new Set(["Notes/autre.md"])
    );
    expect(body).toBe("[Note](Notes/n.md)");
  });

  it("laisse une image inchangée même si son chemin est visé", () => {
    const body = unlinkWikilinks(
      "![alt](resources/images/x.png)",
      new Set(["resources/images/x.png"])
    );
    expect(body).toBe("![alt](resources/images/x.png)");
  });
});

describe("rewriteWikilinkRefs", () => {
  it("réécrit le href d'un wikilink mappé", () => {
    const mapping = new Map([["Notes/autre.md", "Références/autre.md"]]);
    expect(rewriteWikilinkRefs("[Autre](Notes/autre.md)", mapping)).toBe(
      "[Autre](Références/autre.md)"
    );
  });

  it("laisse une image inchangée même mappée", () => {
    const mapping = new Map([["resources/images/x.png", "ailleurs.png"]]);
    expect(rewriteWikilinkRefs("![alt](resources/images/x.png)", mapping)).toBe(
      "![alt](resources/images/x.png)"
    );
  });
});

describe("collectFormulaRefPaths", () => {
  it("extrait un chemin ref()", () => {
    expect(collectFormulaRefPaths('$$ref("Notes/a.md")["x"]$$')).toEqual([
      "Notes/a.md",
    ]);
  });

  it("extrait plusieurs chemins distincts", () => {
    const paths = collectFormulaRefPaths('ref("a.md")["x"] + ref("b.md")["y"]');
    expect(paths).toEqual(["a.md", "b.md"]);
  });

  it("renvoie un tableau vide sans ref()", () => {
    expect(collectFormulaRefPaths('$$self["x"] + 1$$')).toEqual([]);
  });
});

describe("rewriteFormulaRefPaths", () => {
  it("réécrit un chemin ref() mappé", () => {
    const mapping = new Map([["a.md", "Références/a.md"]]);
    expect(rewriteFormulaRefPaths('ref("a.md")["x"]', mapping)).toBe(
      'ref("Références/a.md")["x"]'
    );
  });

  it("laisse un chemin non mappé inchangé", () => {
    const raw = 'ref("a.md")["x"]';
    expect(rewriteFormulaRefPaths(raw, new Map())).toBe(raw);
  });
});

describe("collectNoteRefPaths", () => {
  it("collecte les ref() du frontmatter et du corps, dédupliqués", () => {
    const paths = collectNoteRefPaths(
      { Total: '$$ref("a.md")["x"]$$' },
      'texte $$ref("a.md")["x"] + ref("b.md")["y"]$$'
    );
    expect(paths.sort()).toEqual(["a.md", "b.md"]);
  });

  it("renvoie un tableau vide sans formule", () => {
    expect(collectNoteRefPaths({ Status: "ok" }, "corps simple")).toEqual([]);
  });
});

describe("scanBrokenRefs", () => {
  it("ne signale rien si toutes les cibles sont incluses", () => {
    const notes = [{ frontmatter: {}, body: "[Autre](Notes/autre.md)" }];
    const result = scanBrokenRefs(notes, new Set(["Notes/autre.md"]));
    expect(result.wikilinks).toEqual([]);
    expect(result.formulas).toEqual([]);
  });

  it("signale un wikilink et une formule pointant hors du bundle", () => {
    const notes = [
      {
        frontmatter: { Total: '$$ref("Base/prix.md")["x"]$$' },
        body: "[Autre](Notes/autre.md)",
      },
    ];
    const result = scanBrokenRefs(notes, new Set());
    expect(result.wikilinks).toEqual(["Notes/autre.md"]);
    expect(result.formulas).toEqual(["Base/prix.md"]);
  });

  it("agrège sur plusieurs notes sans doublon", () => {
    const notes = [
      { frontmatter: {}, body: "[A](x.md)" },
      { frontmatter: {}, body: "[B](x.md)" },
    ];
    const result = scanBrokenRefs(notes, new Set());
    expect(result.wikilinks).toEqual(["x.md"]);
  });
});

describe("bakeNoteFormulas", () => {
  it("fige une propriété frontmatter dont la formule référence une note exclue", () => {
    const { frontmatter } = bakeNoteFormulas(
      { Total: '$$ref("Base/prix.md")["x"]$$' },
      "",
      new Set(["Base/prix.md"]),
      () => "42"
    );
    expect(frontmatter.Total).toBe("42");
  });

  it("laisse une propriété formule dont les ref() sont tous inclus", () => {
    const { frontmatter } = bakeNoteFormulas(
      { Total: '$$ref("Base/prix.md")["x"]$$' },
      "",
      new Set(),
      () => "42"
    );
    expect(frontmatter.Total).toBe('$$ref("Base/prix.md")["x"]$$');
  });

  it("laisse une propriété non-formule inchangée", () => {
    const { frontmatter } = bakeNoteFormulas(
      { Status: "ok" },
      "",
      new Set(["a.md"]),
      () => "42"
    );
    expect(frontmatter.Status).toBe("ok");
  });

  it("fige une formule inline du corps référençant une note exclue", () => {
    const { body } = bakeNoteFormulas(
      {},
      'avant $$ref("a.md")["x"] + 1$$ après',
      new Set(["a.md"]),
      () => "5"
    );
    expect(body).toBe("avant 5 après");
  });

  it("laisse une formule inline sans ref() exclu inchangée", () => {
    const { body } = bakeNoteFormulas(
      {},
      '$$self["x"] + 1$$',
      new Set(["a.md"]),
      () => "5"
    );
    expect(body).toBe('$$self["x"] + 1$$');
  });
});
