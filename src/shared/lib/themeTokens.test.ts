import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou du mode sombre.
 *
 * Une couleur écrite en dur (`bg-white`, `text-gray-400`, `#1a1918`, `rgba(…)`)
 * ne suit pas le thème : elle reste identique en clair et en sombre. Ce test
 * interdit d'en introduire de nouvelles — dans les composants comme dans les
 * feuilles de style — en dehors des fichiers listés dans BACKLOG, ceux qui
 * restent à migrer vers les tokens sémantiques.
 *
 * Le BACKLOG est un cliquet : il s'est vidé au fil des lots, et le test échoue
 * sur toute entrée devenue inutile (fichier migré mais resté dans la liste, ou
 * fichier supprimé). Il ne peut donc pas se périmer ni servir de placard.
 */

// Fichiers dont les couleurs en dur sont légitimes et définitives.
const EXEMPT = new Set([
  // Export Typst : document imprimé, toujours clair — ne doit jamais suivre le thème.
  "shared/lib/proseToTypst.ts",
  // Utilitaire de conversion générique, sans couleur propre.
  "shared/lib/color.ts",
  // Ce test lui-même.
  "shared/lib/themeTokens.test.ts",
  // Chemin de secours : doit s'afficher même sans feuille de styles chargée.
  "crashOverlay.ts",
  // Définitions des tokens : c'est leur rôle de porter les valeurs littérales.
  "theme.css",
  "theme-prose.css",
]);

// Fichiers encore à migrer. La migration est terminée : cette liste doit rester
// vide. Un fichier ne s'y ajoute que pour un chantier en cours, jamais pour
// faire taire le test.
const BACKLOG = new Set<string>([]);

const PROPERTIES =
  "bg|text|border|ring|divide|placeholder|shadow|accent|caret|fill|stroke|from|to|via|outline|decoration";
const PALETTE =
  "white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const PATTERNS: { label: string; re: RegExp }[] = [
  {
    label: "classe Tailwind de la palette par défaut",
    re: new RegExp(`\\b(?:${PROPERTIES})-(?:${PALETTE})(?:-\\d{2,3})?\\b`, "g"),
  },
  {
    label: "couleur hexadécimale",
    re: /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g,
  },
  { label: "rgb()/rgba()", re: /\brgba?\(/g },
  {
    // CSS : `color: white`. La liste de propriétés évite d'attraper
    // `white-space` et l'initial-value littérale d'une @property.
    label: "mot-clé de couleur",
    re: /\b(?:color|background|background-color|border-color|fill|stroke)\s*:\s*(?:white|black)\b/g,
  },
  {
    // Même faute, autre syntaxe : la palette Tailwind atteinte par var().
    label: "variable de la palette par défaut",
    re: new RegExp(`var\\(--color-(?:${PALETTE})(?:-\\d{2,3})?\\)`, "g"),
  },
];

/**
 * Neutralise commentaires et imports — un hex cité en commentaire n'est pas une
 * couleur appliquée — ainsi que les lignes marquées `theme-ok`, réservées aux
 * couleurs qui sont des *données* et non du thème (valeur initiale d'un
 * <input type="color">, qui n'accepte qu'un littéral #rrggbb). Le marqueur doit
 * être justifié par un commentaire au-dessus.
 */
function strip(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.includes("theme-ok"))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*import[\s\S]*?from\s+["'].*?["'];?$/gm, "");
}

function findRawColors(source: string): string[] {
  const code = strip(source);
  const hits: string[] = [];
  for (const { label, re } of PATTERNS) {
    const found = code.match(re);
    if (found) hits.push(`${label} : ${[...new Set(found)].join(", ")}`);
  }
  return hits;
}

// Lecture disque plutôt qu'import.meta.glob : Vitest neutralise les modules CSS
// (un `?raw` sur une feuille de style renvoie une chaîne vide), et un glob eager
// inline toute la source dans ce module — quelques secondes de transformation à
// chaque exécution.
const SRC = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.(tsx?|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const FILES = listSourceFiles(SRC).map((full) => ({
  rel: relative(SRC, full).split(sep).join("/"),
  source: readFileSync(full, "utf8"),
}));

describe("tokens de thème", () => {
  it("aucune couleur en dur hors du backlog de migration", () => {
    const offenders = FILES.filter(
      ({ rel }) => !EXEMPT.has(rel) && !BACKLOG.has(rel)
    )
      .map(({ rel, source }) => ({ rel, hits: findRawColors(source) }))
      .filter(({ hits }) => hits.length > 0)
      .map(({ rel, hits }) => `${rel}\n    ${hits.join("\n    ")}`);

    expect(
      offenders,
      "Utiliser les tokens sémantiques (bg-surface, text-ink-3, border-line…) plutôt que la palette Tailwind par défaut."
    ).toEqual([]);
  });

  it("le backlog ne contient aucune entrée périmée", () => {
    const known = new Set(FILES.map(({ rel }) => rel));
    const stale = [...BACKLOG]
      .map((rel) => {
        if (!known.has(rel)) return `${rel} — fichier absent`;
        const file = FILES.find((f) => f.rel === rel);
        if (file && findRawColors(file.source).length === 0)
          return `${rel} — déjà migré, à retirer du BACKLOG`;
        return null;
      })
      .filter((x): x is string => x !== null);

    expect(stale).toEqual([]);
  });
});
