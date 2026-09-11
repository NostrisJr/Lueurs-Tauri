// Point d'entrée commun au bouton "Partager" (mobile) et à l'item de menu
// desktop : scanne les références hors bundle (wikilinks, ref() de formules),
// ouvre ShareResolutionDialog si besoin (voir shareResolutionAtom), puis
// construit et écrit le bundle .lueurs dans un fichier temp prêt à être
// remis à la feuille de partage native.

import { mkdir, writeFile } from "@tauri-apps/plugin-fs";
import type { useStore } from "jotai";
import type { NoteFile, TreeNode } from "../../hooks/useFileTree";
import { flattenTree } from "../../hooks/useFileTree";
import { shareResolutionAtom } from "../atoms";
import type { InfosAuteur } from "../proseToTypst";
import { type BundleBuildResult, buildBundle } from "./bundleExport";

type Store = ReturnType<typeof useStore>;

/** Résout une note du vault par son chemin relatif — pour bake/recursive/children. */
export function buildRelPathResolver(
  fullTree: TreeNode[],
  vaultPath: string
): (relPath: string) => NoteFile | undefined {
  const byRel = new Map<string, NoteFile>();
  for (const note of flattenTree(fullTree)) {
    byRel.set(note.id.slice(vaultPath.length + 1), note);
  }
  return (relPath) => byRel.get(relPath);
}

/** Ouvre ShareResolutionDialog et attend le choix de l'utilisateur (null = annulé). */
function requestResolution(
  store: Store,
  wikilinkCount: number,
  formulaCount: number,
  hasChildren: boolean
): Promise<{
  mode: "asis" | "bake" | "recursive";
  includeChildren: boolean;
} | null> {
  return new Promise((resolve) => {
    store.set(shareResolutionAtom, {
      wikilinkCount,
      formulaCount,
      hasChildren,
      resolve,
    });
  });
}

/**
 * Scanne puis construit le bundle, en demandant à l'utilisateur comment traiter
 * les références hors sélection s'il y en a. Renvoie null si l'utilisateur annule
 * depuis le dialogue.
 */
export async function resolveAndBuildBundle(
  store: Store,
  node: TreeNode,
  vaultPath: string,
  auteur: InfosAuteur | null,
  fullTree: TreeNode[]
): Promise<BundleBuildResult | null> {
  const resolveByRelPath = buildRelPathResolver(fullTree, vaultPath);

  // Passe de détection : mode "asis" ne modifie rien, juste utile pour ses `warnings`.
  const scan = await buildBundle(node, vaultPath, auteur, {
    mode: "asis",
    includeChildren: false,
    resolveByRelPath,
  });

  const { wikilinks, formulas } = scan.warnings;
  if (wikilinks.length === 0 && formulas.length === 0 && !scan.hasChildren) {
    return scan;
  }

  const choice = await requestResolution(
    store,
    wikilinks.length,
    formulas.length,
    scan.hasChildren
  );
  if (!choice) return null;
  if (choice.mode === "asis" && !choice.includeChildren) return scan;

  return buildBundle(node, vaultPath, auteur, {
    mode: choice.mode,
    includeChildren: choice.includeChildren,
    resolveByRelPath,
  });
}

async function writeToTmp(
  bytes: Uint8Array,
  suggestedFileName: string
): Promise<string> {
  const { appDataDir } = await import("@tauri-apps/api/path");
  const appData = await appDataDir();
  // Sous-dossier temp unique : évite qu'un partage concurrent du même nœud
  // (double-tap) n'écrase un fichier en cours de lecture par la feuille native.
  const tmpDir = `${appData}lueurs-tmp/share-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await mkdir(tmpDir, { recursive: true });
  const tmpPath = `${tmpDir}/${suggestedFileName}`;
  await writeFile(tmpPath, bytes);
  return tmpPath;
}

export const BUNDLE_MIME = "application/x-lueurs";

/** Résout + construit + écrit dans un fichier temp. Renvoie null si l'utilisateur annule. */
export async function writeShareableBundle(
  store: Store,
  node: TreeNode,
  vaultPath: string,
  auteur: InfosAuteur | null,
  fullTree: TreeNode[]
): Promise<string | null> {
  const result = await resolveAndBuildBundle(
    store,
    node,
    vaultPath,
    auteur,
    fullTree
  );
  if (!result) return null;
  return writeToTmp(result.bytes, result.suggestedFileName);
}
