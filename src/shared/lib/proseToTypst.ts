// Conversion ProseMirror → Typst.
// Point d'entrée : proseMirrorDocVersTypst().
// Le chemin vault est requis pour résoudre les images.

import type { Mark, Node } from "@milkdown/kit/prose/model";
import { HIGHLIGHT_COLORS } from "../plugins/highlight/colors";

export interface InfosAuteur {
  prenom: string;
  nom: string;
  email: string;
  adresse: string;
}

export type NumerotationTitres = "none" | "1." | "1.1." | "I." | "i." | "A." | "a.";

export interface OptionsExport {
  format: "A4" | "A5" | "Letter" | "Legal";
  taille: "small" | "normal" | "large";
  marges: "etroites" | "normales" | "larges";
  police: "inter" | "garamond";
  interligne: "compact" | "normale" | "aeree";
  justification: boolean;
  barresLaterales: boolean;
  /** 0 = désactivé, 1-6 = niveaux H1 à Hn inclus démarrent sur une nouvelle page */
  niveauNouvellePage: number;
  pageDeTitre: boolean;
  sommaire: boolean;
  numerosPage: boolean;
  /** N'afficher les numéros qu'après le sommaire (requiert sommaire: true) */
  numerotationApresSommaire: boolean;
  indentation: boolean;
  /** Indenter aussi le 1er paragraphe après un titre */
  indenterPremierParagraphe: boolean;
  /** Inclure le bloc auteur sur la page de titre (requiert pageDeTitre: true) */
  blocAuteur: boolean;
  /** Format de numérotation des titres ("none" = désactivé) */
  numerotationTitres: NumerotationTitres;
}

export interface OptionsMultiDocument {
  notesDossier: "preface" | "ignorer";
  pageTitreParNote: boolean;
  nouvellePagesParNote: boolean;
  /** "nom" = nom du fichier comme titre de section ; "contenu" = le H1 de la note sert de titre */
  titrageNotes: "nom" | "contenu";
  /** Centrer la préface de dossier sur sa propre page (requiert notesDossier: "preface") */
  prefaceCentree: boolean;
}

export const OPTIONS_MULTI_DOC_DEFAUT: OptionsMultiDocument = {
  notesDossier: "preface",
  pageTitreParNote: false,
  nouvellePagesParNote: true,
  titrageNotes: "nom",
  prefaceCentree: true,
};

export const OPTIONS_DEFAUT: OptionsExport = {
  format: "A4",
  taille: "normal",
  marges: "normales",
  police: "inter",
  interligne: "normale",
  justification: false,
  barresLaterales: true,
  niveauNouvellePage: 0,
  pageDeTitre: false,
  sommaire: false,
  numerosPage: true,
  numerotationApresSommaire: false,
  indentation: false,
  indenterPremierParagraphe: false,
  blocAuteur: false,
  numerotationTitres: "none",
};

// ── Template ──────────────────────────────────────────────────────────────────

function paperTypst(format: OptionsExport["format"]): string {
  switch (format) {
    case "A4":
      return '"a4"';
    case "A5":
      return '"a5"';
    case "Letter":
      return '"us-letter"';
    case "Legal":
      return '"us-legal"';
  }
}

function margeTypst(marges: OptionsExport["marges"]): string {
  switch (marges) {
    case "etroites":
      return "(top: 2cm, bottom: 2cm, left: 2cm, right: 2cm)";
    case "normales":
      return "(top: 2.5cm, bottom: 2.5cm, left: 3cm, right: 3cm)";
    case "larges":
      return "(top: 3cm, bottom: 3cm, left: 4cm, right: 4cm)";
  }
}

function tailleTypst(taille: OptionsExport["taille"]): string {
  switch (taille) {
    case "small":
      return "10pt";
    case "normal":
      return "11pt";
    case "large":
      return "12pt";
  }
}

function policeTypst(police: OptionsExport["police"]): string {
  switch (police) {
    case "inter":
      return '("Inter", "Helvetica Neue", "Helvetica", "Arial")';
    case "garamond":
      // Garamond retiré de macOS Big Sur+ → fallback sur Baskerville (macOS) ou Palatino
      return '("EB Garamond", "Garamond", "Baskerville", "Palatino", "Georgia")';
  }
}

function interligneTypst(interligne: OptionsExport["interligne"]): {
  leading: string;
  spacing: string;
} {
  switch (interligne) {
    case "compact":
      return { leading: "0.6em", spacing: "1.1em" };
    case "normale":
      return { leading: "0.9em", spacing: "1.5em" };
    case "aeree":
      return { leading: "1.2em", spacing: "2.2em" };
  }
}

export function construireEnteteTypst(opts: OptionsExport): string {
  const barres = opts.barresLaterales ? "true" : "false";
  const { leading, spacing } = interligneTypst(opts.interligne);
  const justif = opts.justification ? "true" : "false";

  // Gestion de la migration depuis l'ancien type boolean
  const rawNum = opts.numerotationTitres as unknown;
  const typstNumbering =
    !rawNum || rawNum === "none" || rawNum === false
      ? "none"
      : `"${rawNum}"`;

  // Numéros de page : actifs d'emblée sauf si on attend le sommaire
  const initAffNums =
    opts.numerosPage && (!opts.numerotationApresSommaire || !opts.sommaire);

  // Indentation (Typst 0.12+ : first-line-indent accepte un dict avec all:)
  const ligneIndent = opts.indentation
    ? `#set par(first-line-indent: (amount: 1.5em, all: ${opts.indenterPremierParagraphe ? "true" : "false"}))\n`
    : "";

  return `\
#let _barres = ${barres}
#let _affNums = state("_affNums", ${initAffNums ? "true" : "false"})

#set page(
  paper: ${paperTypst(opts.format)},
  margin: ${margeTypst(opts.marges)},
  footer: context {
    if _affNums.get() {
      set text(size: 9pt, fill: luma(140))
      align(center)[#counter(page).display()]
    }
  },
)
#set text(
  font: ${policeTypst(opts.police)},
  size: ${tailleTypst(opts.taille)},
  lang: "fr",
  fill: rgb(26, 25, 24),
)
#set par(leading: ${leading}, spacing: ${spacing}, justify: ${justif})
${ligneIndent}#set heading(numbering: ${typstNumbering})
#let _numTitre(it) = if it.numbering != none [#counter(heading).display(it.numbering) ]
#set list(marker: ${opts.police === "inter" ? '([•], [◦], [–])' : '([–], [·], [·])'})

#show heading.where(level: 1): it => {
  v(1.6em)
  block[
    #set text(size: 1.6em, weight: "bold")
    #_numTitre(it)#it.body
  ]
  v(0.5em)
}
#show heading.where(level: 2): it => {
  v(1.2em)
  block[
    #set text(size: 1.3em, weight: "bold")
    #_numTitre(it)#it.body
  ]
  v(0.4em)
}
#show heading.where(level: 3): it => {
  v(1.0em)
  block[
    #set text(size: 1.15em, weight: "semibold")
    #_numTitre(it)#it.body
  ]
  v(0.3em)
}
#show heading.where(level: 4): it => {
  v(0.8em)
  block[
    #set text(size: 1.05em, weight: "semibold", style: "italic")
    #_numTitre(it)#it.body
  ]
  v(0.25em)
}
#show heading.where(level: 5): it => {
  v(0.6em)
  block[
    #set text(size: 1em, style: "italic")
    #_numTitre(it)#it.body
  ]
  v(0.2em)
}
#show heading.where(level: 6): it => {
  v(0.6em)
  block[
    #set text(size: 0.9em, fill: luma(100))
    #_numTitre(it)#it.body
  ]
  v(0.15em)
}

#show raw.where(block: false): box.with(
  fill: rgb(245, 237, 227),
  inset: (x: 3pt, y: 1pt),
  outset: (y: 3pt),
  radius: 2pt,
)
#show raw.where(block: true): it => block(
  fill: rgb(245, 244, 242),
  stroke: 1pt + rgb(233, 231, 228),
  radius: 6pt,
  inset: (x: 14pt, y: 10pt),
  width: 100%,
  text(font: ("DejaVu Sans Mono", "Fira Code", "Cascadia Code", "Menlo", "Monaco", "Courier New"), size: 0.875em, it),
)

// Barre ambre à gauche des citations
#let blockquote(c) = block(
  width: 100%,
  fill: if _barres { rgb(255, 251, 237) } else { none },
  stroke: if _barres { (left: 3pt + rgb(251, 191, 36)) } else { none },
  inset: if _barres { (left: 14pt, right: 6pt, y: 4pt) } else { (y: 4pt) },
  radius: if _barres { (right: 3pt) } else { 0pt },
  text(fill: rgb(79, 69, 57), c),
)

// Barre verte à gauche des blocs de poésie
#let poetry(c) = block(
  width: 100%,
  stroke: if _barres { (left: 3pt + rgb(132, 204, 22)) } else { none },
  inset: if _barres { (left: 10pt, y: 2pt) } else { (y: 2pt) },
  radius: if _barres { (right: 3pt) } else { 0pt },
  {
    set par(first-line-indent: 0pt)
    c
  },
)

#let didascalie(c) = text(size: 0.875em, fill: rgb(156, 163, 175), style: "italic")[|~#c~|]
#let hl(color, c) = highlight(fill: ${HIGHLIGHT_COLORS.map((col) => {
    const m = col.bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return "";
    return `if color == "${col.id}" { rgb(${m[1]}, ${m[2]}, ${m[3]}).lighten(30%) }`;
  })
    .filter(Boolean)
    .join(" else ")} else { rgb(229, 231, 235) }, c)

`;
}

// ── Escaping ──────────────────────────────────────────────────────────────────

export function echapper(texte: string): string {
  return texte
    .replace(/\\/g, "\\\\")
    .replace(/#/g, "\\#")
    .replace(/@/g, "\\@")
    .replace(/\$/g, "\\$")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/</g, "\\<")
    .replace(/>/g, "\\>")
    .replace(/~/g, "\\~")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

// ── Marks inline ──────────────────────────────────────────────────────────────

function appliquerMarks(texte: string, marks: readonly Mark[]): string {
  let r = texte;
  for (const mark of marks) {
    switch (mark.type.name) {
      case "strong":
        r = `*${r}*`;
        break;
      case "em":
        r = `_${r}_`;
        break;
      case "code_inline":
      case "code":
        r = `\`${r}\``;
        break;
      case "strike_through":
      case "strikethrough":
        r = `#strike[${r}]`;
        break;
      case "link": {
        const href = (mark.attrs.href as string) ?? "";
        r = `#link("${href}")[${r}]`;
        break;
      }
      case "didascalie_inline":
        r = `#didascalie[${r}]`;
        break;
      case "highlight_inline": {
        const color = (mark.attrs.color as string) ?? "yellow";
        r = `#hl("${color}", [${r}])`;
        break;
      }
    }
  }
  return r;
}

// ── Walker ────────────────────────────────────────────────────────────────────

function convertirTexte(node: Node): string {
  return appliquerMarks(echapper(node.text ?? ""), node.marks);
}

function convertirInlines(node: Node): string {
  let result = "";
  // biome-ignore lint/complexity/noForEach: ProseMirror Node.forEach, pas Array.forEach
  node.forEach((child) => {
    if (child.type.name === "text") {
      result += convertirTexte(child);
    } else if (child.type.name === "hardbreak") {
      result += "\\\n";
    } else if (child.type.name === "image") {
      result += convertirImage(child, "");
    } else {
      result += convertirInlines(child);
    }
  });
  return result;
}

function convertirImage(node: Node, vaultPath: string): string {
  const src = (node.attrs.src as string) ?? "";
  const alt = (node.attrs.alt as string) ?? "";
  if (!src) return "";
  const chemin = src.startsWith("/") ? src : `${vaultPath}/${src}`;
  const cheminEch = chemin.replace(/\\/g, "/");
  return `#image("${cheminEch}", width: 80%, alt: "${echapper(alt)}")`;
}

function convertirItemListe(
  node: Node,
  type: "bullet" | "ordered",
  profondeur: number
): string {
  const marqueur = type === "bullet" ? "-" : "+";
  const indent = "  ".repeat(profondeur);

  // checked doit être un booléen explicite (true/false), pas null ni undefined
  const checked = node.attrs.checked as boolean | null | undefined;
  if (
    node.type.name === "task_list_item" ||
    (node.type.name === "list_item" && typeof checked === "boolean")
  ) {
    const sym = checked === true ? "#sym.checkmark " : "#sym.ballot ";
    const texte = convertirInlines(node);
    return `${indent}- ${sym}${texte}`;
  }

  const parties: string[] = [];
  // biome-ignore lint/complexity/noForEach: ProseMirror Node.forEach, pas Array.forEach
  node.forEach((child) => {
    if (child.type.name === "paragraph") {
      parties.push(convertirInlines(child));
    } else if (child.type.name === "bullet_list") {
      parties.push(convertirListe(child, "bullet", profondeur + 1));
    } else if (child.type.name === "ordered_list") {
      parties.push(convertirListe(child, "ordered", profondeur + 1));
    }
  });

  const [premierePartie, ...suite] = parties;
  const suiteIndentee = suite.map((p) => `${indent}  ${p}`).join("\n");
  return `${indent}${marqueur} ${premierePartie ?? ""}${suiteIndentee ? `\n${suiteIndentee}` : ""}`;
}

function convertirListe(
  node: Node,
  type: "bullet" | "ordered",
  profondeur = 0
): string {
  const items: string[] = [];
  // biome-ignore lint/complexity/noForEach: ProseMirror Node.forEach, pas Array.forEach
  node.forEach((child) => {
    items.push(convertirItemListe(child, type, profondeur));
  });
  return items.join("\n");
}

function convertirBloc(
  node: Node,
  vaultPath: string,
  prevNode?: Node | null,
  nvPage?: number,
  headingOffset = 0
): string {
  switch (node.type.name) {
    case "paragraph": {
      const texte = convertirInlines(node);
      return texte.trim() ? texte : "";
    }
    case "heading": {
      const rawLevel = (node.attrs.level as number) ?? 1;
      const level = Math.min(rawLevel + headingOffset, 6);
      const marqueur = "=".repeat(level);
      // Saut de page uniquement si ce niveau est activé, qu'il y a un bloc précédent,
      // et que le bloc précédent n'est pas un titre parent (de niveau strictement inférieur).
      const nv = nvPage ?? 0;
      let pb = "";
      if (nv >= level && prevNode != null) {
        const prevIsHeadingParent =
          prevNode.type.name === "heading" &&
          (prevNode.attrs.level as number) + headingOffset < level;
        if (!prevIsHeadingParent) {
          pb = "#pagebreak(weak: true)\n";
        }
      }
      return `${pb}${marqueur} ${convertirInlines(node)}`;
    }
    case "blockquote": {
      const lignes: string[] = [];
      // biome-ignore lint/complexity/noForEach: ProseMirror Node.forEach, pas Array.forEach
      node.forEach((child) => {
        lignes.push(convertirBloc(child, vaultPath));
      });
      return `#blockquote[\n${lignes.join("\n\n")}\n]`;
    }
    case "bullet_list":
      return convertirListe(node, "bullet");
    case "ordered_list":
      return convertirListe(node, "ordered");
    case "fence":
    case "code_block": {
      const lang = (node.attrs.language as string | null) ?? "";
      const code = node.textContent;
      return lang
        ? `\`\`\`${lang}\n${code}\n\`\`\``
        : `\`\`\`\n${code}\n\`\`\``;
    }
    case "horizontal_rule":
      return "#line(length: 100%)";
    case "poetry_block": {
      type Item = { type: "vers"; texte: string } | { type: "parbreak" };
      const items: Item[] = [];
      // biome-ignore lint/complexity/noForEach: ProseMirror Node.forEach, pas Array.forEach
      node.forEach((child) => {
        if (child.type.name === "paragraph") {
          const texte = convertirInlines(child);
          const contenuReel = texte.replace(/\\/g, "").replace(/\n/g, "").trim();
          if (contenuReel) {
            items.push({ type: "vers", texte: texte.trimEnd() });
          } else {
            items.push({ type: "parbreak" });
          }
        } else {
          const texte = convertirInlines(child).trimEnd();
          if (texte) items.push({ type: "vers", texte });
        }
      });
      const lignesTypst: string[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type === "parbreak") {
          lignesTypst.push("#parbreak()");
        } else {
          // \ sur tous les vers sauf le dernier de chaque strophe
          const suivant = i < items.length - 1 ? items[i + 1] : null;
          if (suivant?.type === "vers") {
            lignesTypst.push(`${item.texte}\\`);
          } else {
            lignesTypst.push(item.texte);
          }
        }
      }
      return `#poetry[\n${lignesTypst.join("\n")}\n]`;
    }
    case "audio_block": {
      const titre = (node.attrs.title as string) ?? "audio";
      return `#text(fill: gray, style: "italic")[(${echapper(titre)})]`;
    }
    case "image":
      return convertirImage(node, vaultPath);
    case "table":
      return convertirTable(node);
    default:
      return "";
  }
}

function convertirTable(node: Node): string {
  // Extraction de toutes les cellules pour construire un #table typst
  const lignes: string[][] = [];

  // biome-ignore lint/complexity/noForEach: ProseMirror Node.forEach, pas Array.forEach
  node.forEach((row) => {
    if (
      row.type.name !== "table_row" &&
      row.type.name !== "table_header" &&
      row.type.name !== "table_body"
    )
      return;

    const cells: string[] = [];
    // biome-ignore lint/complexity/noForEach: ProseMirror Node.forEach, pas Array.forEach
    row.forEach((cell) => {
      if (
        cell.type.name === "table_cell" ||
        cell.type.name === "table_header"
      ) {
        cells.push(`[${convertirInlines(cell)}]`);
      }
    });
    if (cells.length > 0) lignes.push(cells);
  });

  if (lignes.length === 0) return "";
  const colonnes = lignes[0].length;
  const toutes = lignes.flat().join(", ");
  return `#table(columns: ${colonnes}, ${toutes})`;
}

// ── Page de titre ─────────────────────────────────────────────────────────────

export function construirePageTitre(
  titre: string,
  opts: OptionsExport,
  auteur?: InfosAuteur
): string {
  if (!opts.pageDeTitre || !titre.trim()) return "";

  const lignesAuteur: string[] = [];
  if (opts.blocAuteur && auteur) {
    const nomComplet = [auteur.prenom, auteur.nom].filter(Boolean).join(" ");
    if (nomComplet) lignesAuteur.push(nomComplet);
    if (auteur.email) lignesAuteur.push(auteur.email);
    if (auteur.adresse) lignesAuteur.push(auteur.adresse);
  }

  const blocAuteur =
    lignesAuteur.length > 0
      ? `\n  #v(2em)\n  #text(size: 1.1em)[${lignesAuteur.map(echapper).join(" \\\n  ")}]`
      : "";

  return `#align(center + horizon)[\n  #text(size: 2.5em, weight: "medium")[${echapper(titre)}]${blocAuteur}\n]\n#pagebreak()\n\n`;
}

// ── Multi-document ────────────────────────────────────────────────────────────

/** Convertit le contenu d'un doc ProseMirror sans preamble, avec décalage de niveaux de titres. */
export function convertirDocContenu(
  doc: Node,
  vaultPath: string,
  nvPage: number,
  headingOffset: number
): string {
  const blocs: string[] = [];
  let prevNode: Node | null = null;
  // biome-ignore lint/complexity/noForEach: ProseMirror Node.forEach, pas Array.forEach
  doc.forEach((child) => {
    const bloc = convertirBloc(child, vaultPath, prevNode, nvPage, headingOffset);
    if (bloc.trim()) {
      blocs.push(bloc);
      prevNode = child;
    }
  });
  return blocs.join("\n\n");
}

/**
 * Page de titre centrée pour une note en mode compilation dossier.
 * Émet un heading invisible au niveau indiqué (pour le sommaire) + le texte visuel centré.
 * `#show heading: none` dans un bloc content rend le heading invisible
 * tout en le conservant dans l'index de #outline().
 */
export function construirePageTitreNote(titre: string, level = 1): string {
  const marqueur = "=".repeat(Math.min(level, 6));
  const titreEch = echapper(titre);
  return (
    `#pagebreak()\n` +
    `#[#show heading: none\n${marqueur} ${titreEch}\n]\n` +
    `#align(center + horizon)[\n  #text(size: 2em, weight: "medium")[${titreEch}]\n]\n` +
    `#pagebreak()\n\n`
  );
}

// ── Point d'entrée ────────────────────────────────────────────────────────────

/** Convertit un document ProseMirror en source Typst complet, prêt à compiler. */
export function proseMirrorDocVersTypst(
  doc: Node,
  titre: string,
  vaultPath: string,
  opts: OptionsExport,
  auteur?: InfosAuteur
): string {
  const entete = construireEnteteTypst(opts);

  const pageTitre = construirePageTitre(titre, opts, auteur);

  // Le sommaire peut activer les numéros de page si numerotationApresSommaire
  const miseAJourNums =
    opts.numerosPage && opts.numerotationApresSommaire && opts.sommaire
      ? "#_affNums.update(true)\n#counter(page).update(1)\n"
      : "";
  const sommaire = opts.sommaire
    ? `#outline(title: "Sommaire", indent: 1em)\n#pagebreak()\n${miseAJourNums}\n`
    : "";

  // Le titre n'est ajouté comme heading que s'il n'y a pas de page de titre
  const titreLine =
    titre.trim() && !opts.pageDeTitre ? `= ${echapper(titre)}\n\n` : "";

  const blocs: string[] = [];
  let prevNode: Node | null = null;
  // biome-ignore lint/complexity/noForEach: ProseMirror Node.forEach, pas Array.forEach
  doc.forEach((child) => {
    const bloc = convertirBloc(child, vaultPath, prevNode, opts.niveauNouvellePage);
    if (bloc.trim()) {
      blocs.push(bloc);
      prevNode = child;
    }
  });

  return entete + pageTitre + sommaire + titreLine + blocs.join("\n\n");
}
