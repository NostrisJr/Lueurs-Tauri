/**
 * Utilitaires liés au vault côté mobile.
 * Fonctionne pour les chemins POSIX et les URI SAF Android (content://...primary%3AMonDossier).
 */

/** Retourne le dernier segment lisible d'une URI de vault. */
export function vaultDisplayName(uri: string): string {
  const last = decodeURIComponent(uri.split("/").pop() ?? uri);
  // URI SAF : "primary:path/to/folder" → extraire le dernier segment du chemin
  const afterColon = last.includes(":")
    ? last.split(":").slice(1).join(":")
    : last;
  return afterColon.split("/").pop() ?? afterColon;
}
