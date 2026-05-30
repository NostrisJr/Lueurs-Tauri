// Couleur highlight → classes Tailwind pour les pills BUTTON (fond 300, texte 700).
// Classes littérales : indispensables pour que le JIT Tailwind les détecte.

const COLOR_CLASSES: Record<string, string> = {
  yellow: "bg-amber-300 text-amber-700",
  green: "bg-green-300 text-green-700",
  blue: "bg-blue-300 text-blue-700",
  red: "bg-red-300 text-red-700",
  orange: "bg-orange-300 text-orange-700",
  purple: "bg-purple-300 text-purple-700",
  gray: "bg-gray-300 text-gray-700",
};

export const NEUTRAL_PILL = "bg-gray-300 text-gray-700";

export function pillClasses(color: string | undefined): string {
  return (color && COLOR_CLASSES[color]) || NEUTRAL_PILL;
}
