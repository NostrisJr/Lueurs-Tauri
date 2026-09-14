import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { resolvedThemeAtom, systemThemeAtom } from "../lib/atoms";
import { createLogger } from "../lib/logger";
import { applyTheme, getSystemTheme } from "../lib/theme";

const log = createLogger("theme");

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Applique le thème au document, à la fenêtre native et à la barre d'état.
 * Monté une seule fois, au-dessus des racines desktop et mobile (App.tsx).
 */
export function useTheme() {
  const setSystemTheme = useSetAtom(systemThemeAtom);
  const theme = useAtomValue(resolvedThemeAtom);

  // Suit le thème du système, même quand l'utilisateur a forcé clair ou sombre :
  // repasser sur « Système » doit être immédiatement juste.
  useEffect(() => {
    const media = window.matchMedia?.(DARK_QUERY);
    if (!media) return;
    setSystemTheme(getSystemTheme());
    const onChange = (e: MediaQueryListEvent) =>
      setSystemTheme(e.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [setSystemTheme]);

  useEffect(() => {
    applyTheme(theme, document.documentElement);
    syncMetaThemeColor();
    // La fenêtre native ne suit pas le CSS : sans ça les feux tricolores macOS,
    // les menus contextuels natifs et les panneaux de dialogue restent clairs.
    getCurrentWindow()
      .setTheme(theme)
      .catch((err) => log.warn("setTheme fenêtre native a échoué", err));
    log.info("thème appliqué", { theme });
  }, [theme]);
}

/**
 * theme-color pilote la teinte de la barre d'état et des bords système sur
 * Android. La balise n'existe pas dans index.html : on la crée à la volée.
 * À appeler après applyTheme — la valeur est relue depuis le token résolu.
 */
function syncMetaThemeColor() {
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-canvas")
    .trim();
}
