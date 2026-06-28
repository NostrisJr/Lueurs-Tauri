import { editorViewCtx, schemaCtx } from "@milkdown/kit/core";
import { useAtom, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { mobileSpellPopupAtom, updateIgnoredWordsAtom } from "../../../shared/lib/atoms";
import { createLogger } from "../../../shared/lib/logger";
import { activeEditorRef } from "../../../shared/components/NoteEditor/lib/activeEditorRef";
import { useKeyboard } from "../../hooks/useKeyboard";
import { BottomSheet } from "../BottomSheet/BottomSheet";

const log = createLogger("MobileSpellMenu");

export function MobileSpellMenu() {
  const [popup, setPopup] = useAtom(mobileSpellPopupAtom);
  const updateIgnoredWords = useSetAtom(updateIgnoredWordsAtom);
  const { isOpen: isKeyboardOpen, isAndroidOpen } = useKeyboard();

  // Ferme le menu uniquement quand le clavier PASSE de fermé → ouvert.
  // Si le clavier était déjà ouvert au moment de l'ouverture du menu (blur()
  // en cours), on ne ferme pas — sinon le popup disparaît immédiatement.
  const prevKbRef = useRef(isKeyboardOpen || isAndroidOpen);
  useEffect(() => {
    const wasOpen = prevKbRef.current;
    const isNowOpen = isKeyboardOpen || isAndroidOpen;
    prevKbRef.current = isNowOpen;
    if (!wasOpen && isNowOpen && popup) setPopup(null);
  }, [isKeyboardOpen, isAndroidOpen, popup, setPopup]);

  if (!popup) return null;

  function close() {
    setPopup(null);
  }

  function applyReplacement(replacement: string) {
    if (!popup) return;
    const editor = activeEditorRef.current;
    if (!editor) return;
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const schema = ctx.get(schemaCtx);
      const { doc } = view.state;
      // Conserver les marques couvrant le mot (didascalie, surlignage, code…),
      // sinon le remplacement non marqué scinderait la mise en forme.
      const marks = doc.resolve(popup.from).marksAcross(doc.resolve(popup.to));
      view.dispatch(
        view.state.tr.replaceWith(
          popup.from,
          popup.to,
          schema.text(replacement, marks)
        )
      );
      view.focus();
      log.info("correction appliquée", { word: popup.word, replacement });
    });
    close();
  }

  function ignoreWord() {
    if (!popup) return;
    const w = popup.word.trim().toLowerCase();
    if (!w) return;
    updateIgnoredWords((prev) =>
      prev.some((x) => x.toLowerCase() === w) ? prev : [...prev, popup.word.trim()]
    );
    log.info("mot ignoré", { word: w });
    close();
  }

  const title = popup.category === "spelling" ? `« ${popup.word} »` : popup.word;

  return (
    <BottomSheet onClose={close} title={title} heightFraction={0.5}>
      <div className="flex flex-col">
        {popup.replacements.length > 0 ? (
          <>
            <p className="px-4 pt-1 pb-2 text-xs text-gray-400 uppercase tracking-wide">
              Suggestions
            </p>
            <div className="flex flex-col divide-y divide-gray-100">
              {popup.replacements.slice(0, 5).map((rep) => (
                <button
                  key={rep}
                  type="button"
                  onClick={() => applyReplacement(rep)}
                  className="w-full px-4 py-4 text-left text-base text-amber-600 font-medium active:bg-amber-50 transition-colors"
                >
                  {rep}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="px-4 py-4 text-base text-gray-400 italic">
            Aucune suggestion
          </p>
        )}

        {popup.message ? (
          <p className="px-4 pt-3 pb-2 text-sm text-gray-500 leading-snug">
            {popup.message}
          </p>
        ) : null}

        {popup.category === "spelling" && (
          <div className="border-t border-gray-100 mt-1">
            <button
              type="button"
              onClick={ignoreWord}
              className="w-full px-4 py-4 text-left text-base text-gray-500 active:bg-gray-50 transition-colors"
            >
              Ignorer « {popup.word} »
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
