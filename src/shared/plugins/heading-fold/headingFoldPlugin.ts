import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

export const headingFoldPluginKey = new PluginKey<DecorationSet>(
  "heading-fold"
);

/**
 * Retourne la position de fin de la section d'un heading foldé.
 * La section se termine juste avant le prochain heading de niveau ≤ headingLevel,
 * ou à la fin du document.
 */
export function findSectionEnd(
  doc: ProsemirrorNode,
  headingPos: number,
  headingLevel: number
): number {
  let end = doc.content.size;
  doc.forEach((node, offset) => {
    if (
      offset > headingPos &&
      node.type.name === "heading" &&
      node.attrs.level <= headingLevel &&
      offset < end
    ) {
      end = offset;
    }
  });
  return end;
}

export const headingFoldPlugin = $prose(
  () =>
    new Plugin<DecorationSet>({
      key: headingFoldPluginKey,

      state: {
        init: () => DecorationSet.empty,

        apply(tr, decorations, _oldState, newState) {
          // 1. Remapper les décorations existantes (gère suppressions/insertions)
          decorations = decorations.map(tr.mapping, tr.doc);

          // 2. Nettoyer les décos dont le heading a été supprimé ou a changé de niveau
          if (tr.docChanged) {
            const obsoletes = decorations.find(undefined, undefined, (spec) => {
              if (spec.foldedByHeading == null) return false;
              const pos = spec.foldedByHeading as number;
              const node = newState.doc.nodeAt(pos);
              return (
                !node ||
                node.type.name !== "heading" ||
                node.attrs.level !== spec.headingLevel
              );
            });
            if (obsoletes.length > 0) {
              decorations = decorations.remove(obsoletes);
            }
          }

          // 3. Lire la commande de toggle depuis les métadonnées
          const meta = tr.getMeta(headingFoldPluginKey) as
            | { pos: number; fold: boolean }
            | undefined;

          if (!meta) return decorations;

          const { pos, fold } = meta;

          if (fold) {
            const headingNode = newState.doc.nodeAt(pos);
            if (!headingNode || headingNode.type.name !== "heading")
              return decorations;
            const level = headingNode.attrs.level as number;
            const sectionEnd = findSectionEnd(newState.doc, pos, level);
            const contentStart = pos + headingNode.nodeSize;

            // Section vide — rien à masquer
            if (contentStart >= sectionEnd) return decorations;

            const newDecos: Decoration[] = [];
            newState.doc.forEach((node, offset) => {
              if (offset >= contentStart && offset < sectionEnd) {
                newDecos.push(
                  Decoration.node(
                    offset,
                    offset + node.nodeSize,
                    { style: "display: none" },
                    { foldedByHeading: pos, headingLevel: level }
                  )
                );
              }
            });
            return decorations.add(newState.doc, newDecos);
          }

          // fold === false : supprimer les décorations de ce heading
          const found = decorations.find(
            undefined,
            undefined,
            (spec) => spec.foldedByHeading === pos
          );
          return decorations.remove(found);
        },
      },

      props: {
        decorations(state) {
          return headingFoldPluginKey.getState(state);
        },
      },
    })
);
