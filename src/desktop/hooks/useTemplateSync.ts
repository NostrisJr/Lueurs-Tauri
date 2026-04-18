import { useAtomValue, useSetAtom, useStore } from "jotai";
import {
  treeAtom,
  folderPathAtom,
  writingPathsRegistry,
  skipPropagationAtom,
} from "../../shared/lib/Atoms";
import {
  flattenTree,
  type Frontmatter,
  type NoteFile,
} from "../../shared/hooks/useFileTree";
import {
  parseTableAggregations,
  serializeTableAggregations,
} from "../../shared/lib/aggregations";
import {
  toArray,
  isSystemField,
  updateNodeInTree,
} from "../../shared/lib/fileTreeHelpers";
import { invoke } from "@tauri-apps/api/core";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { createLogger } from "../../shared/lib/logger";
import { loadTree, applyAllTemplates } from "../../shared/lib/vaultIO";
import { NoteType, SystemField } from "../../shared/lib/noteTypes";
import { usePersistNote } from "../../shared/hooks/usePersistNote";

const log = createLogger("useTemplateSync");

// ── Types ──────────────────────────────────────────────────────────────────

type TemplateChange =
  | { type: "addProp"; key: string; value?: string }
  | { type: "removeProp"; key: string }
  // template_value : valeur du template pour new_key — détermine si la prop est imposée ou libre
  | {
      type: "renameProp";
      old_key: string;
      new_key: string;
      template_value?: string;
    }
  | { type: "forceValue"; key: string; value: string };

interface PropagateResult {
  modified: number;
  errors: string[];
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTemplateSync() {
  const store = useStore();
  const setTree = useSetAtom(treeAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const setSkipPropagation = useSetAtom(skipPropagationAtom);
  const persistPatch = usePersistNote();

  async function onTemplateChange(
    templateId: string,
    prev: Frontmatter,
    next: Frontmatter
  ) {
    if (!folderPath) return;

    const changes = diffFrontmatter(prev, next);
    if (changes.length === 0) return;

    // Lire skipPropagationAtom au moment de l'exécution (pas au rendu)
    const skipPropagation = store.get(skipPropagationAtom);

    const filteredChanges = changes.filter((change) => {
      if (change.type !== "removeProp") return true;
      if (skipPropagation.has(change.key)) {
        log.info("propagation ignorée pour cette clé", { key: change.key });
        return false;
      }
      return true;
    });

    // Vider l'atom après consommation
    if (skipPropagation.size > 0) setSkipPropagation(new Set());

    log.info("changements template détectés", {
      templateId,
      changes: filteredChanges,
    });
    for (const change of filteredChanges) {
      await propagate(templateId, change);
    }
  }

  async function renameTemplateProperty(
    templateId: string,
    oldKey: string,
    newKey: string
  ) {
    if (!folderPath) return;

    // Lire la valeur actuelle du template pour old_key — détermine si la prop est imposée
    const freshNotes = flattenTree(store.get(treeAtom));
    const templateNote = freshNotes.find((n) => n.id === templateId);
    const templateValue = templateNote
      ? ((templateNote.frontmatter[oldKey] as string) ?? "")
      : "";

    const allPaths = [templateId, ...resolveAllHeirs(templateId)];
    log.info("renommage propriété template", {
      templateId,
      oldKey,
      newKey,
      pathCount: allPaths.length,
      templateValue,
    });

    for (const p of allPaths) writingPathsRegistry.add(p);

    try {
      const result = await invoke<PropagateResult>(
        "propagate_template_change",
        {
          affectedPaths: allPaths,
          change: {
            type: "renameProp",
            old_key: oldKey,
            new_key: newKey,
            template_value: templateValue,
          },
        }
      );
      log.info("renommage Rust terminé", {
        modified: result.modified,
        errors: result.errors,
      });

      const nodes = await loadTree(folderPath, folderPath);
      const finalNodes = await applyAllTemplates(nodes, folderPath);
      setTree(finalNodes);
    } finally {
      for (const p of allPaths) writingPathsRegistry.delete(p);
    }

    // Agrégations des bases héritières — exclues du renommage Rust, à patcher séparément
    for (const base of resolveHeirBases(templateId)) {
      await renameBaseAggregations(base, oldKey, newKey);
    }
  }

  /**
   * Vérifie si une propriété est utilisée comme KanbanKey dans une base héritière.
   * Propose de supprimer la vue Kanban en cascade.
   * Retourne false si l'utilisateur refuse (annule la suppression de la propriété).
   */
  async function checkKanbanKeyUsage(
    templateId: string,
    propKey: string
  ): Promise<boolean> {
    const affectedBases = resolveHeirBases(templateId).filter(
      (base) => base.frontmatter[SystemField.KANBAN_KEY] === propKey
    );

    if (affectedBases.length === 0) return true;

    const baseNames = affectedBases.map((b) => b.name).join(", ");
    log.info("propriété utilisée comme KanbanKey", {
      propKey,
      bases: baseNames,
    });

    const confirmed = await ask(
      `La propriété "${propKey}" est utilisée comme clé Kanban dans : ${baseNames}.\n\nSupprimer aussi la vue Kanban de ces bases ?`,
      { title: "Propriété Kanban", kind: "warning" }
    );

    if (!confirmed) {
      log.info("suppression annulée — KanbanKey protégée", { propKey });
      return false;
    }

    for (const base of affectedBases) {
      const {
        [SystemField.VIEW]: _v,
        [SystemField.KANBAN_KEY]: _k,
        [SystemField.KANBAN_COLUMNS]: _c,
        ...rest
      } = base.frontmatter;
      writingPathsRegistry.add(base.id);
      try {
        await persistPatch(base.id, rest, base.body);
        log.info("vue Kanban supprimée de la base", { baseId: base.id });
      } catch (err) {
        log.error("échec suppression vue Kanban", { baseId: base.id, err });
        await message(`Impossible de modifier la base "${base.name}".`, {
          title: "Erreur",
          kind: "error",
        });
      } finally {
        writingPathsRegistry.delete(base.id);
      }
    }

    return true;
  }

  // ── Helpers privés ─────────────────────────────────────────────────────

  async function renameBaseAggregations(
    base: NoteFile,
    oldKey: string,
    newKey: string
  ) {
    const raw = base.frontmatter[SystemField.TABLE_AGGREGATIONS] as
      | string
      | undefined;
    const aggs = parseTableAggregations(raw);
    const op = aggs[oldKey];
    if (!op || op === "none") return;

    const newAggs = Object.fromEntries(
      Object.entries(aggs).map(([k, v]) => [k === oldKey ? newKey : k, v])
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

    log.info("renommage agrégations base", {
      baseId: base.id,
      oldKey,
      newKey,
      op,
    });
    await persistPatch(base.id, newFm, base.body);
  }

  async function propagate(templateId: string, change: TemplateChange) {
    if (!folderPath) return;

    const affectedPaths = resolveAllHeirs(templateId);
    if (affectedPaths.length === 0) {
      log.info("aucun héritier trouvé — pas de propagation", {
        templateId,
        change,
      });
      return;
    }

    log.info("propagation vers héritiers", {
      templateId,
      change,
      count: affectedPaths.length,
    });
    for (const p of affectedPaths) writingPathsRegistry.add(p);

    try {
      const result = await invoke<PropagateResult>(
        "propagate_template_change",
        {
          affectedPaths,
          change,
        }
      );
      log.info("propagation Rust terminée", {
        modified: result.modified,
        errors: result.errors,
      });

      // Mise à jour chirurgicale du treeAtom — évite un rechargement complet du disque
      setTree((prev) => {
        let updated = prev;
        for (const path of affectedPaths) {
          const note = flattenTree(updated).find((n) => n.id === path);
          if (!note) continue;
          const fm = note.frontmatter;
          let newFm: Frontmatter | null = null;

          if (change.type === "addProp" && !(change.key in fm)) {
            newFm = { ...fm, [change.key]: change.value ?? "" };
          } else if (change.type === "removeProp" && change.key in fm) {
            newFm = Object.fromEntries(
              Object.entries(fm).filter(([k]) => k !== change.key)
            ) as Frontmatter;
          } else if (
            change.type === "forceValue" &&
            fm[change.key] !== change.value
          ) {
            newFm = { ...fm, [change.key]: change.value };
          } else if (change.type === "renameProp" && change.old_key in fm) {
            newFm = applyRenameConflict(
              fm,
              change.old_key,
              change.new_key,
              change.template_value
            );
          }

          if (newFm) {
            updated = updateNodeInTree(updated, path, {
              frontmatter: newFm,
            }) as typeof prev;
          }
        }
        return updated;
      });
    } finally {
      for (const p of affectedPaths) writingPathsRegistry.delete(p);
    }
  }

  // Toujours lire le treeAtom le plus récent — évite les snapshots périmés lors des callbacks async
  function resolveAllHeirs(templateId: string): string[] {
    const freshNotes = flattenTree(store.get(treeAtom));
    return freshNotes
      .filter((note) => {
        if (note.id === templateId) return false;
        if (note.type === NoteType.BASE) return false;

        const directTemplates = toArray(note.frontmatter.__Template__);
        if (directTemplates.includes(templateId)) return true;

        const bases = toArray(note.frontmatter.__Base__);
        return bases.some((basePath) => {
          const base = freshNotes.find((n) => n.id === basePath);
          return base
            ? toArray(base.frontmatter.__Template__).includes(templateId)
            : false;
        });
      })
      .map((n) => n.id);
  }

  function resolveHeirBases(templateId: string) {
    const freshNotes = flattenTree(store.get(treeAtom));
    return freshNotes.filter(
      (note) =>
        note.type === NoteType.BASE &&
        toArray(note.frontmatter.__Template__).includes(templateId)
    );
  }

  return { onTemplateChange, renameTemplateProperty, checkKanbanKeyUsage };
}

// ── Helpers purs ───────────────────────────────────────────────────────────

/**
 * Résolution de conflit lors du renommage d'une propriété template.
 * Si new_key existe déjà dans la note :
 *   - prop imposée (templateValue non vide) → la valeur du template prime
 *   - prop libre (templateValue vide) → la valeur existante de la note est conservée
 * Si pas de conflit : renommage simple (valeur de old_key préservée).
 */
function applyRenameConflict(
  fm: Frontmatter,
  oldKey: string,
  newKey: string,
  templateValue: string | undefined
): Frontmatter {
  const withoutOld = Object.fromEntries(
    Object.entries(fm).filter(([k]) => k !== oldKey)
  ) as Frontmatter;

  if (newKey in fm) {
    // Conflit : new_key existe déjà
    const imposed = !!templateValue;
    if (imposed) {
      // Propriété imposée : la valeur du template prime
      return { ...withoutOld, [newKey]: templateValue! };
    }
    // Propriété contraignante : old_key avait une valeur → elle prime ; sinon adopter new_key
    const oldVal = fm[oldKey];
    const oldIsEmpty = !oldVal || oldVal === "";
    if (!oldIsEmpty) {
      return { ...withoutOld, [newKey]: oldVal };
    }
    return withoutOld; // old_key vide → new_key conserve sa valeur
  }

  // Pas de conflit : renommage simple, préserver la valeur de old_key
  return { ...withoutOld, [newKey]: fm[oldKey] };
}

function diffFrontmatter(
  prev: Frontmatter,
  next: Frontmatter
): TemplateChange[] {
  const changes: TemplateChange[] = [];

  const prevKeys = Object.keys(prev).filter((k) => !isSystemField(k));
  const nextKeys = Object.keys(next).filter((k) => !isSystemField(k));

  const added = nextKeys.filter((k) => !(k in prev));
  const removed = prevKeys.filter((k) => !(k in next));

  if (added.length === 1 && removed.length === 1) {
    changes.push({
      type: "renameProp",
      old_key: removed[0],
      new_key: added[0],
      template_value: next[added[0]] as string | undefined,
    });
    return changes;
  }

  for (const key of added) {
    changes.push({
      type: "addProp",
      key,
      value: next[key] as string | undefined,
    });
  }
  for (const key of removed) {
    changes.push({ type: "removeProp", key });
  }

  for (const key of nextKeys) {
    if (key in prev && prev[key] !== next[key] && next[key]) {
      changes.push({ type: "forceValue", key, value: next[key] as string });
    }
  }

  return changes;
}
