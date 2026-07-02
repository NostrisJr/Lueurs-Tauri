/**
 * InlineFormulaPopup.tsx
 *
 * Popup d'édition d'une formule inline du corps de note (singleton, monté une
 * fois dans MarkdownEditor — cf. WikilinkEditPopup). Réutilise FormulaEditField :
 * édition de la formule HUMANISÉE + sélecteurs note/propriété, comme le frontmatter.
 * À la validation, écrit la formule brute (chemins absolus) dans l'attribut du
 * nœud ; si la formule est vide, supprime le nœud.
 *
 * Mobile : BottomSheet clavier-aware. Desktop : popup positionné près du nœud.
 */

import { editorViewCtx } from "@milkdown/kit/core";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { BottomSheet } from "../../../mobile/components/BottomSheet/BottomSheet";
import { createLogger } from "../../lib/logger";
import { isMobile } from "../../lib/platform";
import {
  getInlineFormulaEdit,
  inlineFormulaBridge,
  setInlineFormulaEdit,
  subscribeInlineFormulaEdit,
} from "../../plugins/inline-formula/inlineFormulaState";
import { FormulaEditField } from "../FormulaField/FormulaEditField";
import { activeEditorRef } from "./lib/activeEditorRef";
import { clampPopup } from "./lib/popupPosition";

const POPUP_WIDTH = 360;
const POPUP_EST_HEIGHT = 80;

const log = createLogger("InlineFormulaPopup");

export function InlineFormulaPopup() {
  const request = useSyncExternalStore(
    subscribeInlineFormulaEdit,
    getInlineFormulaEdit,
    () => null
  );
  const [raw, setRaw] = useState("$$$$");
  const rawRef = useRef("$$$$");
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  function updateRaw(next: string) {
    rawRef.current = next;
    setRaw(next);
  }

  // (Ré)initialise à l'ouverture.
  useEffect(() => {
    if (!request) return;
    rawRef.current = request.raw;
    setRaw(request.raw);
  }, [request]);

  useLayoutEffect(() => {
    if (!request || isMobile) {
      setPos(null);
      return;
    }
    setPos(clampPopup(request.coords, POPUP_WIDTH, POPUP_EST_HEIGHT));
  }, [request]);

  const close = useCallback(() => setInlineFormulaEdit(null), []);

  const commit = useCallback(() => {
    const req = getInlineFormulaEdit();
    const editor = activeEditorRef.current;
    if (!req || !editor) {
      close();
      return;
    }
    const value = rawRef.current;
    const isEmpty = value.replace(/^\$\$/, "").replace(/\$\$$/, "").trim() === "";
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const node = view.state.doc.nodeAt(req.pos);
      if (!node || node.type.name !== "inline_formula") return;
      const tr = isEmpty
        ? view.state.tr.delete(req.pos, req.pos + node.nodeSize)
        : view.state.tr.setNodeAttribute(req.pos, "raw", value);
      view.dispatch(tr);
      view.focus();
      log.info(
        isEmpty ? "formule inline supprimée (vide)" : "formule inline éditée",
        {
          pos: req.pos,
        }
      );
    });
    close();
  }, [close]);

  if (!request) return null;

  const ctx = inlineFormulaBridge.current;
  if (isMobile) {
    return (
      <BottomSheet onClose={commit} title="Formule" heightFraction={0.3}>
        <div className="px-4 pt-1 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-300 font-mono text-base shrink-0 leading-none">
              ƒ
            </span>
            <FormulaEditField
              rawValue={raw}
              onChange={updateRaw}
              onDone={commit}
              allNotes={ctx?.allNotes ?? []}
              noteResolver={ctx?.noteResolver ?? (() => undefined)}
              inputClassName="w-full bg-transparent outline-none text-gray-700 font-mono text-base py-1 border-b border-gray-200 focus:border-amber-400 transition-colors"
            />
          </div>
        </div>
      </BottomSheet>
    );
  }

  if (!pos) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" onMouseDown={commit}>
      <div
        className="absolute rounded-lg border border-gray-200 bg-white p-2 shadow-xl"
        style={{ left: pos.left, top: pos.top, width: POPUP_WIDTH }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          <span className="text-gray-300 font-mono text-xs leading-none">
            ƒ
          </span>
          <FormulaEditField
            rawValue={raw}
            onChange={updateRaw}
            onDone={commit}
            allNotes={ctx?.allNotes ?? []}
            noteResolver={ctx?.noteResolver ?? (() => undefined)}
            inputClassName="w-full bg-transparent outline-none border-b border-gray-300 text-gray-700 focus:border-amber-400 transition-colors font-mono text-sm"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
