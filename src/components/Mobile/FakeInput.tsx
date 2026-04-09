/**
 * FakeInput — remplace un <input> dans l'UI principale par une div tappable
 * qui ouvre un BottomSheet contenant le vrai input.
 *
 * Évite le scroll automatique de WKWebView vers les inputs focusés :
 * le seul input réel est à l'intérieur d'un BottomSheet (position:fixed)
 * qui gère lui-même le décalage clavier.
 */
import { useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { BottomSheet } from "./BottomSheet";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  /** Label affiché au-dessus de l'input dans la sheet */
  label?: string;
  /** Classes CSS de la div faux-input */
  className?: string;
  /** Props passées au <input> réel */
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  /**
   * Contenu additionnel rendu dans la sheet sous l'input.
   * Reçoit (draft, setDraft) pour les cas live (ex : résultats de recherche).
   */
  children?: (draft: string, setDraft: (v: string) => void) => ReactNode;
  /**
   * Si true : onChange appelé à chaque frappe (mode recherche live).
   * La fermeture de la sheet appelle onChange("") pour réinitialiser.
   * Si false : onChange appelé uniquement à la validation (mode édition).
   */
  liveUpdate?: boolean;
  /** Appelé après fermeture (confirmation ou annulation) */
  onClose?: () => void;
}

export function FakeInput({
  value,
  onChange,
  placeholder,
  type = "text",
  label,
  className,
  inputProps,
  children,
  liveUpdate = false,
  onClose: onCloseProp,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  function openSheet() {
    setDraft(value);
    setOpen(true);
    // Délai pour laisser l'animation BottomSheet démarrer avant le focus
    setTimeout(() => inputRef.current?.focus(), 300);
  }

  function confirm() {
    onChange(draft);
    setOpen(false);
    onCloseProp?.();
  }

  function cancel() {
    if (liveUpdate) onChange(""); // réinitialise la recherche
    setOpen(false);
    onCloseProp?.();
  }

  function handleChange(v: string) {
    setDraft(v);
    if (liveUpdate) onChange(v);
  }

  return (
    <>
      {/* Div faux-input : même apparence qu'un input, mais pas focusable */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: tap intentionnel */}
      <div className={className} onClick={openSheet} role="button" tabIndex={-1}>
        {value ? (
          <span className="text-gray-900">{value}</span>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
      </div>

      {open && (
        <BottomSheet onClose={cancel}>
          <div className="px-4 pt-1 pb-3 shrink-0">
            {label && (
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{label}</p>
            )}
            <input
              ref={inputRef}
              type={type}
              value={draft}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !liveUpdate) confirm();
              }}
              placeholder={placeholder}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{ fontSize: 16 }}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 outline-none focus:border-blue-400 transition-colors"
              {...inputProps}
            />
          </div>

          {/* Contenu additionnel (ex : résultats de recherche) */}
          {children?.(draft, setDraft)}

          {/* Boutons Annuler / OK uniquement en mode édition */}
          {!liveUpdate && (
            <div className="flex gap-2 px-4 pt-1 pb-2 shrink-0">
              <button
                type="button"
                onClick={cancel}
                className="flex-1 py-2.5 text-base text-gray-500 active:bg-gray-100 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirm}
                className="flex-1 py-2.5 text-base text-white bg-blue-500 active:bg-blue-600 rounded-xl transition-colors font-medium"
              >
                OK
              </button>
            </div>
          )}
        </BottomSheet>
      )}
    </>
  );
}
