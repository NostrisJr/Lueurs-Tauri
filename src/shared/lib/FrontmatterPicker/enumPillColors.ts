// Couleur highlight → classes des pills ENUM.
// Classes littérales : indispensables pour que le JIT Tailwind les détecte.
// Les teintes viennent des tokens --color-pill-* (theme.css), partagés avec les
// pills de formule du corps de note (DefaultStyle.css) — une même valeur doit
// se lire pareil des deux côtés.

const COLOR_CLASSES: Record<string, string> = {
  yellow: "bg-pill-yellow text-pill-yellow-ink",
  green: "bg-pill-green text-pill-green-ink",
  blue: "bg-pill-blue text-pill-blue-ink",
  red: "bg-pill-red text-pill-red-ink",
  orange: "bg-pill-orange text-pill-orange-ink",
  purple: "bg-pill-purple text-pill-purple-ink",
  gray: "bg-pill-gray text-pill-gray-ink",
};

export const NEUTRAL_PILL = "bg-pill-gray text-pill-gray-ink";

export function pillClasses(color: string | undefined): string {
  return (color && COLOR_CLASSES[color]) || NEUTRAL_PILL;
}
