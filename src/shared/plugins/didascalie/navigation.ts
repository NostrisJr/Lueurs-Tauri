import { $prose } from "@milkdown/kit/utils";
import { keymap } from "@milkdown/kit/prose/keymap";
import { TextSelection } from "@milkdown/kit/prose/state";

// Webkit ne sait pas faire sortir le curseur d'un NodeView inline lorsqu'il
// est entouré de spans contenteditable=false (les pipes). On gère donc les
// frontières explicitement : à `parentOffset === 0` ou `=== content.size`,
// la flèche déplace le curseur juste avant ou juste après le nœud parent.
export const didascalieNavigationPlugin = $prose(() =>
    keymap({
        ArrowRight: (state, dispatch) => {
            const { $from, empty } = state.selection;
            if (!empty) return false;
            if (
                $from.parent.type.name === "didascalie_inline" &&
                $from.parentOffset === $from.parent.content.size
            ) {
                const after = $from.after($from.depth);
                if (dispatch) {
                    dispatch(
                        state.tr.setSelection(TextSelection.create(state.doc, after))
                    );
                }
                return true;
            }
            return false;
        },

        ArrowLeft: (state, dispatch) => {
            const { $from, empty } = state.selection;
            if (!empty) return false;
            if (
                $from.parent.type.name === "didascalie_inline" &&
                $from.parentOffset === 0
            ) {
                const before = $from.before($from.depth);
                if (dispatch) {
                    dispatch(
                        state.tr.setSelection(TextSelection.create(state.doc, before))
                    );
                }
                return true;
            }
            return false;
        },
    })
);
