import { defineConfig } from "vitest/config";

// Config Vitest séparée de vite.config.ts (spécifique au dev Tauri : port
// fixe, watch qui ignore src-tauri — non pertinent pour les tests).
export default defineConfig({
  test: {
    environment: "node",
  },
});
