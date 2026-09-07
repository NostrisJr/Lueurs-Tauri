/**
 * fileTreeUndo.ts
 *
 * Pile d'annulation/rétablissement pour les opérations du file tree
 * (suppression, renommage, déplacement) — distincte de l'undo de frappe
 * interne à l'éditeur (ProseMirror history), qui reste scopé au contenu
 * d'une note. Deux piles LIFO en mémoire (non persistées, vidées au
 * changement de vault/redémarrage) ; chaque entrée porte ses propres
 * actions undo()/redo() en closure (construites par fileTreeMutations.ts,
 * qui connaît les détails de chaque opération) — ce module ne fait
 * qu'empiler/dépiler, il ignore ce que fait réellement une entrée.
 */

import type { useStore } from "jotai";
import {
  type FileUndoEntry,
  fileRedoStackAtom,
  fileUndoStackAtom,
} from "./atoms";
import { createLogger } from "./logger";

type JotaiStore = ReturnType<typeof useStore>;

const log = createLogger("fileTreeUndo");

// Profondeur bornée — un historique de session, pas un journal persistant.
const UNDO_STACK_LIMIT = 20;

// Empile une action tout juste effectuée. Toute nouvelle action invalide la
// pile "rétablir" (comme n'importe quel undo/redo standard : on ne peut pas
// rétablir une branche qu'on vient d'abandonner en agissant à nouveau).
export function pushFileUndo(store: JotaiStore, entry: FileUndoEntry): void {
  store.set(fileUndoStackAtom, (prev) =>
    [...prev, entry].slice(-UNDO_STACK_LIMIT)
  );
  store.set(fileRedoStackAtom, []);
}

export async function undoLastFileAction(store: JotaiStore): Promise<void> {
  const stack = store.get(fileUndoStackAtom);
  const entry = stack[stack.length - 1];
  if (!entry) return;
  store.set(fileUndoStackAtom, stack.slice(0, -1));
  try {
    await entry.undo();
    store.set(fileRedoStackAtom, (prev) => [...prev, entry]);
    log.info("action annulée", { label: entry.label });
  } catch (err) {
    // État disque incertain après un échec en cours d'annulation — on ne
    // remet pas l'entrée en pile (rejouer aveuglément serait plus risqué
    // qu'abandonner l'annulation).
    log.error("annulation échouée", { label: entry.label, error: String(err) });
  }
}

export async function redoLastFileAction(store: JotaiStore): Promise<void> {
  const stack = store.get(fileRedoStackAtom);
  const entry = stack[stack.length - 1];
  if (!entry) return;
  store.set(fileRedoStackAtom, stack.slice(0, -1));
  try {
    await entry.redo();
    store.set(fileUndoStackAtom, (prev) => [...prev, entry]);
    log.info("action rétablie", { label: entry.label });
  } catch (err) {
    log.error("rétablissement échoué", {
      label: entry.label,
      error: String(err),
    });
  }
}
