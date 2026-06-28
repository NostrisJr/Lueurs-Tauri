// Assemblage récursif d'un FolderNode en source Typst pour la compilation multi-documents.
// Chaque sous-dossier devient une partie, chaque note un chapitre avec décalage de niveaux.

import type { FolderNode, NoteFile, TreeNode } from "../hooks/useFileTree";
import { parseMarkdownToDoc } from "./parseurMarkdown";
import {
  type InfosAuteur,
  type OptionsExport,
  type OptionsMultiDocument,
  construireEnteteTypst,
  construirePageTitre,
  construirePageTitreNote,
  convertirDocContenu,
  echapper,
} from "./proseToTypst";

interface Ctx {
  vaultPath: string;
  opts: OptionsExport;
  multi: OptionsMultiDocument;
  depth: number;
}

function assemblerDossier(folder: FolderNode, ctx: Ctx): string {
  // depth=0 → titre note H1 (offset=1), contenu interne décalé de +1 → H1→H2
  // depth=1 → titre note H2 (offset=2), contenu interne décalé de +2 → H1→H3, etc.
  const noteHeadingOffset = ctx.depth + 1;
  const parts: string[] = [];

  // Titre de section pour ce dossier (la racine a déjà son titre dans compilerDossierVersTypst)
  if (ctx.depth > 0) {
    const sectionMarqueur = "=".repeat(Math.min(ctx.depth + 1, 6));
    parts.push(`${sectionMarqueur} ${echapper(folder.name)}`);
  }

  for (const child of folder.children) {
    if (child.kind === "media") continue;

    if (child.kind === "folder") {
      const sous = assemblerDossier(child as FolderNode, {
        ...ctx,
        depth: ctx.depth + 1,
      });
      if (sous.trim()) parts.push(sous);
      continue;
    }

    const note = child as NoteFile;

    // Note de dossier (homepage du dossier, __Type__: __folder__)
    if (note.type === "__folder__") {
      if (ctx.multi.notesDossier === "ignorer") continue;
      // "preface" : contenu centré sur sa propre page, sans heading propre
      const doc = parseMarkdownToDoc(note.body);
      if (doc) {
        const contenu = convertirDocContenu(
          doc,
          ctx.vaultPath,
          ctx.opts.niveauNouvellePage,
          noteHeadingOffset
        );
        if (contenu.trim()) {
          if (ctx.multi.prefaceCentree) {
            parts.push(
              `#pagebreak(weak: true)\n#align(center + horizon)[\n${contenu}\n]\n#pagebreak()`
            );
          } else {
            parts.push(contenu);
          }
        }
      }
      continue;
    }

    // Note ordinaire → chapitre
    const pb = ctx.multi.nouvellePagesParNote ? "#pagebreak(weak: true)\n" : "";
    const doc = parseMarkdownToDoc(note.body);

    if (ctx.multi.titrageNotes === "contenu") {
      // Le H1 de la note sert de titre — on n'injecte pas de titre séparé.
      // Offset réduit d'un niveau pour que H1 arrive au niveau noteHeadingOffset.
      if (pb) parts.push(pb.trim());
      if (doc) {
        const contentOffset = Math.max(0, noteHeadingOffset - 1);
        const contenu = convertirDocContenu(
          doc,
          ctx.vaultPath,
          ctx.opts.niveauNouvellePage,
          contentOffset
        );
        if (contenu.trim()) parts.push(contenu);
      }
    } else {
      // titrageNotes === "nom" : nom du fichier comme titre de section
      if (ctx.multi.pageTitreParNote) {
        parts.push(construirePageTitreNote(note.name, noteHeadingOffset));
      } else {
        const marqueur = "=".repeat(Math.min(noteHeadingOffset, 6));
        parts.push(`${pb}${marqueur} ${echapper(note.name)}`);
      }
      if (doc) {
        // Offset = noteHeadingOffset : H1 interne → H(noteHeadingOffset+1), pas de saut
        const contenu = convertirDocContenu(
          doc,
          ctx.vaultPath,
          ctx.opts.niveauNouvellePage,
          noteHeadingOffset
        );
        if (contenu.trim()) parts.push(contenu);
      }
    }
  }

  return parts.filter(Boolean).join("\n\n");
}

/** Assemble un FolderNode et tous ses descendants en source Typst complet. */
export function compilerDossierVersTypst(
  folder: FolderNode,
  vaultPath: string,
  opts: OptionsExport,
  multi: OptionsMultiDocument,
  auteur?: InfosAuteur
): string {
  const entete = construireEnteteTypst(opts);
  const pageTitre = construirePageTitre(folder.name, opts, auteur);

  const miseAJourNums =
    opts.numerosPage && opts.numerotationApresSommaire && opts.sommaire
      ? "#_affNums.update(true)\n#counter(page).update(1)\n"
      : "";
  const sommaire = opts.sommaire
    ? `#outline(title: "Sommaire", indent: 1em)\n#pagebreak()\n${miseAJourNums}\n`
    : "";

  const titreLine =
    folder.name.trim() && !opts.pageDeTitre
      ? `= ${echapper(folder.name)}\n\n`
      : "";

  const corps = assemblerDossier(folder, {
    vaultPath,
    opts,
    multi,
    depth: 0,
  });

  return entete + pageTitre + sommaire + titreLine + corps;
}

// Ré-export du type pour éviter d'importer depuis deux endroits
export type { FolderNode, TreeNode };
