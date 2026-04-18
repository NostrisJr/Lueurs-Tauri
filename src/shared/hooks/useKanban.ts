import { useState, useCallback, useRef } from "react";
import { message } from "@tauri-apps/plugin-dialog";
import { useAtomValue } from "jotai";
import {
  treeAtom,
  kanbanCardsAtom,
  parseColumns,
  serializeColumns,
  generateColumnId,
  NO_VALUE_COLUMN_ID,
  type KanbanCards,
} from "../lib/Atoms";
import { flattenTree, getFreeProps } from "../lib/fileTreeHelpers";
import { SystemField, type KanbanColumn } from "../lib/noteTypes";
import type { NoteFile, Frontmatter } from "./useFileTree";
import { createLogger } from "../lib/logger";
import { usePersistNote } from "./usePersistNote";

const log = createLogger("useKanban");

interface UseKanbanProps {
  base: NoteFile;
  onBaseChange: (frontmatter: Frontmatter) => void;
}

// ── Helper exporté ────────────────────────────────────────────────────────────

export function getAvailableKanbanKeys(
  base: NoteFile,
  allNotes: NoteFile[]
): string[] {
  const templatePaths = base.frontmatter[SystemField.TEMPLATE];
  if (
    !templatePaths ||
    !Array.isArray(templatePaths) ||
    templatePaths.length === 0
  )
    return [];

  // Dédupliquer — plusieurs templates peuvent avoir la même propriété libre
  const seen = new Set<string>();
  return templatePaths.flatMap((path) => {
    const template = allNotes.find((n) => n.id === path);
    if (!template) return [];
    return getFreeProps(template.frontmatter).filter(
      (k) => !seen.has(k) && seen.add(k)
    );
  });
}

/** Valeurs possibles d'une propriété libre à travers les templates de la base. */
export function getTemplateValues(
  base: NoteFile,
  allNotes: NoteFile[],
  key: string
): string[] {
  const templatePaths = base.frontmatter[SystemField.TEMPLATE];
  if (!templatePaths || !Array.isArray(templatePaths)) return [];

  const seen = new Set<string>();
  const values: string[] = [];
  for (const path of templatePaths as string[]) {
    const template = allNotes.find((n) => n.id === path);
    if (!template) continue;
    // Chercher les valeurs possibles dans les props du template (ex: enum stocké comme string "A faire,Fait")
    // Pour l'instant : valeur courante du template si non vide et non déjà vue
    const val = template.frontmatter[key];
    if (typeof val === "string" && val !== "" && !seen.has(val)) {
      seen.add(val);
      values.push(val);
    }
  }
  return values;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useKanban({ base, onBaseChange }: UseKanbanProps) {
  const allNotes = flattenTree(useAtomValue(treeAtom));
  const persistPatch = usePersistNote();

  const kanbanKey = base.frontmatter[SystemField.KANBAN_KEY] as
    | string
    | undefined;
  const persistedColumns = parseColumns(
    base.frontmatter[SystemField.KANBAN_COLUMNS]
  );

  const childNotes = (() => {
    const paths = Array.isArray(base.frontmatter[SystemField.CHILDREN])
      ? (base.frontmatter[SystemField.CHILDREN] as string[])
      : [];
    return paths
      .map((p) => allNotes.find((n) => n.id === p))
      .filter((n): n is NoteFile => !!n);
  })();

  // Cards dérivées de l'atom — source de vérité
  const derivedCards = useAtomValue(kanbanCardsAtom);

  // State optimistic actif uniquement pendant un drag
  const [optimisticCards, setOptimisticCards] = useState<KanbanCards | null>(
    null
  );
  const cards = optimisticCards ?? derivedCards;
  const derivedCardsRef = useRef(derivedCards);
  derivedCardsRef.current = derivedCards;

  // ── Initialisation / changement de clé ────────────────────────────────

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const initKanban = useCallback(
    (key: string) => {
      log.info("initialisation kanban", { baseId: base.id, key });

      // Valeurs depuis les notes enfant (non vides)
      const fromNotes = [
        ...new Set(
          childNotes
            .map((n) => n.frontmatter[key])
            .filter((v): v is string => typeof v === "string" && v !== "")
        ),
      ];

      // Fallback : valeurs possibles depuis les templates de la base
      const distinctValues =
        fromNotes.length > 0
          ? fromNotes
          : getTemplateValues(base, allNotes, key);

      const columns: KanbanColumn[] = distinctValues.map((label) => ({
        id: generateColumnId(),
        label,
      }));

      log.info("colonnes générées", { columns });

      onBaseChange({
        ...base.frontmatter,
        [SystemField.VIEW]: "kanban",
        [SystemField.KANBAN_KEY]: key,
        [SystemField.KANBAN_COLUMNS]: serializeColumns(columns),
      });
    },
    [base, childNotes, onBaseChange]
  );

  // ── Suppression de la vue ──────────────────────────────────────────────

  const removeKanban = useCallback(() => {
    log.info("suppression vue kanban", { baseId: base.id });
    const {
      [SystemField.VIEW]: _v,
      [SystemField.KANBAN_KEY]: _k,
      [SystemField.KANBAN_COLUMNS]: _c,
      ...rest
    } = base.frontmatter;
    onBaseChange(rest);
  }, [base, onBaseChange]);

  // ── Drag & drop ───────────────────────────────────────────────────────

  const moveCard = useCallback(
    async (noteId: string, fromColId: string, toColId: string) => {
      if (!kanbanKey || fromColId === toColId) return;

      // Colonne virtuelle "Sans valeur" — valeur cible est ""
      const isNoValueTarget = toColId === NO_VALUE_COLUMN_ID;
      const toCol = isNoValueTarget
        ? { id: NO_VALUE_COLUMN_ID, label: "" }
        : persistedColumns.find((c) => c.id === toColId);
      if (!toCol) {
        log.warn("colonne cible introuvable", { toColId });
        return;
      }

      const note = childNotes.find((n) => n.id === noteId);
      if (!note) {
        log.warn("note introuvable pour déplacement", { noteId });
        return;
      }

      log.info("déplacement carte", {
        noteId,
        fromColId,
        toColId,
        newLabel: toCol.label,
      });

      // Optimistic UI — surcharge derivedCards le temps de la persistance
      setOptimisticCards((prev) => {
        const base = prev ?? derivedCardsRef.current;
        return {
          ...base,
          [fromColId]: base[fromColId]?.filter((n) => n.id !== noteId) ?? [],
          [toColId]: [
            ...(base[toColId] ?? []),
            {
              ...note,
              frontmatter: { ...note.frontmatter, [kanbanKey]: toCol.label },
            },
          ],
        };
      });

      try {
        const updatedFrontmatter: Frontmatter = {
          ...note.frontmatter,
          [kanbanKey]: toCol.label,
        };
        await persistPatch(note.id, updatedFrontmatter, note.body);
        log.info("carte déplacée", {
          noteId,
          key: kanbanKey,
          value: toCol.label,
        });
        // kanbanCardsAtom se recalcule depuis treeAtom, on relâche l'optimistic
        setOptimisticCards(null);
      } catch (err) {
        log.error("échec déplacement carte — rollback UI", { noteId, err });
        setOptimisticCards(null);
        await message(`Impossible de déplacer la carte "${note.name}".`, {
          title: "Erreur",
          kind: "error",
        });
      }
    },
    [kanbanKey, persistedColumns, childNotes, persistPatch]
  );

  // ── Gestion des colonnes ──────────────────────────────────────────────

  const addColumn = useCallback(
    (label: string) => {
      log.info("ajout colonne", { baseId: base.id, label });
      const newCol: KanbanColumn = { id: generateColumnId(), label };

      onBaseChange({
        ...base.frontmatter,
        [SystemField.KANBAN_COLUMNS]: serializeColumns([
          ...persistedColumns,
          newCol,
        ]),
      });

      setOptimisticCards((prev) => ({
        ...(prev ?? derivedCardsRef.current),
        [newCol.id]: [],
      }));
    },
    [base, persistedColumns, onBaseChange]
  );

  const renameColumn = useCallback(
    async (colId: string, newLabel: string) => {
      const col = persistedColumns.find((c) => c.id === colId);
      if (!col || !kanbanKey) return;

      log.info("renommage colonne", { colId, oldLabel: col.label, newLabel });

      onBaseChange({
        ...base.frontmatter,
        [SystemField.KANBAN_COLUMNS]: serializeColumns(
          persistedColumns.map((c) =>
            c.id === colId ? { ...c, label: newLabel } : c
          )
        ),
      });

      const notesToPatch = childNotes.filter(
        (n) => n.frontmatter[kanbanKey] === col.label
      );
      log.info("patch notes suite au renommage", {
        count: notesToPatch.length,
        oldLabel: col.label,
      });

      const errors: string[] = [];
      await Promise.all(
        notesToPatch.map(async (note) => {
          try {
            const updatedFrontmatter = {
              ...note.frontmatter,
              [kanbanKey]: newLabel,
            };
            await persistPatch(note.id, updatedFrontmatter, note.body);
          } catch (err) {
            log.error("échec patch note lors renommage colonne", {
              noteId: note.id,
              err,
            });
            errors.push(note.name);
          }
        })
      );

      if (errors.length > 0) {
        await message(`Impossible de mettre à jour : ${errors.join(", ")}.`, {
          title: "Erreur",
          kind: "error",
        });
      }
    },
    [base, persistedColumns, kanbanKey, childNotes, onBaseChange, persistPatch]
  );

  const reorderColumns = useCallback(
    (newOrder: KanbanColumn[]) => {
      log.info("réordonnancement colonnes", { baseId: base.id });
      onBaseChange({
        ...base.frontmatter,
        [SystemField.KANBAN_COLUMNS]: serializeColumns(newOrder),
      });
    },
    [base, onBaseChange]
  );

  return {
    kanbanKey,
    columns: persistedColumns,
    cards,
    availableKeys: getAvailableKanbanKeys(base, allNotes),
    initKanban,
    removeKanban,
    moveCard,
    addColumn,
    renameColumn,
    reorderColumns,
  };
}
