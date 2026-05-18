import { platform } from "@tauri-apps/plugin-os";

const _platform = platform();
export const isIOS     = _platform === "ios";
export const isAndroid = _platform === "android";
export const isMobile  = isIOS || isAndroid;
export const isDesktop = !isMobile;
