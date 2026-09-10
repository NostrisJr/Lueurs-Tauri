import { describe, expect, it } from "vitest";
import {
  addOption,
  createEmptyEnumDef,
  diffEnumOptions,
  enumValueState,
  isEnumFormula,
  optionColor,
  optionValues,
  parseEnum,
  removeOption,
  serializeEnum,
  updateOptionValue,
} from "./enumProperty";

describe("isEnumFormula", () => {
  it("reconnaît la syntaxe ENUM(...)", () => {
    expect(isEnumFormula("$$ENUM([a;b;c],a)$$")).toBe(true);
    expect(isEnumFormula("$$ENUM([a])$$")).toBe(true);
  });

  it("rejette une formule ou un texte quelconque", () => {
    expect(isEnumFormula('$$self["a"] + 1$$')).toBe(false);
    expect(isEnumFormula("$$NUMBER(42)$$")).toBe(false);
    expect(isEnumFormula(undefined)).toBe(false);
  });
});

describe("parseEnum", () => {
  it("parse une liste d'options sans couleur, default explicite", () => {
    expect(parseEnum("$$ENUM([a;b;c],b)$$")).toEqual({
      options: [{ value: "a" }, { value: "b" }, { value: "c" }],
      default: "b",
    });
  });

  it("default omis → première valeur", () => {
    expect(parseEnum("$$ENUM([a;b;c])$$")).toEqual({
      options: [{ value: "a" }, { value: "b" }, { value: "c" }],
      default: "a",
    });
  });

  it("parse une option colorée ==label== et =={color}label==", () => {
    const def = parseEnum("$$ENUM([==a==;=={green}b==],a)$$");
    expect(def?.options[1]).toEqual({ value: "b", color: "green" });
  });

  it("renvoie null si la syntaxe ne correspond pas", () => {
    expect(parseEnum('$$self["a"]$$')).toBeNull();
    expect(parseEnum("texte simple")).toBeNull();
  });
});

describe("serializeEnum", () => {
  it("round-trip options + default", () => {
    const def = { options: [{ value: "a" }, { value: "b" }], default: "b" };
    expect(parseEnum(serializeEnum(def))).toEqual(def);
  });

  it("round-trip avec couleur", () => {
    const def = {
      options: [{ value: "a", color: "green" }],
      default: "a",
    };
    expect(parseEnum(serializeEnum(def))).toEqual(def);
  });
});

describe("diffEnumOptions", () => {
  it("détecte un renommage (une retirée + une ajoutée)", () => {
    const prev = { options: [{ value: "a" }, { value: "b" }], default: "a" };
    const next = { options: [{ value: "a" }, { value: "c" }], default: "a" };
    expect(diffEnumOptions(prev, next)).toEqual({
      renames: [{ old: "b", new: "c" }],
      added: [],
      removed: [],
    });
  });

  it("détecte ajout/retrait simples sinon", () => {
    const prev = { options: [{ value: "a" }], default: "a" };
    const next = {
      options: [{ value: "a" }, { value: "b" }, { value: "c" }],
      default: "a",
    };
    expect(diffEnumOptions(prev, next)).toEqual({
      renames: [],
      added: ["b", "c"],
      removed: [],
    });
  });
});

describe("optionValues / optionColor", () => {
  it("extrait les valeurs et la couleur d'une option", () => {
    const def = {
      options: [{ value: "a", color: "green" }, { value: "b" }],
      default: "a",
    };
    expect(optionValues(def)).toEqual(["a", "b"]);
    expect(optionColor("a", def)).toBe("green");
    expect(optionColor("b", def)).toBeUndefined();
  });
});

describe("enumValueState", () => {
  const def = { options: [{ value: "a" }, { value: "b" }], default: "a" };

  it("valid si la valeur est dans les options", () => {
    expect(enumValueState("a", def)).toBe("valid");
  });

  it("placeholder si la valeur === default hors-liste", () => {
    const offList = { options: [{ value: "a" }], default: "x" };
    expect(enumValueState("x", offList)).toBe("placeholder");
  });

  it("invalid sinon", () => {
    expect(enumValueState("z", def)).toBe("invalid");
  });
});

describe("createEmptyEnumDef", () => {
  it("renvoie une définition vide", () => {
    expect(createEmptyEnumDef()).toEqual({ options: [], default: "" });
  });
});

describe("addOption", () => {
  it("ajoute une option vierge en fin de liste", () => {
    const def = { options: [{ value: "a" }], default: "a" };
    expect(addOption(def)).toEqual({
      options: [{ value: "a" }, { value: "" }],
      default: "a",
    });
  });
});

describe("removeOption", () => {
  it("retire l'option visée sans toucher au default si ce n'était pas elle", () => {
    const def = {
      options: [{ value: "a" }, { value: "b" }],
      default: "a",
    };
    expect(removeOption(def, 1)).toEqual({
      options: [{ value: "a" }],
      default: "a",
    });
  });

  it("retombe sur la première option restante si le default est retiré", () => {
    const def = {
      options: [{ value: "a" }, { value: "b" }],
      default: "a",
    };
    expect(removeOption(def, 0)).toEqual({
      options: [{ value: "b" }],
      default: "b",
    });
  });

  it("retombe sur '' si plus aucune option ne reste", () => {
    const def = { options: [{ value: "a" }], default: "a" };
    expect(removeOption(def, 0)).toEqual({ options: [], default: "" });
  });
});

describe("updateOptionValue", () => {
  it("renomme l'option visée", () => {
    const def = { options: [{ value: "a" }], default: "a" };
    expect(updateOptionValue(def, 0, "aa")).toEqual({
      options: [{ value: "aa" }],
      default: "aa",
    });
  });

  it("le default suit le renommage de l'option qui le portait", () => {
    const def = {
      options: [{ value: "a" }, { value: "b" }],
      default: "b",
    };
    expect(updateOptionValue(def, 1, "bb")).toEqual({
      options: [{ value: "a" }, { value: "bb" }],
      default: "bb",
    });
  });

  it("laisse le default inchangé si une autre option est renommée", () => {
    const def = {
      options: [{ value: "a" }, { value: "b" }],
      default: "a",
    };
    expect(updateOptionValue(def, 1, "bb")).toEqual({
      options: [{ value: "a" }, { value: "bb" }],
      default: "a",
    });
  });

  it("première option ajoutée (vierge) devient default dès qu'on la nomme", () => {
    // Cas réel : createEmptyEnumDef() + addOption() → default et la
    // nouvelle option valent tous deux "" → updateOptionValue les fait suivre.
    const def = addOption(createEmptyEnumDef());
    expect(updateOptionValue(def, 0, "a")).toEqual({
      options: [{ value: "a" }],
      default: "a",
    });
  });
});
