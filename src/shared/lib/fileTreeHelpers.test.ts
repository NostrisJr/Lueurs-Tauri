import { describe, expect, it } from "vitest";
import type {
  FolderNode,
  MediaFile,
  NoteFile,
  TreeNode,
} from "../hooks/useFileTree";
import {
  addNodeInTree,
  arraysEqualUnordered,
  classifyPathKind,
  deleteNodeInTree,
  findNodeById,
  frontmatterEqual,
  frontmatterFieldEqual,
  parseFrontmatter,
  renameNodeInTree,
  serializeFrontmatter,
  sortNodes,
  updateNodeInTree,
} from "./fileTreeHelpers";

// ── Fixtures ────────────────────────────────────────────────────────────────

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

function folder(
  id: string,
  name: string,
  children: TreeNode[] = []
): FolderNode {
  return { kind: "folder", id, name, children };
}

function media(id: string, fileName: string): MediaFile {
  return {
    kind: "media",
    id,
    name: fileName.replace(/\.[^.]+$/, ""),
    fileName,
    mediaType: "image",
  };
}

// ── parseFrontmatter / serializeFrontmatter ──────────────────────────────────

describe("parseFrontmatter", () => {
  it("renvoie un frontmatter vide et le markdown tel quel sans bloc ---", () => {
    const result = parseFrontmatter("# Titre\ncontenu");
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe("# Titre\ncontenu");
  });

  it("extrait les champs système et le corps", () => {
    const md = "---\n__Type__: __note__\nStatus: En cours\n---\n# Titre\n";
    const { frontmatter, body } = parseFrontmatter(md);
    expect(frontmatter).toEqual({ __Type__: "__note__", Status: "En cours" });
    expect(body).toBe("# Titre\n");
  });

  it("parse un tableau YAML en liste à puces", () => {
    const md = "---\ntags:\n  - a\n  - b\n---\ncorps";
    const { frontmatter } = parseFrontmatter(md);
    expect(frontmatter.tags).toEqual(["a", "b"]);
  });

  it("parse un tableau JSON inline", () => {
    const md = '---\n__Base__: ["base1.md","base2.md"]\n---\n';
    const { frontmatter } = parseFrontmatter(md);
    expect(frontmatter.__Base__).toEqual(["base1.md", "base2.md"]);
  });

  it("réassemble une formule $$...$$ cassée en liste par le YAML sur une virgule", () => {
    // Une formule contenant une virgule, une fois mal indentée par un éditeur YAML,
    // peut se retrouver éclatée en items de liste : on doit la recoller telle quelle.
    const md = '---\nTotal:\n  - $$round(self["a"]\n  - self["b"])$$\n---\n';
    const { frontmatter } = parseFrontmatter(md);
    expect(frontmatter.Total).toBe('$$round(self["a"], self["b"])$$');
  });

  it("traite une clé sans valeur comme chaîne vide", () => {
    const md = "---\nStatus:\n---\ncorps";
    const { frontmatter } = parseFrontmatter(md);
    expect(frontmatter.Status).toBe("");
  });

  it("dé-quote une valeur entre guillemets simples", () => {
    const md = "---\nRaw: '[1,2]'\n---\n";
    const { frontmatter } = parseFrontmatter(md);
    expect(frontmatter.Raw).toBe("[1,2]");
  });
});

describe("serializeFrontmatter", () => {
  it("renvoie le corps seul si le frontmatter est vide", () => {
    expect(serializeFrontmatter({}, "corps")).toBe("corps");
  });

  it("place les champs système avant les champs utilisateur", () => {
    const out = serializeFrontmatter(
      { Status: "En cours", __Type__: "__note__" },
      "corps"
    );
    const lines = out.split("\n");
    expect(lines[1]).toBe("__Type__: __note__");
    expect(lines[2]).toBe("Status: En cours");
  });

  it("sérialise un tableau en liste à puces", () => {
    const out = serializeFrontmatter({ tags: ["a", "b"] }, "corps");
    expect(out).toContain("tags:\n  - a\n  - b");
  });

  it("guillemette une formule $$...$$ pour protéger les virgules du YAML", () => {
    const out = serializeFrontmatter(
      { Total: '$$round(self["a"], 2)$$' },
      "corps"
    );
    expect(out).toContain("Total: '$$round(self[\"a\"], 2)$$'");
  });

  it("est l'inverse de parseFrontmatter (round-trip)", () => {
    const original = { __Type__: "__note__", tags: ["a", "b"], Status: "" };
    const serialized = serializeFrontmatter(original, "# Titre\n");
    const { frontmatter, body } = parseFrontmatter(serialized);
    expect(frontmatter).toEqual(original);
    expect(body).toBe("# Titre\n");
  });
});

// ── Égalité de frontmatter ────────────────────────────────────────────────

describe("arraysEqualUnordered", () => {
  it("ignore l'ordre des éléments", () => {
    expect(arraysEqualUnordered(["a", "b"], ["b", "a"])).toBe(true);
  });

  it("détecte une différence de longueur", () => {
    expect(arraysEqualUnordered(["a"], ["a", "b"])).toBe(false);
  });
});

describe("frontmatterFieldEqual", () => {
  it("compare deux tableaux dans l'ordre (un reorder est une vraie modif)", () => {
    expect(frontmatterFieldEqual(["a", "b"], ["b", "a"])).toBe(false);
    expect(frontmatterFieldEqual(["a", "b"], ["a", "b"])).toBe(true);
  });

  it("renvoie false si un seul des deux est un tableau", () => {
    expect(frontmatterFieldEqual(["a"], "a")).toBe(false);
  });

  it("renvoie false si un seul côté est undefined", () => {
    expect(frontmatterFieldEqual(undefined, "a")).toBe(false);
  });
});

describe("frontmatterEqual", () => {
  it("est insensible à l'ordre des clés", () => {
    expect(frontmatterEqual({ a: "1", b: "2" }, { b: "2", a: "1" })).toBe(true);
  });

  it("détecte une clé manquante", () => {
    expect(frontmatterEqual({ a: "1" }, { a: "1", b: "2" })).toBe(false);
  });
});

// ── Mutations de l'arbre ──────────────────────────────────────────────────

describe("sortNodes", () => {
  it("trie les dossiers avant les notes, puis alphabétiquement (locale FR)", () => {
    const nodes: TreeNode[] = [
      note({ id: "b.md", name: "Bravo" }),
      folder("z", "Zoulou"),
      note({ id: "a.md", name: "Alpha" }),
    ];
    const sorted = sortNodes(nodes);
    expect(sorted.map((n) => n.name)).toEqual(["Zoulou", "Alpha", "Bravo"]);
  });

  it("ne mute pas le tableau d'origine", () => {
    const nodes: TreeNode[] = [
      note({ id: "b.md", name: "B" }),
      note({ id: "a.md", name: "A" }),
    ];
    const original = [...nodes];
    sortNodes(nodes);
    expect(nodes).toEqual(original);
  });
});

describe("updateNodeInTree", () => {
  it("applique le patch au fichier ciblé, récursivement dans les dossiers", () => {
    const tree: TreeNode[] = [
      folder("dir", "Dossier", [
        note({ id: "n.md", name: "N", title: "Ancien" }),
      ]),
    ];
    const updated = updateNodeInTree(tree, "n.md", { title: "Nouveau" });
    const child = (updated[0] as FolderNode).children[0] as NoteFile;
    expect(child.title).toBe("Nouveau");
  });

  it("laisse les autres nœuds inchangés", () => {
    const untouched = note({ id: "other.md", name: "Other" });
    const tree: TreeNode[] = [untouched, note({ id: "n.md" })];
    const updated = updateNodeInTree(tree, "n.md", { title: "X" });
    expect(updated[0]).toBe(untouched);
  });
});

describe("renameNodeInTree", () => {
  it("renomme id et name puis retrie", () => {
    const tree: TreeNode[] = [
      note({ id: "b.md", name: "Bravo" }),
      note({ id: "a.md", name: "Alpha" }),
    ];
    const renamed = renameNodeInTree(tree, "a.md", "z.md", "Zoulou");
    expect(renamed.map((n) => n.name)).toEqual(["Bravo", "Zoulou"]);
    expect(renamed[1].id).toBe("z.md");
  });
});

describe("deleteNodeInTree", () => {
  it("supprime le nœud ciblé récursivement", () => {
    const tree: TreeNode[] = [folder("dir", "Dossier", [note({ id: "n.md" })])];
    const result = deleteNodeInTree(tree, "n.md");
    expect((result[0] as FolderNode).children).toEqual([]);
  });
});

describe("findNodeById", () => {
  it("trouve une note à la racine", () => {
    const tree: TreeNode[] = [note({ id: "a.md", name: "A" })];
    expect(findNodeById(tree, "a.md")?.name).toBe("A");
  });

  it("trouve un dossier par son propre id", () => {
    const tree: TreeNode[] = [folder("dir", "Dossier")];
    expect(findNodeById(tree, "dir")?.kind).toBe("folder");
  });

  it("trouve un nœud imbriqué récursivement, quel que soit son kind", () => {
    const tree: TreeNode[] = [
      folder("dir", "Dossier", [
        note({ id: "dir/n.md", name: "N" }),
        media("dir/photo.png", "photo.png"),
      ]),
    ];
    expect(findNodeById(tree, "dir/n.md")?.kind).toBe("file");
    expect(findNodeById(tree, "dir/photo.png")?.kind).toBe("media");
  });

  it("renvoie null si l'id est absent de l'arbre", () => {
    const tree: TreeNode[] = [note({ id: "a.md" })];
    expect(findNodeById(tree, "inconnu.md")).toBeNull();
  });
});

describe("addNodeInTree", () => {
  it("ajoute et trie sous le dossier parent ciblé", () => {
    const tree: TreeNode[] = [
      folder("dir", "Dossier", [note({ id: "b.md", name: "Bravo" })]),
    ];
    const result = addNodeInTree(
      tree,
      "dir",
      note({ id: "a.md", name: "Alpha" })
    );
    const children = (result[0] as FolderNode).children;
    expect(children.map((n) => n.name)).toEqual(["Alpha", "Bravo"]);
  });

  it("ajoute à la racine quand parentId === rootId", () => {
    const tree: TreeNode[] = [note({ id: "b.md", name: "Bravo" })];
    const result = addNodeInTree(
      tree,
      "__root__",
      note({ id: "a.md", name: "Alpha" }),
      "__root__"
    );
    expect(result.map((n) => n.name)).toEqual(["Alpha", "Bravo"]);
  });
});

describe("classifyPathKind", () => {
  it("reconnaît une note (.md)", () => {
    expect(classifyPathKind("/vault/dossier/note.md")).toBe("note");
  });

  it("reconnaît un média (autre extension)", () => {
    expect(classifyPathKind("/vault/resources/photo.png")).toBe("media");
    expect(classifyPathKind("/vault/resources/son.mp3")).toBe("media");
  });

  it("reconnaît un dossier (pas d'extension)", () => {
    expect(classifyPathKind("/vault/Mon dossier")).toBe("folder");
  });

  it("ne confond pas un nom de dossier avec un point pour une extension inexistante", () => {
    expect(classifyPathKind("/vault/Dossier v2.1")).toBe("media");
  });
});
