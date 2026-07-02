import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";
import { TitleBar } from "./desktop/components/TitleBar";
import { createLogger } from "./shared/lib/logger";
import { platform } from "@tauri-apps/plugin-os";

const log = createLogger("main");

// Sur iOS, affiche un overlay visible quand l'app crashe (sinon : écran noir).
function showCrashOverlay(title: string, detail: string) {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;inset:0;z-index:99999;background:#1a1a1a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:12px;font-family:monospace;font-size:13px;overflow:auto";
  const h = document.createElement("p");
  h.style.cssText = "font-size:16px;font-weight:bold;color:#f87171;margin:0";
  h.textContent = title;
  const p = document.createElement("p");
  p.style.cssText = "white-space:pre-wrap;word-break:break-all;margin:0;color:#d1d5db";
  p.textContent = detail;
  const btn = document.createElement("button");
  btn.textContent = "Fermer";
  btn.style.cssText =
    "margin-top:12px;padding:8px 20px;background:#f59e0b;border:none;border-radius:8px;color:#fff;font-size:14px;cursor:pointer";
  btn.onclick = () => el.remove();
  el.append(h, p, btn);
  document.body.appendChild(el);
}

const isIOS = platform() === "ios";

// Sur iOS, body transparent révèle le fond sombre WKWebView quand React crashe.
// On force un fond blanc pour éviter l'écran noir.
if (isIOS) {
  document.documentElement.style.background = "white";
  document.body.style.background = "white";
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
  if (isIOS) showCrashOverlay("Erreur JS", `${e.message}\n\n${e.error?.stack ?? ""}`);
});
window.addEventListener("unhandledrejection", (e) => {
  log.error("promesse rejetée non gérée", {
    reason: String(e.reason),
    stack: e.reason?.stack,
  });
  if (isIOS) showCrashOverlay("Promesse rejetée", `${e.reason}\n\n${e.reason?.stack ?? ""}`);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TitleBar />
    <App />
  </React.StrictMode>
);
