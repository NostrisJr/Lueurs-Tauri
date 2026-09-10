import { useAtomValue } from "jotai";
import { useCallback, useRef, useState } from "react";
import {
  type AggregationOp,
  type TableAggregations,
  parseTableAggregations,
  serializeTableAggregations,
} from "../lib/aggregations";
import {
  notesByIdAtom,
  parseTableColumns,
  serializeTableColumns,
} from "../lib/atoms";
import { createLogger } from "../lib/logger";
import { SystemField } from "../lib/noteTypes";
import { computeTableColumns } from "./lib/tableColumns";
import type { Frontmatter, NoteFile } from "./useFileTree";
import { usePersistNote } from "./usePersistNote";

export type { TableColumn } from "./lib/tableColumns";

const log = createLogger("useTable");

const DEFAULT_COL_WIDTH = 180;
const MIN_COL_WIDTH = 80;
const TITLE_COL_WIDTH = 200;

interface UseTableProps {
  base: NoteFile;
  onBaseChange: (frontmatter: Frontmatter) => void;
}

export function useTable({ base, onBaseChange }: UseTableProps) {
  const notesById = useAtomValue(notesByIdAtom);
  const persistPatch = usePersistNote();

  const savedWidths = parseTableColumns(
    base.frontmatter[SystemField.TABLE_COLUMNS] as string | undefined
  );

  // ── Calcul des colonnes depuis les templates de la base ────────────────

  const templatePaths = base.frontmatter[SystemField.TEMPLATE];
  const paths = Array.isArray(templatePaths) ? (templatePaths as string[]) : [];
  const templates = paths
    .map((p) => notesById.get(p))
    .filter((n): n is NoteFile => !!n);

  // Union de toutes les props non-système des templates — premier template
  // gagne pour l'ordre. Contraintes ENUM/NUMBER calculées via
  // computeTemplateConstraints, partagée avec le panneau frontmatter (cf.
  // useTemplateConstraints) — pas dupliquée ici.
  const columns = computeTableColumns(templates, savedWidths);

  // Notes enfant
  const childrenPaths = base.frontmatter[SystemField.CHILDREN];
  const childPaths = Array.isArray(childrenPaths)
    ? (childrenPaths as string[])
    : [];
  const childNotes = childPaths
    .map((p) => notesById.get(p))
    .filter((n): n is NoteFile => !!n);

  // ── Agrégations ───────────────────────────────────────────────────────

  const savedAggregations = parseTableAggregations(
    base.frontmatter[SystemField.TABLE_AGGREGATIONS] as string | undefined
  );
  const [aggregations, setAggregationsState] =
    useState<TableAggregations>(savedAggregations);

  const setAggregation = useCallback(
    (key: string, op: AggregationOp) => {
      const updated = { ...aggregations, [key]: op };
      setAggregationsState(updated);
      log.info("agrégation modifiée", { baseId: base.id, key, op });

      let newFrontmatter: Frontmatter = {
        ...base.frontmatter,
        [SystemField.TABLE_AGGREGATIONS]: serializeTableAggregations(updated),
      };

      // Retirer l'ancienne propriété résultat si une op différente existait
      const oldOp = aggregations[key];
      if (oldOp && oldOp !== "none") {
        const oldPropKey = `__Agg_${key}_${oldOp}__`;
        newFrontmatter = Object.fromEntries(
          Object.entries(newFrontmatter).filter(([k]) => k !== oldPropKey)
        ) as Frontmatter;
      }

      // Ajouter la nouvelle propriété résultat comme formule dynamique
      if (op !== "none") {
        newFrontmatter = {
          ...newFrontmatter,
          [`__Agg_${key}_${op}__`]: `$$agg(${key},${op})$$`,
        };
      }

      onBaseChange(newFrontmatter);
    },
    [aggregations, base, onBaseChange]
  );

  const renameAggregationKey = useCallback(
    (oldKey: string, newKey: string) => {
      const op = aggregations[oldKey];
      if (!op || op === "none") return;

      const newAggs: TableAggregations = Object.fromEntries(
        Object.entries(aggregations).map(([k, v]) => [
          k === oldKey ? newKey : k,
          v,
        ])
      );

      const newFm: Frontmatter = Object.fromEntries(
        Object.entries(base.frontmatter).map(([k, v]) => {
          if (k === `__Agg_${oldKey}_${op}__`) {
            return [`__Agg_${newKey}_${op}__`, `$$agg(${newKey},${op})$$`];
          }
          if (k === SystemField.TABLE_AGGREGATIONS) {
            return [k, serializeTableAggregations(newAggs)];
          }
          return [k, v];
        })
      ) as Frontmatter;

      setAggregationsState(newAggs);
      onBaseChange(newFm);
    },
    [aggregations, base.frontmatter, onBaseChange]
  );

  // ── Resize ────────────────────────────────────────────────────────────

  const [colWidths, setColWidths] =
    useState<Record<string, number>>(savedWidths);
  const resizeState = useRef<{
    key: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const onResizeStart = useCallback(
    (key: string, e: React.PointerEvent) => {
      e.preventDefault();
      const currentWidth = colWidths[key] ?? DEFAULT_COL_WIDTH;
      resizeState.current = {
        key,
        startX: e.clientX,
        startWidth: currentWidth,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [colWidths]
  );

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeState.current) return;
    const { key, startX, startWidth } = resizeState.current;
    const delta = e.clientX - startX;
    const newWidth = Math.max(MIN_COL_WIDTH, startWidth + delta);
    setColWidths((prev) => ({ ...prev, [key]: newWidth }));
  }, []);

  const onResizeEnd = useCallback(() => {
    if (!resizeState.current) return;
    resizeState.current = null;
    log.info("largeurs colonnes persistées", { baseId: base.id });
    onBaseChange({
      ...base.frontmatter,
      [SystemField.TABLE_COLUMNS]: serializeTableColumns(colWidths),
    });
  }, [base, colWidths, onBaseChange]);

  // ── Édition cellule ───────────────────────────────────────────────────

  const editCell = useCallback(
    async (note: NoteFile, key: string, value: string) => {
      if (note.frontmatter[key] === value) return;
      const updated: Frontmatter = { ...note.frontmatter, [key]: value };
      await persistPatch(note.id, updated, note.body);
      log.info("cellule éditée", { noteId: note.id, key, value });
    },
    [persistPatch]
  );

  return {
    columns: columns.map((c) => ({ ...c, width: colWidths[c.key] ?? c.width })),
    childNotes,
    titleColWidth: TITLE_COL_WIDTH,
    aggregations,
    setAggregation,
    renameAggregationKey,
    onResizeStart,
    onResizeMove,
    onResizeEnd,
    editCell,
  };
}
