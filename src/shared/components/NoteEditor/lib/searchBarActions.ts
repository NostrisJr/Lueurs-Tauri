/**
 * searchBarActions.ts
 *
 * Actions partagées entre SearchBar (desktop) et MobileSearchBar (mobile) :
 * exécuter une commande de recherche sur la vue ProseMirror active, puis
 * scroller vers l'occurrence avec les marges du header fixe (le scroll natif
 * ProseMirror `.scrollIntoView()` les ignore — cf. WikilinkEditPopup, même
 * contournement).
 */

import { editorViewCtx } from "@milkdown/kit/core";
import type { EditorView } from "@milkdown/kit/prose/view";
import { getActiveMatchFrom } from "../../../plugins/search/searchPlugin";
import { activeEditorRef } from "./activeEditorRef";
import { scrollPosIntoViewLikeEditing } from "./editorScroll";

export function withActiveView(fn: (view: EditorView) => void) {
  activeEditorRef.current?.action((ctx) => {
    try {
      fn(ctx.get(editorViewCtx));
    } catch {
      /* editorViewCtx pas encore injecté */
    }
  });
}

export function runAndScroll(
  action: (view: EditorView) => void,
  bottomInsetOverride?: number
) {
  withActiveView((v) => {
    action(v);
    const pos = getActiveMatchFrom(v);
    if (pos !== null)
      scrollPosIntoViewLikeEditing(v, pos, bottomInsetOverride);
  });
}
