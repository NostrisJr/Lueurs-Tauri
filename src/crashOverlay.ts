/**
 * Overlay de crash iOS — sans lui, une erreur JS non gérée laisse un écran noir
 * sans message.
 *
 * Volontairement indépendant du thème et des tokens CSS : il doit s'afficher
 * même si la feuille de styles n'a pas été chargée, ou si c'est précisément le
 * rendu qui a échoué. Les couleurs y sont donc écrites en dur, et il reste
 * sombre en thème clair comme en sombre (exempté de themeTokens.test.ts).
 */
export function showCrashOverlay(title: string, detail: string) {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;inset:0;z-index:99999;background:#1a1a1a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:12px;font-family:monospace;font-size:13px;overflow:auto";
  const h = document.createElement("p");
  h.style.cssText = "font-size:16px;font-weight:bold;color:#f87171;margin:0";
  h.textContent = title;
  const p = document.createElement("p");
  p.style.cssText =
    "white-space:pre-wrap;word-break:break-all;margin:0;color:#d1d5db";
  p.textContent = detail;
  const btn = document.createElement("button");
  btn.textContent = "Fermer";
  btn.style.cssText =
    "margin-top:12px;padding:8px 20px;background:#f59e0b;border:none;border-radius:8px;color:#fff;font-size:14px;cursor:pointer";
  btn.onclick = () => el.remove();
  el.append(h, p, btn);
  document.body.appendChild(el);
}
