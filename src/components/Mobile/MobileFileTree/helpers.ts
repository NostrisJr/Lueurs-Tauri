/** Extrait les 2 premières lignes de texte visible d'un body markdown. */
export function getPreviewLines(body: string): string[] {
  const withoutFrontmatter = body.replace(/^---[\s\S]*?---\n?/, "");
  return withoutFrontmatter
    .split("\n")
    .map((l) =>
      l
        .replace(/^#{1,6}\s+/, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/~~(.+?)~~/g, "$1")
        .replace(/`(.+?)`/g, "$1")
        .trim()
    )
    .filter((l) => l.length > 1)
    .slice(0, 2);
}
