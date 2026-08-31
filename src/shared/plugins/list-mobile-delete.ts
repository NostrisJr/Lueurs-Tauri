import { joinBackward } from "@milkdown/kit/prose/commands";
import { Plugin } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";
import { isInEmptyListItem, stepOutOfEmptyListItem } from "./customKeymap";

// Sur clavier virtuel mobile, Backspace en début de list_item peut être livré
// via `beforeinput` (deleteContentBackward) sans `keydown` fiable — le keymap
// ProseMirror (le nôtre dans customKeymap.ts ET celui natif de Milkdown) est
// alors totalement contourné, et le navigateur mute le DOM directement. Le
// <li> reconstruit peut perdre ses attributs data-item-type/data-checked :
// une todo redevient visuellement une liste simple. On intercepte ce cas
// précis pour rejouer la même logique que le keymap Backspace desktop.
export const mobileListDeletePlugin = $prose(
  () =>
    new Plugin({
      props: {
        handleDOMEvents: {
          beforeinput(view, event) {
            if (
              !(event instanceof InputEvent) ||
              event.inputType !== "deleteContentBackward"
            )
              return false;

            const { state } = view;
            const { $from, empty } = state.selection;
            if (!empty || $from.parentOffset !== 0) return false;
            if ($from.node(-1)?.type !== state.schema.nodes.list_item)
              return false;

            event.preventDefault();
            if (isInEmptyListItem(state, state.schema)) {
              stepOutOfEmptyListItem(state.schema)(state, view.dispatch);
            } else {
              joinBackward(state, view.dispatch, view);
            }
            return true;
          },
        },
      },
    })
);
