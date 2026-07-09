// Assignation d'une note (ou note-dossier) à un ou plusieurs espaces.
// Partagé entre le menu contextuel desktop (clic droit) et mobile (appui long).

import type { useStore } from "jotai";
import type { FolderNode, NoteFile, TreeNode } from "../hooks/useFileTree";
import { treeAtom, writingPathsRegistry } from "./atoms";
import { serializeFrontmatter, toArray, updateNodeInTree } from "./fileTreeHelpers";
import { createLogger } from "./logger";
import { SystemField } from "./noteTypes";
import { vaultIO } from "./vaultIO";

const log = createLogger("spaceAssignment");

export function findFolderById(nodes: TreeNode[], id: string): FolderNode | null {
  for (const node of nodes) {
    if (node.kind === "folder") {
      if (node.id === id) return node;
      const found = findFolderById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function findFolderNote(tree: TreeNode[], folderId: string): NoteFile | null {
  const folder = findFolderById(tree, folderId);
  if (!folder) return null;
  return (
    folder.children.find(
      (c): c is NoteFile => c.kind === "file" && c.name === folder.name
    ) ?? null
  );
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

  const raw = serializeFrontmatter(newFrontmatter, note.body);
  writingPathsRegistry.add(note.id);
  try {
    await vaultIO.writeFile(note.id, raw);
    store.set(treeAtom, (prev) =>
      updateNodeInTree(prev, note.id, { frontmatter: newFrontmatter })
    );
    log.info("espace togglé sur note", {
      noteId: note.id,
      spaceName,
      action: current.includes(spaceName) ? "retiré" : "ajouté",
    });
  } finally {
    writingPathsRegistry.delete(note.id);
  }
}
