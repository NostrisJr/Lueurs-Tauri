import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

export const headingMarkerPluginKey = new PluginKey("heading-marker");

/**
 * Affiche les marqueurs Markdown (#, ##, …) au début d'un titre lorsque le
 * curseur s'y trouve, façon « live preview ». Les # ne sont pas dans le
 * document : ils sont rendus en CSS via ::before sur .heading-content quand
 * la classe `heading-marker-visible` est posée par cette décoration.
 *
 * Recalculé à chaque transaction (donc aussi sur les déplacements de curseur).
 */
export const headingMarkerPlugin = $prose(
  () =>
    new Plugin({
      key: headingMarkerPluginKey,
      props: {
        decorations(state) {
          const { from, to } = state.selection;
          const decos: Decoration[] = [];
          state.doc.forEach((node, offset) => {
            if (node.type.name !== "heading") return;
            const end = offset + node.nodeSize;
            // Le titre est marqué dès que le curseur (ou la sélection) le recoupe
            if (from < end && to > offset) {
              decos.push(
                Decoration.node(offset, end, {
                  class: "heading-marker-visible",
                })
              );
            }
          });
          return decos.length > 0
            ? DecorationSet.create(state.doc, decos)
            : DecorationSet.empty;
        },
      },
    })
);
