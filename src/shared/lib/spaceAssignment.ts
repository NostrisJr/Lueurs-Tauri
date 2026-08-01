// Assignation d'une note (ou note-dossier) à un ou plusieurs espaces, et
// bascule de propriétés système simples (lecture seule).
// Partagé entre le menu contextuel desktop (clic droit) et mobile (appui long).

import type { useStore } from "jotai";
import type { FolderNode, NoteFile, TreeNode } from "../hooks/useFileTree";
import { treeAtom, writingPathsRegistry } from "./atoms";
import {
  serializeFrontmatter,
  toArray,
  updateNodeInTree,
} from "./fileTreeHelpers";
import { createLogger } from "./logger";
import { SystemField, isNoteReadOnly } from "./noteTypes";
import { vaultIO } from "./vaultIO";

const log = createLogger("spaceAssignment");

export function findFolderById(
  nodes: TreeNode[],
  id: string
): FolderNode | null {
  for (const node of nodes) {
    if (node.kind === "folder") {
      if (node.id === id) return node;
      const found = findFolderById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function findFolderNote(
  tree: TreeNode[],
  folderId: string
): NoteFile | null {
  const folder = findFolderById(tree, folderId);
  if (!folder) return null;
  return (
    folder.children.find(
      (c): c is NoteFile => c.kind === "file" && c.name === folder.name
    ) ?? null
  );
}

export type NodeKind = "file" | "folder" | "media";

// Résout la note cible d'un nœud du file tree pour les actions qui portent sur
// du frontmatter (espaces, lecture seule...) : une note directe est déjà la
// cible, un dossier est représenté par sa note-dossier (même nom), un média
// n'a pas de frontmatter.
export function resolveTargetNote(
  tree: TreeNode[],
  notesById: Map<string, NoteFile>,
  nodeId: string,
  nodeKind: NodeKind
): NoteFile | null {
  if (nodeKind === "media") return null;
  return nodeKind === "file"
    ? (notesById.get(nodeId) ?? null)
    : findFolderNote(tree, nodeId);
}

async function persistFrontmatterPatch(
  store: ReturnType<typeof useStore>,
  note: NoteFile,
  newFrontmatter: NoteFile["frontmatter"],
  logMessage: string,
  logPayload: Record<string, unknown>
): Promise<void> {
  const raw = serializeFrontmatter(newFrontmatter, note.body);
  writingPathsRegistry.add(note.id);
  try {
    await vaultIO.writeFile(note.id, raw);
    store.set(treeAtom, (prev) =>
      updateNodeInTree(prev, note.id, { frontmatter: newFrontmatter })
    );
    log.info(logMessage, { noteId: note.id, ...logPayload });
  } finally {
    writingPathsRegistry.delete(note.id);
  }
}

export async function toggleNoteSpace(
  store: ReturnType<typeof useStore>,
  note: NoteFile,
  spaceName: string
): Promise<void> {
  const current = toArray(note.frontmatter[SystemField.SPACE]);
  const updated = current.includes(spaceName)
    ? current.filter((s) => s !== spaceName)
    : [...current, spaceName];

  const newFrontmatter = { ...note.frontmatter };
  if (updated.length > 0) {
    newFrontmatter[SystemField.SPACE] = updated;
  } else {
    delete newFrontmatter[SystemField.SPACE];
  }

  await persistFrontmatterPatch(
    store,
    note,
    newFrontmatter,
    "espace togglé sur note",
    {
      spaceName,
      action: current.includes(spaceName) ? "retiré" : "ajouté",
    }
  );
}

export async function toggleNoteReadOnly(
  store: ReturnType<typeof useStore>,
  note: NoteFile
): Promise<void> {
  const wasReadOnly = isNoteReadOnly(note.frontmatter);

  const newFrontmatter = { ...note.frontmatter };
  if (wasReadOnly) {
    delete newFrontmatter[SystemField.READ_ONLY];
  } else {
    newFrontmatter[SystemField.READ_ONLY] = "true";
  }

  await persistFrontmatterPatch(
    store,
    note,
    newFrontmatter,
    "lecture seule togglée sur note",
    { action: wasReadOnly ? "déverrouillée" : "verrouillée" }
  );
}
