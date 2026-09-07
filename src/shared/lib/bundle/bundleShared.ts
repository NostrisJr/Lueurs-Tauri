// Helpers partagés export/import de bundle (.lueurs-note) : détection et
// réécriture des références resources/ dans le corps markdown, nommage sans
// collision, et reconstruction d'arbre. Cf. Documentation-technique.md pour
// le format du bundle.
//
// Module volontairement pur (aucun import Tauri) : import { platform } de
// @tauri-apps/plugin-os (via vaultIO.ts) accède à `window` au chargement du
// module et casse donc tout import dans les tests (environnement Node) — voir
// CLAUDE.md "Coverage". D'où la petite duplication des extensions image/audio
// avec MEDIA_EXTENSIONS (vaultIO.ts) plutôt qu'un import de getMediaType.

import type { Frontmatter } from "../fileTreeHelpers";
import { toArray } from "../fileTreeHelpers";
import { SystemField } from "../noteTypes";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "wav", "ogg", "aac"]);

// Image `![alt](src "title")` ou lien `[titre](src)` (syntaxe du bloc audio) —
// un seul regex, disambigué ensuite par `!` (toujours une ressource) ou par
// l'extension du lien (audio = ressource, .md = wikilink vers une autre note,
// ignoré ici). Les chemins de resources/ n'ont jamais espace/parenthèse/guillemet
// (sanitisés à la copie, cf. vaultIO.copyResourceToVault) → regex simple.
const RESOURCE_MD_RE = /(!?)\[([^\]]*)\]\(([^()\s"]+)((?:\s+"[^"]*")?)\)/g;

function extOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function isResourceUrl(bang: string, url: string): boolean {
  return bang === "!" || AUDIO_EXTENSIONS.has(extOf(url));
}

/** Chemins (relatifs au vault) des images/audio référencés dans le corps d'une note. */
export function collectResourceRefs(body: string): string[] {
  const refs = new Set<string>();
  RESOURCE_MD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: pattern standard regex globale
  while ((m = RESOURCE_MD_RE.exec(body)) !== null) {
    const [, bang, , url] = m;
    if (isResourceUrl(bang, url)) refs.add(url);
  }
  return [...refs];
}

/** Remplace les src d'images/audio selon `mapping` (clé = ancien chemin, valeur = nouveau). */
export function rewriteResourceRefs(
  body: string,
  mapping: Map<string, string>
): string {
  RESOURCE_MD_RE.lastIndex = 0;
  return body.replace(RESOURCE_MD_RE, (full, bang, label, url, titleSuffix) => {
    if (!isResourceUrl(bang, url)) return full;
    const next = mapping.get(url);
    if (!next) return full;
    return `${bang}[${label}](${next}${titleSuffix})`;
  });
}

/** Sous-dossier resources/ pour une extension donnée, ou null si non embarquable. */
export function resourceSubDir(fileName: string): "images" | "audio" | null {
  const ext = extOf(fileName);
  if (IMAGE_EXTENSIONS.has(ext)) return "images";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  return null;
}

/** Même convention de suffixe que `resolveDestName` (vaultIO.ts), mais sur un Set en mémoire. */
export function dedupeName(existing: Set<string>, name: string): string {
  if (!existing.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 2;
  while (existing.has(`${base} (${i})${ext}`)) i++;
  return `${base} (${i})${ext}`;
}

/** Même sanitisation que vaultIO.copyResourceToVault, appliquée en amont pour que le
 * dédoublonnage porte sur le nom réellement écrit sur disque. */
export function sanitizeResourceName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export interface BundleManifest {
  version: 1;
  kind: "note" | "folder" | "media";
  rootName: string;
}

export const MANIFEST_ENTRY = "manifest.json";
export const BUNDLE_EXTENSION = "lueurs-note";

/** Rattache l'import à l'espace actif (même logique que importUtils.tagSpace). */
export function tagSpace(fm: Frontmatter, space?: string | null): Frontmatter {
  if (!space) return fm;
  const existing = toArray(fm[SystemField.SPACE]);
  if (!existing.includes(space)) fm[SystemField.SPACE] = [...existing, space];
  return fm;
}

// ── Wikilinks et ref() de formules (notes hors du bundle) ──────────────────
//
// Un wikilink (`[label](chemin.md)`) ou un `ref("chemin")` (frontmatter ou
// formule inline du corps) qui pointe vers une note absente du bundle reste
// syntaxiquement valide mais silencieusement inerte à l'import (lien mort,
// résultat vide/NaN — cf. formulas.ts `noteResolver?.(path) → {}` si non
// trouvée). Ces helpers permettent 3 traitements au choix de l'utilisateur :
// laisser tel quel, figer (évaluer et remplacer par la valeur brute), ou
// bundler récursivement la note référencée.

const FORMULA_REF_RE = /ref\("([^"]+)"\)/g;
// Même motif que remark-inline-formula.ts — dupliqué ici pour rester pur
// (ce fichier ne peut pas importer les plugins Milkdown/ProseMirror).
const INLINE_FORMULA_RE = /\$\$([^\n]+?)\$\$/g;

/** Chemins .md des wikilinks (liens vers d'autres notes) dans le corps. */
export function collectWikilinkTargets(body: string): string[] {
  const refs = new Set<string>();
  RESOURCE_MD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: pattern standard regex globale
  while ((m = RESOURCE_MD_RE.exec(body)) !== null) {
    const [, bang, , url] = m;
    if (bang !== "!" && extOf(url) === "md") refs.add(url);
  }
  return [...refs];
}

/** Retire le lien (garde le libellé en texte simple) pour chaque wikilink ciblant `targets`. */
export function unlinkWikilinks(body: string, targets: Set<string>): string {
  RESOURCE_MD_RE.lastIndex = 0;
  return body.replace(RESOURCE_MD_RE, (full, bang, label, url) => {
    if (bang === "!" || extOf(url) !== "md") return full;
    return targets.has(url) ? label : full;
  });
}

/** Réécrit les hrefs de wikilinks selon `mapping` (même convention que rewriteResourceRefs). */
export function rewriteWikilinkRefs(
  body: string,
  mapping: Map<string, string>
): string {
  RESOURCE_MD_RE.lastIndex = 0;
  return body.replace(RESOURCE_MD_RE, (full, bang, label, url, titleSuffix) => {
    if (bang === "!" || extOf(url) !== "md") return full;
    const next = mapping.get(url);
    if (!next) return full;
    return `[${label}](${next}${titleSuffix})`;
  });
}

/** Chemins ciblés par des `ref("chemin")` dans un texte (formule seule ou corps entier). */
export function collectFormulaRefPaths(text: string): string[] {
  const targets = new Set<string>();
  FORMULA_REF_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: pattern standard regex globale
  while ((m = FORMULA_REF_RE.exec(text)) !== null) targets.add(m[1]);
  return [...targets];
}

/** Réécrit les chemins `ref("...")` selon `mapping`. */
export function rewriteFormulaRefPaths(
  text: string,
  mapping: Map<string, string>
): string {
  FORMULA_REF_RE.lastIndex = 0;
  return text.replace(FORMULA_REF_RE, (full, path) => {
    const next = mapping.get(path);
    return next ? `ref("${next}")` : full;
  });
}

/** Tous les chemins ref() d'une note : propriétés frontmatter + formules inline du corps. */
export function collectNoteRefPaths(
  frontmatter: Frontmatter,
  body: string
): string[] {
  const targets = new Set<string>();
  for (const value of Object.values(frontmatter)) {
    if (typeof value === "string") {
      for (const p of collectFormulaRefPaths(value)) targets.add(p);
    }
  }
  for (const p of collectFormulaRefPaths(body)) targets.add(p);
  return [...targets];
}

/** Notes référencées mais absentes de `includedRelPaths` — pour le message d'avertissement. */
export interface BrokenRefsScan {
  wikilinks: string[];
  formulas: string[];
}

export function scanBrokenRefs(
  notes: { frontmatter: Frontmatter; body: string }[],
  includedRelPaths: Set<string>
): BrokenRefsScan {
  const wikilinks = new Set<string>();
  const formulas = new Set<string>();
  for (const { frontmatter, body } of notes) {
    for (const t of collectWikilinkTargets(body)) {
      if (!includedRelPaths.has(t)) wikilinks.add(t);
    }
    for (const t of collectNoteRefPaths(frontmatter, body)) {
      if (!includedRelPaths.has(t)) formulas.add(t);
    }
  }
  return { wikilinks: [...wikilinks], formulas: [...formulas] };
}

/**
 * Mode "figer" : remplace par sa valeur brute toute propriété frontmatter formule
 * ou formule inline du corps dont un `ref()` cible `excludedPaths` — `evaluate`
 * calcule la valeur (injecté : nécessite computeFormula + le resolver plein-vault,
 * hors de portée de ce module pur).
 */
export function bakeNoteFormulas(
  frontmatter: Frontmatter,
  body: string,
  excludedPaths: Set<string>,
  evaluate: (raw: string) => string
): { frontmatter: Frontmatter; body: string } {
  const fm = { ...frontmatter };
  for (const [key, value] of Object.entries(fm)) {
    if (typeof value !== "string") continue;
    const refs = collectFormulaRefPaths(value);
    if (refs.some((r) => excludedPaths.has(r))) {
      fm[key] = evaluate(value);
    }
  }
  INLINE_FORMULA_RE.lastIndex = 0;
  const newBody = body.replace(INLINE_FORMULA_RE, (full) => {
    const refs = collectFormulaRefPaths(full);
    return refs.some((r) => excludedPaths.has(r)) ? evaluate(full) : full;
  });
  return { frontmatter: fm, body: newBody };
}

export interface DirEntry {
  files: { name: string; key: string }[];
  subDirs: Map<string, DirEntry>;
}

/** Regroupe les clés zip plates ("tree/Dossier/Sous/note.md") en arbre de répertoires. */
export function buildDirTree(
  files: Record<string, Uint8Array>,
  rootPrefix: string
): DirEntry {
  const root: DirEntry = { files: [], subDirs: new Map() };
  for (const key of Object.keys(files)) {
    if (!key.startsWith(rootPrefix)) continue;
    const rel = key.slice(rootPrefix.length);
    if (!rel) continue;
    const parts = rel.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      let next = node.subDirs.get(seg);
      if (!next) {
        next = { files: [], subDirs: new Map() };
        node.subDirs.set(seg, next);
      }
      node = next;
    }
    node.files.push({ name: parts[parts.length - 1], key });
  }
  return root;
}
