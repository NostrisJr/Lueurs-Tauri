/** Libellé affiché pour chaque type de média (rangée de file tree, aperçu). */
export const MEDIA_LABEL: Record<string, string> = {
  image: "Image",
  audio: "Audio",
  video: "Vidéo",
  pdf: "PDF",
};

/** Classe du conteneur d'une rangée de file tree (note/dossier/média) — partagée
 * entre le rendu normal (FileRow) et le rendu grisé de la corbeille (TrashRow). */
export function rowContainerClass(kind: "folder" | "file" | "media"): string {
  return `px-4 py-2 flex ${
    kind === "folder"
      ? "items-center gap-3 h-12"
      : "flex-col justify-center min-h-16 h-fit"
  }`;
}

/** Extrait les premières lignes de texte visible d'un body markdown. */
export function getPreviewLines(body: string, count = 2): string[] {
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
    .slice(0, count);
}
