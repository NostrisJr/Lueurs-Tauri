import { platform } from "@tauri-apps/plugin-os";

const _platform = platform();
export const isIOS = _platform === "ios";
export const isMacOS = _platform === "macos";
export const isAndroid = _platform === "android";
export const isMobile = isIOS || isAndroid;
export const isDesktop = !isMobile;
// Plateformes où les icônes SF Symbols d'Apple sont utilisables (licence Apple).
export const isApplePlatform = isIOS || isMacOS;
