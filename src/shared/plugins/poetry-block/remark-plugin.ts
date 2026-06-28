import { $remark } from "@milkdown/kit/utils";
import type { Root } from "mdast";
import { createLogger } from "../../lib/logger";

const log = createLogger("remark-poetry");

// biome-ignore lint/suspicious/noExplicitAny: mdast nodes manipulés en dehors des types
type AnyParent = { children: any[] };

function isPoetryMarker(node: any): boolean {
  if (node.type !== "paragraph") return false;
  const children: any[] = node.children ?? [];
  return (
    children.length === 1 &&
    children[0].type === "text" &&
    String(children[0].value ?? "").trim() === "§§"
  );
}

// Supprime les nœuds break en début et fin d'un tableau de nœuds inline.
function trimBreaks(nodes: any[]): any[] {
  let s = 0;
  let e = nodes.length;
  while (s < e && nodes[s].type === "break") s++;
  while (e > s && nodes[e - 1].type === "break") e--;
  return nodes.slice(s, e);
}

// Scinde un paragraphe à chaque occurrence de §§ dans ses nœuds text.
// Retourne plusieurs paragraphes si §§ est trouvé, sinon le paragraphe d'origine.
// Gère aussi bien "texte§§suite" que les nœuds text isolés "§§".
function splitParagraphAtMarker(para: any): any[] {
  const children: any[] = para.children ?? [];

  const hasMarker = children.some(
    (c) => c.type === "text" && String(c.value ?? "").includes("§§")
  );
  if (!hasMarker) return [para];

  // Groupes séparés par chaque §§ rencontré
  const groups: any[][] = [[]];

  for (const child of children) {
    if (child.type !== "text") {
      groups[groups.length - 1].push(child);
      continue;
    }

    const value: string = child.value ?? "";
    let last = 0;
    let idx: number;

    // biome-ignore lint/suspicious/noAssignInExpressions: pattern idiomatique indexOf
    while ((idx = value.indexOf("§§", last)) !== -1) {
      if (idx > last) {
        groups[groups.length - 1].push({
          type: "text",
          value: value.slice(last, idx),
        });
      }
      // Marqueur §§ → ferme le groupe courant, pousse le marqueur seul, ouvre un nouveau groupe
      groups.push([{ type: "text", value: "§§" }]);
      groups.push([]);
      last = idx + 2;
    }

    if (last < value.length) {
      groups[groups.length - 1].push({
        type: "text",
        value: value.slice(last),
      });
    }
  }

  const result: any[] = [];
  for (const group of groups) {
    const trimmed = trimBreaks(group);
    if (trimmed.length > 0) {
      result.push({ type: "paragraph", children: trimmed });
    }
  }
  return result.length > 0 ? result : [para];
}

// Parcourt un parent et scinde tous les paragraphes qui contiennent §§.
// Doit s'exécuter après remarkLineBreak (qui convertit les \n en nœuds break).
function splitParagraphsAtMarker(parent: AnyParent): void {
  const result: any[] = [];
  for (const child of parent.children) {
    if (child.type !== "paragraph") {
      if (child.children && child.type !== "poetry_block") {
        splitParagraphsAtMarker(child);
      }
      result.push(child);
      continue;
    }
    result.push(...splitParagraphAtMarker(child));
  }
  parent.children = result;
}

// Parcourt récursivement tous les nœuds-parents et convertit les paires §§...§§
// en nœuds poetry_block dans leurs children.
function processChildren(parent: AnyParent): void {
  const result: any[] = [];
  let i = 0;

  while (i < parent.children.length) {
    const child = parent.children[i];

    if (isPoetryMarker(child)) {
      let j = i + 1;
      while (
        j < parent.children.length &&
        !isPoetryMarker(parent.children[j])
      ) {
        j++;
      }

      if (j < parent.children.length) {
        const inner = parent.children.slice(i + 1, j);
        const fakeParent: AnyParent = { children: [...inner] };
        processChildren(fakeParent);

        result.push({
          type: "poetry_block",
          children: fakeParent.children,
        });

        log.info("bloc poésie parsé", { enfants: inner.length });
        i = j + 1;
        continue;
      }
    }

    if (child.children && child.type !== "poetry_block") {
      processChildren(child);
    }
    result.push(child);
    i++;
  }

  parent.children = result;
}

function remarkPoetryBlock() {
  return (tree: Root) => {
    // 1. Scinde les paragraphes qui contiennent §§ sans ligne vide dédiée
    splitParagraphsAtMarker(tree as unknown as AnyParent);
    // 2. Enveloppe les paires §§...§§ en nœuds poetry_block
    processChildren(tree as unknown as AnyParent);
  };
}

export const poetryBlockRemark = $remark(
  "poetryBlockRemark",
  () => remarkPoetryBlock
);
