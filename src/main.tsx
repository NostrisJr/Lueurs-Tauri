import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";
import { platform } from "@tauri-apps/plugin-os";
import { showCrashOverlay } from "./crashOverlay";
import { TitleBar } from "./desktop/components/TitleBar";
import { createLogger } from "./shared/lib/logger";

const log = createLogger("main");

const isIOS = platform() === "ios";

// Sur iOS, body transparent révèle le fond par défaut de la WKWebView quand
// React crashe. On force le fond du thème — le token est déjà résolu par le
// script anti-FOUC d'index.html, exécuté avant ce module.
if (isIOS) {
  document.documentElement.style.background = "var(--color-canvas)";
  document.body.style.background = "var(--color-canvas)";
}

// Capture les erreurs non gérées et les promesses rejetées — utile pour
// diagnostiquer les crashes iOS où l'écran devient noir sans message d'erreur.
window.addEventListener("error", (e) => {
  log.error("erreur globale non gérée", {
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
    stack: e.error?.stack,
  });
  if (isIOS)
    showCrashOverlay("Erreur JS", `${e.message}\n\n${e.error?.stack ?? ""}`);
});
window.addEventListener("unhandledrejection", (e) => {
  log.error("promesse rejetée non gérée", {
    reason: String(e.reason),
    stack: e.reason?.stack,
  });
  if (isIOS)
    showCrashOverlay(
      "Promesse rejetée",
      `${e.reason}\n\n${e.reason?.stack ?? ""}`
    );
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TitleBar />
    <App />
  </React.StrictMode>
);
