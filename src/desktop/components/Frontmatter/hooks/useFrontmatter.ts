import { useStore } from "jotai";

import type {
  Frontmatter,
  NoteFile,
} from "../../../../shared/hooks/useFileTree";
import { usePersistNote } from "../../../../shared/hooks/usePersistNote";
import { notesByIdAtom } from "../../../../shared/lib/atoms";
import {
  arraysEqualUnordered,
  computeTemplateProps,
  toArray,
} from "../../../../shared/lib/fileTreeHelpers";
import { createLogger } from "../../../../shared/lib/logger";
import { NoteType } from "../../../../shared/lib/noteTypes";

const log = createLogger("useFrontmatter");

// ── Hook ───────────────────────────────────────────────────────────────────

export function useFrontmatter() {
  const store = useStore();
  const persistPatch = usePersistNote();

  function getNotesById() {
    return store.get(notesByIdAtom);
  }

  async function applyTemplateProps(
    noteId: string,
    frontmatter: Frontmatter
  ): Promise<Frontmatter | null> {
    // Les bases ne sont pas contraintes par leurs propres templates
    if (frontmatter.__Type__ === NoteType.BASE) return null;

    const notesById = getNotesById();
    const directTemplates = toArray(frontmatter.__Template__);
    const parentBases = toArray(frontmatter.__Base__);
    const inheritedTemplates = parentBases.flatMap((basePath) => {
      const base = notesById.get(basePath);
      return base ? toArray(base.frontmatter.__Template__) : [];
    });
    const allTemplatePaths = [
      ...new Set([...directTemplates, ...inheritedTemplates]),
    ];
    const templates = allTemplatePaths
      .map((p) => {
        const t = notesById.get(p);
        if (!t) log.warn("template introuvable", { templatePath: p });
        return t?.frontmatter;
      })
      .filter((f): f is Frontmatter => !!f);

    if (templates.length === 0) return null;

    const { updated, changed } = computeTemplateProps(frontmatter, templates, {
      applyForced: true,
    });
    if (changed.length === 0) return null;

    const note = notesById.get(noteId);
    if (!note) return updated;

    await persistPatch(noteId, updated, note.body);
    log.info("propriétés template appliquées", { noteId, changed });
    return updated;
  }

  async function onFrontmatterChange(
    noteId: string,
    prevFrontmatter: Frontmatter,
    nextFrontmatter: Frontmatter
  ) {
    const prevBases = toArray(prevFrontmatter.__Base__);
    const nextBases = toArray(nextFrontmatter.__Base__);

    if (!arraysEqualUnordered(prevBases, nextBases)) {
      log.info("__Base__ modifié", { noteId, prevBases, nextBases });
      const basesAdded = nextBases.filter((b) => !prevBases.includes(b));
      const basesRemoved = prevBases.filter((b) => !nextBases.includes(b));
      await Promise.all([
        ...basesAdded.map((basePath) => addToChildren(basePath, noteId)),
        ...basesRemoved.map((basePath) => removeFromChildren(basePath, noteId)),
      ]);
    }

    const templateChanged = !arraysEqualUnordered(
      toArray(prevFrontmatter.__Template__),
      toArray(nextFrontmatter.__Template__)
    );
    if (templateChanged || !arraysEqualUnordered(prevBases, nextBases)) {
      await applyTemplateProps(noteId, nextFrontmatter);

      if (templateChanged) {
        const children = toArray(nextFrontmatter.__Children__);
        await Promise.all(
          children.map(async (childPath) => {
            const child = getNotesById().get(childPath);
            if (child) await applyTemplateProps(childPath, child.frontmatter);
          })
        );
        if (children.length > 0) {
          log.info("template propagé aux enfants de la base", {
            noteId,
            childCount: children.length,
          });
        }
      }
    }

    const prevChildren = toArray(prevFrontmatter.__Children__);
    const nextChildren = toArray(nextFrontmatter.__Children__);

    if (!arraysEqualUnordered(prevChildren, nextChildren)) {
      log.info("__Children__ modifié", { noteId, prevChildren, nextChildren });
      const childrenAdded = nextChildren.filter(
        (c) => !prevChildren.includes(c)
      );
      const childrenRemoved = prevChildren.filter(
        (c) => !nextChildren.includes(c)
      );
      await Promise.all([
        ...childrenAdded.map((childPath) => addBaseToNote(childPath, noteId)),
        ...childrenRemoved.map((childPath) =>
          removeBaseFromNote(childPath, noteId)
        ),
      ]);
    }
  }

  async function addToChildren(basePath: string, noteId: string) {
    const base = getNotesById().get(basePath);
    if (!base) {
      log.warn("base introuvable pour ajout __Children__", { basePath });
      return;
    }
    const children = toArray(base.frontmatter.__Children__);
    if (children.includes(noteId)) return;
    await writeBaseChildren(base, [...children, noteId]);
    log.info("note ajoutée à __Children__", { basePath, noteId });
  }

  async function removeFromChildren(basePath: string, noteId: string) {
    const base = getNotesById().get(basePath);
    if (!base) {
      log.warn("base introuvable pour retrait __Children__", { basePath });
      return;
    }
    const children = toArray(base.frontmatter.__Children__);
    const updated = children.filter((c) => c !== noteId);
    if (updated.length === children.length) return;
    await writeBaseChildren(base, updated);
    log.info("note retirée de __Children__", { basePath, noteId });
  }

  async function addBaseToNote(notePath: string, basePath: string) {
    const note = getNotesById().get(notePath);
    if (!note) {
      log.warn("note enfant introuvable pour ajout __Base__", { notePath });
      return;
    }
    const bases = toArray(note.frontmatter.__Base__);
    if (bases.includes(basePath)) return;
    const updatedFrontmatter = await writeNoteBase(note, [...bases, basePath]);
    await applyTemplateProps(notePath, updatedFrontmatter);
    log.info("__Base__ ajouté à la note enfant", { notePath, basePath });
  }

  async function removeBaseFromNote(notePath: string, basePath: string) {
    const note = getNotesById().get(notePath);
    if (!note) {
      log.warn("note enfant introuvable pour retrait __Base__", { notePath });
      return;
    }
    const bases = toArray(note.frontmatter.__Base__);
    const updated = bases.filter((b) => b !== basePath);
    if (updated.length === bases.length) return;
    await writeNoteBase(note, updated);
    log.info("__Base__ retiré de la note enfant", { notePath, basePath });
  }

  async function writeNoteBase(
    note: NoteFile,
    bases: string[]
  ): Promise<Frontmatter> {
    const updatedFrontmatter: Frontmatter = {
      ...note.frontmatter,
      __Base__: bases,
    };
    await persistPatch(note.id, updatedFrontmatter, note.body);
    log.info("__Base__ persisté", { noteId: note.id, count: bases.length });
    return updatedFrontmatter;
  }

  /** Persistance fire-and-forget — l'arbre est mis à jour après l'écriture disque. */
  function writeBaseChildren(base: NoteFile, children: string[]) {
    const updatedFrontmatter: Frontmatter = {
      ...base.frontmatter,
      __Children__: children,
    };
    persistPatch(base.id, updatedFrontmatter, base.body).catch((err) =>
      log.error("échec persistance __Children__", { baseId: base.id, err })
    );
    log.info("__Children__ mis à jour", {
      baseId: base.id,
      count: children.length,
    });
  }

  async function cleanupNoteFromBases(noteId: string) {
    const bases = [...getNotesById().values()].filter((n) =>
      toArray(n.frontmatter.__Children__).includes(noteId)
    );
    log.info("cleanup — bases trouvées", { noteId, baseCount: bases.length });
    if (bases.length === 0) return;
    for (const base of bases) {
      const updated = toArray(base.frontmatter.__Children__).filter(
        (c) => c !== noteId
      );
      writeBaseChildren(base, updated);
    }
    log.info("cleanup terminé", { noteId });
  }

  return {
    onFrontmatterChange,
    applyTemplateProps,
    cleanupNoteFromBases,
  };
}
