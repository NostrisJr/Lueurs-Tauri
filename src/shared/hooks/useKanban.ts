import { message } from "@tauri-apps/plugin-dialog";
import { useAtomValue } from "jotai";
import { useCallback, useRef, useState } from "react";
import { useTemplateSync } from "../../desktop/hooks/useTemplateSync";
import {
  type ButtonDef,
  parseButton,
  serializeButton,
} from "../lib/FrontmatterPicker/buttonProperty";
import {
  type KanbanCards,
  NO_VALUE_COLUMN_ID,
  generateColumnId,
  kanbanCardsAtom,
  notesByIdAtom,
  parseColumns,
  serializeColumns,
} from "../lib/atoms";
import {
  buttonColumns,
  getButtonProps,
  getFreeProps,
  resolveButtonKey,
} from "../lib/fileTreeHelpers";
import { createLogger } from "../lib/logger";
import { type KanbanColumn, SystemField } from "../lib/noteTypes";
import type { Frontmatter, NoteFile } from "./useFileTree";
import { usePersistNote } from "./usePersistNote";

const log = createLogger("useKanban");

interface UseKanbanProps {
  base: NoteFile;
  onBaseChange: (frontmatter: Frontmatter) => void;
}

// ── Helper exporté ────────────────────────────────────────────────────────────

export function getAvailableKanbanKeys(
  base: NoteFile,
  notesById: Map<string, NoteFile>
): string[] {
  const templatePaths = base.frontmatter[SystemField.TEMPLATE];
  if (
    !templatePaths ||
    !Array.isArray(templatePaths) ||
    templatePaths.length === 0
  )
    return [];

  // Dédupliquer — plusieurs templates peuvent avoir la même propriété
  const seen = new Set<string>();
  return templatePaths.flatMap((path) => {
    const template = notesById.get(path);
    if (!template) return [];
    // Props libres (valeur vide) + props contraintes BUTTON
    return [
      ...getFreeProps(template.frontmatter),
      ...getButtonProps(template.frontmatter),
    ].filter((k) => !seen.has(k) && seen.add(k));
  });
}

/** Valeurs possibles d'une propriété libre à travers les templates de la base. */
export function getTemplateValues(
  base: NoteFile,
  notesById: Map<string, NoteFile>,
  key: string
): string[] {
  const templatePaths = base.frontmatter[SystemField.TEMPLATE];
  if (!templatePaths || !Array.isArray(templatePaths)) return [];

  const seen = new Set<string>();
  const values: string[] = [];
  for (const path of templatePaths as string[]) {
    const template = notesById.get(path);
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
  const notesById = useAtomValue(notesByIdAtom);
  const persistPatch = usePersistNote();
  const { onTemplateChange } = useTemplateSync();

  const kanbanKey = base.frontmatter[SystemField.KANBAN_KEY] as
    | string
    | undefined;

  // Clé BUTTON : colonnes dérivées des options du/des template(s) (avec couleurs),
  // toute mutation de colonne édite la formule BUTTON et se propage via onTemplateChange.
  // Clé libre : colonnes persistées dans __KanbanColumns__, propagation manuelle.
  const buttonKey = kanbanKey
    ? resolveButtonKey(base, notesById, kanbanKey)
    : null;
  const persistedColumns = parseColumns(
    base.frontmatter[SystemField.KANBAN_COLUMNS]
  );
  const columns = buttonKey ? buttonColumns(buttonKey.def) : persistedColumns;

  const childNotes = (() => {
    const paths = Array.isArray(base.frontmatter[SystemField.CHILDREN])
      ? (base.frontmatter[SystemField.CHILDREN] as string[])
      : [];
    return paths.map((p) => notesById.get(p)).filter((n): n is NoteFile => !!n);
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

  const initKanban = useCallback(
    (key: string) => {
      log.info("initialisation kanban", { baseId: base.id, key });

      // Clé BUTTON : colonnes dérivées des options du template, pas de __KanbanColumns__
      if (resolveButtonKey(base, notesById, key)) {
        onBaseChange({
          ...base.frontmatter,
          [SystemField.VIEW]: "kanban",
          [SystemField.KANBAN_KEY]: key,
        });
        return;
      }

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
          : getTemplateValues(base, notesById, key);

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
    [base, childNotes, notesById, onBaseChange]
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
        : columns.find((c) => c.id === toColId);
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
    [kanbanKey, columns, childNotes, persistPatch]
  );

  // ── Gestion des colonnes ──────────────────────────────────────────────

  // Clé BUTTON : édite la formule du/des template(s) puis propage aux héritiers
  // via onTemplateChange (renameEnumValue / enforceEnum déjà gérés par le pipeline).
  const mutateButtonTemplates = useCallback(
    async (mutate: (def: ButtonDef) => ButtonDef) => {
      if (!kanbanKey || !buttonKey) return;
      for (const template of buttonKey.templates) {
        const def = parseButton(template.frontmatter[kanbanKey] as string);
        if (!def) continue;
        const prev = template.frontmatter;
        const next: Frontmatter = {
          ...template.frontmatter,
          [kanbanKey]: serializeButton(mutate(def)),
        };
        await persistPatch(template.id, next, template.body);
        await onTemplateChange(template.id, prev, next);
      }
    },
    [kanbanKey, buttonKey, persistPatch, onTemplateChange]
  );

  const addColumn = useCallback(
    async (label: string) => {
      log.info("ajout colonne", { baseId: base.id, label });

      if (buttonKey) {
        await mutateButtonTemplates((def) =>
          def.options.some((o) => o.value === label)
            ? def
            : { ...def, options: [...def.options, { value: label }] }
        );
        return;
      }

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
    [base, buttonKey, persistedColumns, onBaseChange, mutateButtonTemplates]
  );

  const renameColumn = useCallback(
    async (colId: string, newLabel: string) => {
      const col = columns.find((c) => c.id === colId);
      if (!col || !kanbanKey) return;

      log.info("renommage colonne", { colId, oldLabel: col.label, newLabel });

      // Clé BUTTON : renomme l'option dans le template → propagation auto aux héritiers
      if (buttonKey) {
        await mutateButtonTemplates((def) => ({
          ...def,
          options: def.options.map((o) =>
            o.value === col.label ? { ...o, value: newLabel } : o
          ),
          default: def.default === col.label ? newLabel : def.default,
        }));
        return;
      }

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
    [
      base,
      columns,
      persistedColumns,
      buttonKey,
      kanbanKey,
      childNotes,
      onBaseChange,
      persistPatch,
      mutateButtonTemplates,
    ]
  );

  // Supprime une colonne. Clé BUTTON : retire l'option du template (les héritiers
  // concernés retombent sur le default via enforceEnum). Clé libre : retire la
  // colonne de __KanbanColumns__ (les notes concernées passent en « Sans valeur »).
  const removeColumn = useCallback(
    async (colId: string) => {
      const col = columns.find((c) => c.id === colId);
      if (!col) return;

      log.info("suppression colonne", { colId, label: col.label });

      if (buttonKey) {
        await mutateButtonTemplates((def) => {
          const options = def.options.filter((o) => o.value !== col.label);
          const def_ =
            def.default === col.label ? (options[0]?.value ?? "") : def.default;
          return { options, default: def_ };
        });
        return;
      }

      onBaseChange({
        ...base.frontmatter,
        [SystemField.KANBAN_COLUMNS]: serializeColumns(
          persistedColumns.filter((c) => c.id !== colId)
        ),
      });
    },
    [
      base,
      columns,
      buttonKey,
      persistedColumns,
      onBaseChange,
      mutateButtonTemplates,
    ]
  );

  // Recolore une colonne BUTTON → modifie la couleur de l'option dans le template.
  // Sans effet sur les héritiers (ils ne stockent que la valeur, pas la couleur).
  const setColumnColor = useCallback(
    async (colId: string, color: string | undefined) => {
      const col = columns.find((c) => c.id === colId);
      if (!col || !buttonKey) return;

      log.info("recoloration colonne", { colId, label: col.label, color });

      await mutateButtonTemplates((def) => ({
        ...def,
        options: def.options.map((o) =>
          o.value === col.label ? { ...o, color } : o
        ),
      }));
    },
    [columns, buttonKey, mutateButtonTemplates]
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
    isButtonKey: !!buttonKey,
    columns,
    cards,
    availableKeys: getAvailableKanbanKeys(base, notesById),
    initKanban,
    removeKanban,
    moveCard,
    addColumn,
    renameColumn,
    removeColumn,
    setColumnColor,
    reorderColumns,
  };
}
