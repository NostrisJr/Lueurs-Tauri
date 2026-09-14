import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_PREFERENCE,
  type ThemeTarget,
  applyTheme,
  isThemePreference,
  parseStoredPreference,
  resolveTheme,
} from "./theme";

function fakeRoot(): ThemeTarget {
  return { dataset: {}, style: { colorScheme: "" } };
}

describe("resolveTheme", () => {
  it("respecte un choix explicite, quel que soit le système", () => {
    expect(resolveTheme("light", "dark")).toBe("light");
    expect(resolveTheme("dark", "light")).toBe("dark");
  });

  it("suit le système en mode « system »", () => {
    expect(resolveTheme("system", "dark")).toBe("dark");
    expect(resolveTheme("system", "light")).toBe("light");
  });
});

describe("parseStoredPreference", () => {
  it("replie sur le défaut quand rien n'est stocké", () => {
    expect(parseStoredPreference(null)).toBe(DEFAULT_THEME_PREFERENCE);
    expect(parseStoredPreference("")).toBe(DEFAULT_THEME_PREFERENCE);
  });

  it("lit la forme JSON écrite par atomWithStorage", () => {
    expect(parseStoredPreference('"dark"')).toBe("dark");
    expect(parseStoredPreference('"light"')).toBe("light");
    expect(parseStoredPreference('"system"')).toBe("system");
  });

  it("tolère la forme nue", () => {
    expect(parseStoredPreference("dark")).toBe("dark");
  });

  it("replie sur le défaut sur une valeur inconnue ou corrompue", () => {
    expect(parseStoredPreference('"sepia"')).toBe(DEFAULT_THEME_PREFERENCE);
    expect(parseStoredPreference("{ oops")).toBe(DEFAULT_THEME_PREFERENCE);
    expect(parseStoredPreference("null")).toBe(DEFAULT_THEME_PREFERENCE);
    expect(parseStoredPreference("42")).toBe(DEFAULT_THEME_PREFERENCE);
  });
});

describe("isThemePreference", () => {
  it("n'accepte que les trois valeurs connues", () => {
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("auto")).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
  });
});

describe("applyTheme", () => {
  it("pose data-theme et color-scheme", () => {
    const root = fakeRoot();
    applyTheme("dark", root);
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("écrase la valeur précédente au changement", () => {
    const root = fakeRoot();
    applyTheme("dark", root);
    applyTheme("light", root);
    expect(root.dataset.theme).toBe("light");
    expect(root.style.colorScheme).toBe("light");
  });
});
