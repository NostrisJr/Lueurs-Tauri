/**
 * Thème clair/sombre — logique pure : résolution, lecture du stockage,
 * application au document.
 *
 * Le thème effectif est porté par l'attribut `data-theme` sur <html>. C'est lui
 * que lisent le variant `dark:` de Tailwind et les redéfinitions de tokens
 * (cf. App.css). On ne s'appuie pas sur `prefers-color-scheme` seul : le
 * réglage utilisateur doit pouvoir contredire le système.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "lueurs_theme";
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
  { value: "system", label: "Système" },
];

const PREFERENCES: readonly string[] = ["light", "dark", "system"];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && PREFERENCES.includes(value);
}

/** Préférence utilisateur + thème du système → thème réellement appliqué. */
export function resolveTheme(
  preference: ThemePreference,
  systemTheme: ResolvedTheme
): ResolvedTheme {
  return preference === "system" ? systemTheme : preference;
}

/**
 * Interprète la valeur brute de localStorage. `atomWithStorage` sérialise en
 * JSON — la valeur stockée est donc `"dark"`, guillemets inclus. On tolère
 * aussi la forme nue, au cas où la clé aurait été posée à la main.
 */
export function parseStoredPreference(raw: string | null): ThemePreference {
  if (!raw) return DEFAULT_THEME_PREFERENCE;
  try {
    const parsed = JSON.parse(raw);
    if (isThemePreference(parsed)) return parsed;
  } catch {
    if (isThemePreference(raw)) return raw;
  }
  return DEFAULT_THEME_PREFERENCE;
}

/** Cible minimale de `applyTheme` — permet de tester sans DOM. */
export interface ThemeTarget {
  dataset: { theme?: string };
  style: { colorScheme: string };
}

export function applyTheme(theme: ResolvedTheme, root: ThemeTarget): void {
  root.dataset.theme = theme;
  // colorScheme pilote ce que le moteur rend lui-même et que le CSS n'atteint
  // pas : ascenseurs natifs, contrôles de formulaire, et fond par défaut de la
  // WebView (sans quoi iOS flashe en blanc avant le premier paint).
  root.style.colorScheme = theme;
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Valeur calculée d'un token, pour les rendus que la cascade CSS n'atteint pas
 * (canvas, pickers tiers configurés en JS). À relire à chaque tracé : la valeur
 * change avec le thème.
 */
export function themeColor(token: string, fallback = "transparent"): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return value || fallback;
}

/**
 * Palier d'un masque de dégradé (`mask-image`). Les composantes RVB n'y ont
 * aucun effet visuel — seul l'alpha compte — donc ce noir n'est pas une couleur
 * de thème et ne doit pas basculer en sombre.
 */
export function maskStop(alpha: number): string {
  return `rgba(0, 0, 0, ${alpha})`; // theme-ok
}
