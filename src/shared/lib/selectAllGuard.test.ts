import { describe, expect, it } from "vitest";
import { isSelectAllShortcut, isTextEditingTarget } from "./selectAllGuard";

describe("isTextEditingTarget", () => {
  it("reconnaît input, textarea et contenteditable", () => {
    expect(isTextEditingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTextEditingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(
      isTextEditingTarget({ tagName: "DIV", isContentEditable: true })
    ).toBe(true);
  });

  it("refuse le chrome de l'UI et l'absence de cible", () => {
    expect(
      isTextEditingTarget({ tagName: "DIV", isContentEditable: false })
    ).toBe(false);
    expect(isTextEditingTarget({ tagName: "BODY" })).toBe(false);
    expect(isTextEditingTarget(null)).toBe(false);
  });
});

describe("isSelectAllShortcut", () => {
  it("détecte Cmd+A et Ctrl+A, insensible à la casse", () => {
    expect(
      isSelectAllShortcut({
        key: "a",
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      })
    ).toBe(true);
    expect(
      isSelectAllShortcut({
        key: "A",
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
      })
    ).toBe(true);
  });

  it("ignore les combinaisons avec Shift/Alt et l'absence de modificateur", () => {
    expect(
      isSelectAllShortcut({
        key: "a",
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
      })
    ).toBe(false);
    expect(
      isSelectAllShortcut({
        key: "a",
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: true,
      })
    ).toBe(false);
    expect(
      isSelectAllShortcut({
        key: "a",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      })
    ).toBe(false);
  });
});
