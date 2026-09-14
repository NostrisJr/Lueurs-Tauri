import { editorViewCtx, schemaCtx } from "@milkdown/kit/core";
import clsx from "clsx";
import { useAtom, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { activeEditorRef } from "../../../shared/components/NoteEditor/lib/activeEditorRef";
import {
  mobileSpellPopupAtom,
  updateIgnoredWordsAtom,
} from "../../../shared/lib/atoms";
import { createLogger } from "../../../shared/lib/logger";
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
      // Pas de view.focus() ici : ça rouvrirait le clavier natif et
      // redéclencherait le scroll-vers-caret dans MobileEditor, provoquant un
      // rescroll intempestif vers l'ancienne position d'édition alors que le
      // clavier était fermé (correction faite depuis la bottom sheet).
      log.info("correction appliquée", { word: popup.word, replacement });
    });
    close();
  }

  function ignoreWord() {
    if (!popup) return;
    const w = popup.word.trim().toLowerCase();
    if (!w) return;
    updateIgnoredWords((prev) =>
      prev.some((x) => x.toLowerCase() === w)
        ? prev
        : [...prev, popup.word.trim()]
    );
    log.info("mot ignoré", { word: w });
    close();
  }

  const title =
    popup.category === "spelling" ? `« ${popup.word} »` : popup.word;

  return (
    <BottomSheet onClose={close} title={title} heightFraction={0.5}>
      <div className="flex flex-col">
        {popup.replacements.length > 0 ? (
          <>
            <p
              className={clsx(
                "px-4 pt-1 pb-2 text-xs uppercase tracking-wide",
                "text-ink-4"
              )}
            >
              Suggestions
            </p>
            <div className={clsx("flex flex-col divide-y", "divide-line")}>
              {popup.replacements.slice(0, 5).map((rep) => (
                <button
                  key={rep}
                  type="button"
                  onClick={() => applyReplacement(rep)}
                  className={clsx(
                    "w-full px-4 py-4 text-left text-base font-medium transition-colors",
                    "text-accent-strong",
                    "active:bg-accent-soft"
                  )}
                >
                  {rep}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className={clsx("px-4 py-4 text-base italic", "text-ink-4")}>
            Aucune suggestion
          </p>
        )}

        {popup.message ? (
          <p
            className={clsx(
              "px-4 pt-3 pb-2 text-sm leading-snug",
              "text-ink-3"
            )}
          >
            {popup.message}
          </p>
        ) : null}

        {popup.category === "spelling" && (
          <div className="border-t border-line mt-1">
            <button
              type="button"
              onClick={ignoreWord}
              className={clsx(
                "w-full px-4 py-4 text-left text-base transition-colors",
                "text-ink-3",
                "active:bg-surface-2"
              )}
            >
              Ignorer « {popup.word} »
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
