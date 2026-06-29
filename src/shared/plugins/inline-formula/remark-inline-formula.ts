/**
 * remark-inline-formula.ts
 *
 * Round-trip Markdown ↔ nœud `inline_formula` :
 *  - lecture  : scanne les nœuds texte pour `$$expr$$` → nœud mdast `inline_formula`.
 *  - écriture : handler remark-stringify renvoyant `node.value` verbatim (l'expression
 *    peut contenir `*`, `_`, `[`… qui ne doivent PAS être échappés).
 *
 * Calqué sur remark-inline.ts (didascalie) / remark-highlight.ts.
 */

import { $remark } from "@milkdown/kit/utils";
import type { Root } from "mdast";
import { createLogger } from "../../lib/logger";

const log = createLogger("remark-inline-formula");

// Pas de scan dans le code (littéral) ni dans une formule (pas de nesting).
const SKIP_PARENTS = new Set(["code", "inlineCode", "inline_formula"]);

// biome-ignore lint/suspicious/noExplicitAny: mdast hors typages stricts
type AnyNode = any;

// `$$` … `$$` non-greedy, sur une seule ligne, au moins un caractère.
const FORMULA_RE = /\$\$([^\n]+?)\$\$/g;

function processChildren(parent: AnyNode): void {
  if (!parent.children) return;
  if (SKIP_PARENTS.has(parent.type)) return;

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
      if (child.children) processChildren(child);
      newChildren.push(child);
    }
  }

  parent.children = newChildren;
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

  return (tree: Root) => {
    processChildren(tree as AnyNode);
  };
}

export const inlineFormulaRemark = $remark(
  "inlineFormulaRemark",
  () => remarkInlineFormula
);
