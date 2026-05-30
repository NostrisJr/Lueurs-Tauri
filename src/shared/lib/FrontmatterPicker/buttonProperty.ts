// ── Propriété contrainte BUTTON ─────────────────────────────────────────────
//
// Syntaxe (déclarée dans un template) : $$BUTTON([v1;v2;v3],default)$$
// - séparateur `;` dans le tableau (évite le conflit avec la `,` des arguments)
// - `default` : valeur initiale des héritiers (peut être hors-liste = placeholder).
//   Si omis → première valeur de la liste.
// - couleur d'une option : =={color}label== ou ==label== (couleur par défaut),
//   syntaxe reprise du plugin highlight ; couleurs identiques.
//
// Sémantique : contrainte (clé verrouillée) mais valeur éditable via dropdown.
// L'héritier stocke la valeur littérale choisie (sans couleur), jamais la formule.

import { defaultHighlightColorRef } from "../../plugins/highlight/defaultColorRef";

export interface ButtonOption {
  /** Libellé propre, stocké tel quel par l'héritier. */
  value: string;
  /** Id couleur highlight (yellow, green, …) ; undefined = pill neutre. */
  color?: string;
}

export interface ButtonDef {
  options: ButtonOption[];
  default: string;
}

export type EnumValueState = "valid" | "placeholder" | "invalid";

const BUTTON_RE = /^\$\$\s*BUTTON\s*\(([\s\S]*)\)\s*\$\$$/;
// Option colorée : =={color}label== ou ==label==
const OPTION_COLOR_RE = /^==(?:\{([a-z]+)\})?([\s\S]+?)==$/;

export function isButtonFormula(value: unknown): value is string {
  return typeof value === "string" && BUTTON_RE.test(value.trim());
}

function parseOption(token: string): ButtonOption {
  const m = OPTION_COLOR_RE.exec(token);
  if (m) {
    // Couleur omise (==label==) → couleur par défaut des réglages
    return {
      value: m[2].trim(),
      color: m[1] ?? defaultHighlightColorRef.current,
    };
  }
  return { value: token };
}

/** Parse `$$BUTTON([a;b;c],def)$$` → { options, default }. null si invalide. */
export function parseButton(value: string): ButtonDef | null {
  const m = BUTTON_RE.exec(value.trim());
  if (!m) return null;

  const inner = m[1].trim();
  const close = inner.indexOf("]");
  if (!inner.startsWith("[") || close === -1) return null;

  const options = inner
    .slice(1, close)
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(parseOption);

  // Après `]` : optionnellement `,default`. Default vide → première valeur.
  const rest = inner.slice(close + 1).trim();
  const rawDefault = rest.startsWith(",") ? rest.slice(1).trim() : "";
  const def = rawDefault || options[0]?.value || "";

  return { options, default: def };
}

export function serializeButton(def: ButtonDef): string {
  const opts = def.options
    .map((o) => (o.color ? `=={${o.color}}${o.value}==` : o.value))
    .join(";");
  return `$$BUTTON([${opts}],${def.default})$$`;
}

export interface ButtonOptionsDiff {
  renames: { old: string; new: string }[];
  added: string[];
  removed: string[];
}

/**
 * Diff entre deux définitions BUTTON, comparé par valeur (la couleur n'affecte
 * pas les héritiers). Heuristique : exactement une retirée + une ajoutée →
 * renommage (même logique que diffFrontmatter pour les clés).
 */
export function diffButtonOptions(
  prev: ButtonDef,
  next: ButtonDef
): ButtonOptionsDiff {
  const prevVals = prev.options.map((o) => o.value);
  const nextVals = next.options.map((o) => o.value);
  const added = nextVals.filter((v) => !prevVals.includes(v));
  const removed = prevVals.filter((v) => !nextVals.includes(v));

  if (added.length === 1 && removed.length === 1) {
    return {
      renames: [{ old: removed[0], new: added[0] }],
      added: [],
      removed: [],
    };
  }
  return { renames: [], added, removed };
}

/** Valeurs permises (libellés), pour la propagation/réconciliation. */
export function optionValues(def: ButtonDef): string[] {
  return def.options.map((o) => o.value);
}

/** Couleur associée à une valeur dans la définition, le cas échéant. */
export function optionColor(value: string, def: ButtonDef): string | undefined {
  return def.options.find((o) => o.value === value)?.color;
}

/**
 * État d'une valeur d'héritier vis-à-vis de sa contrainte.
 * - valid       : valeur présente dans les options
 * - placeholder : valeur === default mais default hors-liste (état « non choisi »)
 * - invalid     : valeur ni dans les options ni égale au default
 */
export function enumValueState(value: string, def: ButtonDef): EnumValueState {
  if (def.options.some((o) => o.value === value)) return "valid";
  if (value === def.default) return "placeholder";
  return "invalid";
}
