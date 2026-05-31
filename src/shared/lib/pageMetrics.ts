// Métriques de document : nombre de mots et nombre de pages équivalent.
//
// Le nombre de pages est *mesuré réellement* : le HTML propre de la note est
// injecté dans un conteneur hors-écran à la largeur d'une zone de contenu de
// page standard, puis on lit sa hauteur rendue. Léger car réutilise le HTML
// déjà produit par l'éditeur (cf. proseExport) et ne fait qu'une passe de
// layout, en différé (cf. useDocStats).
//
// Repli documenté : si la mesure devient instable (médias chargés en async),
// basculer sur une estimation au signe — 1 feuillet ≈ 1500 signes (A4).

export type PageFormat = "A4" | "A5";

interface FormatSpec {
  label: string;
  // Dimensions de la page en mm
  width: number;
  height: number;
  // Marge uniforme en mm (mise en page « standard »)
  margin: number;
}

export const PAGE_FORMATS: Record<PageFormat, FormatSpec> = {
  A4: { label: "A4", width: 210, height: 297, margin: 25 },
  A5: { label: "A5", width: 148, height: 210, margin: 20 },
};

// 96 dpi : 1 mm = 96 / 25.4 px
const MM_TO_PX = 96 / 25.4;

// Typographie « standard » de référence, indépendante de la typo écran.
const STANDARD_FONT_PX = 16;
const STANDARD_LINE_HEIGHT = 1.6;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

// Conteneur de mesure réutilisé (un seul layout offscreen vivant à la fois).
let measureEl: HTMLDivElement | null = null;

function getMeasureContainer(): HTMLDivElement {
  if (measureEl) return measureEl;
  const el = document.createElement("div");
  el.setAttribute("data-page-measure", "");
  el.style.cssText = [
    "position:absolute",
    "visibility:hidden",
    "left:-9999px",
    "top:0",
    "box-sizing:border-box",
    `font-size:${STANDARD_FONT_PX}px`,
    `line-height:${STANDARD_LINE_HEIGHT}`,
    "font-family:'EB Garamond', Georgia, serif",
    "white-space:pre-wrap",
    "word-break:break-word",
  ].join(";");
  document.body.appendChild(el);
  measureEl = el;
  return el;
}

/**
 * Nombre de pages équivalent pour `html` au format donné.
 * Médias affectés d'une hauteur fixe pour éviter le bruit de chargement async.
 */
export function measurePages(html: string, format: PageFormat): number {
  if (!html.trim()) return 0;
  const spec = PAGE_FORMATS[format];
  const contentWidthPx = (spec.width - 2 * spec.margin) * MM_TO_PX;
  const contentHeightPx = (spec.height - 2 * spec.margin) * MM_TO_PX;

  const el = getMeasureContainer();
  el.style.width = `${contentWidthPx}px`;
  // Hauteur fixe approximative pour les médias (estimation « mise en page standard »)
  el.innerHTML = `<style>
    [data-page-measure] img, [data-page-measure] [data-audio-block] { display:block; height:200px; margin:0.5em 0; }
    [data-page-measure] h1 { font-size:2em; }
    [data-page-measure] h2 { font-size:1.6em; }
    [data-page-measure] h3 { font-size:1.3em; }
    [data-page-measure] p { margin:0; padding:0.4em 0; }
  </style>${html}`;

  const pages = Math.ceil(el.scrollHeight / contentHeightPx);
  return Math.max(1, pages);
}
