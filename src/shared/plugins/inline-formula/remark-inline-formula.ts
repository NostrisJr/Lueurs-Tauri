/**
 * remark-inline-formula.ts
 *
 * Round-trip Markdown ↔ nœud `inline_formula` :
 *  - lecture  : repère `$$expr$$` dans la source et remplace les nœuds couverts
 *    (`source-spans.ts`) ; à défaut, scan par nœud texte.
 *  - écriture : handler remark-stringify renvoyant `node.value` verbatim (l'expression
 *    peut contenir `*`, `_`, `[`… qui ne doivent PAS être échappés).
 *
 * Calqué sur remark-inline.ts (didascalie) / remark-highlight.ts.
 */

import { $remark } from "@milkdown/kit/utils";
import type { Root } from "mdast";
import { createLogger } from "../../lib/logger";
import { rebuildWithFormulas } from "./source-spans";

const log = createLogger("remark-inline-formula");

// Pas de scan dans le code (littéral) ni dans une formule (pas de nesting).
const SKIP_PARENTS = new Set(["code", "inlineCode", "inline_formula"]);

// biome-ignore lint/suspicious/noExplicitAny: mdast hors typages stricts
type AnyNode = any;

// `$$` … `$$` non-greedy, sur une seule ligne, au moins un caractère.
const FORMULA_RE = /\$\$([^\n]+?)\$\$/g;

/** Scan par nœud texte — ne voit qu'une formule non fragmentée par remark. */
function scanTextNodes(parent: AnyNode): number {
  const newChildren: AnyNode[] = [];
  let totalReplaced = 0;

  for (const child of parent.children) {
    if (child.type === "text" && typeof child.value === "string") {
      const text = child.value as string;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      const parts: AnyNode[] = [];

      FORMULA_RE.lastIndex = 0;
      // biome-ignore lint/suspicious/noAssignInExpressions: pattern standard des regex globales
      while ((match = FORMULA_RE.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push({
            type: "text",
            value: text.slice(lastIndex, match.index),
          });
        }
        // value = formule brute complète (délimiteurs inclus)
        parts.push({ type: "inline_formula", value: match[0] });
        totalReplaced++;
        lastIndex = match.index + match[0].length;
      }

      if (parts.length === 0) {
        newChildren.push(child);
      } else {
        if (lastIndex < text.length) {
          parts.push({ type: "text", value: text.slice(lastIndex) });
        }
        newChildren.push(...parts);
      }
    } else {
      newChildren.push(child);
    }
  }

  parent.children = newChildren;
  return totalReplaced;
}

function processChildren(parent: AnyNode, source: string): void {
  if (!parent.children) return;
  if (SKIP_PARENTS.has(parent.type)) return;

  // Reconstruction depuis la source d'abord : c'est la seule qui retrouve une
  // formule que remark a éclatée sur plusieurs nœuds (cf. source-spans.ts).
  // `null` (aucune formule, ou découpage non sûr) → scan par nœud texte.
  const rebuilt = source ? rebuildWithFormulas(parent.children, source) : null;
  let totalReplaced: number;
  if (rebuilt) {
    parent.children = rebuilt.children;
    totalReplaced = rebuilt.count;
  } else {
    totalReplaced = scanTextNodes(parent);
  }

  for (const child of parent.children) {
    if (child.children) processChildren(child, source);
  }

  if (totalReplaced > 0) {
    log.info("formules inline parsées", {
      dans: parent.type,
      n: totalReplaced,
    });
  }
}

function remarkInlineFormula(this: AnyNode) {
  const data = this.data();
  if (!data.toMarkdownExtensions) data.toMarkdownExtensions = [];
  data.toMarkdownExtensions.push({
    handlers: {
      // Leaf : renvoie la formule brute telle quelle (sans échappement).
      inline_formula(node: AnyNode) {
        return node.value ?? "";
      },
    },
  });

  // 2e argument : la VFile. Milkdown appelle `remark.runSync(tree, markdown)`,
  // donc la source brute est disponible ici (indispensable à source-spans.ts).
  return (tree: Root, file: AnyNode) => {
    processChildren(tree as AnyNode, String(file ?? ""));
  };
}

export const inlineFormulaRemark = $remark(
  "inlineFormulaRemark",
  () => remarkInlineFormula
);
