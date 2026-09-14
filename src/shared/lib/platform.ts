import { platform } from "@tauri-apps/plugin-os";

const _platform = platform();
export const isIOS = _platform === "ios";
export const isMacOS = _platform === "macos";
export const isAndroid = _platform === "android";
export const isMobile = isIOS || isAndroid;
export const isDesktop = !isMobile;
// Plateformes où les icônes SF Symbols d'Apple sont utilisables (licence Apple).
export const isApplePlatform = isIOS || isMacOS;
// Couleur d'accent des icônes mobiles : l'ambre pleine sur iOS, sa variante
// claire sur Android (rendu plus contrasté sur les fonds Material).
export const iconAccentClass = isIOS ? "text-accent" : "text-accent-2";
