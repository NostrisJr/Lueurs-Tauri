import { platform } from "@tauri-apps/plugin-os";

export const isMobile = platform() === "ios" || platform() === "android";
