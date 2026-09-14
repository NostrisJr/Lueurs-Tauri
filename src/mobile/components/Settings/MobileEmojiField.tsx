import clsx from "clsx";
import { useState } from "react";
import { EmojiMartPicker } from "../../../shared/components/EmojiMartPicker";
import { hapticImpact } from "../../lib/haptics";
import { BottomSheet } from "../BottomSheet/BottomSheet";

interface Props {
  value?: string;
  onChange: (emoji: string) => void;
}

// Champ emoji mobile : le clavier natif n'expose pas de picker emoji fiable en
// WebView (pas d'inputmode dédié), on ouvre donc le picker dans une BottomSheet.
export function MobileEmojiField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          hapticImpact("light");
          setOpen(true);
        }}
        className={clsx(
          "w-10 h-10 shrink-0 flex items-center justify-center text-xl border rounded-lg transition-colors",
          "bg-surface-2 border-line-2",
          "active:bg-surface-3"
        )}
        aria-label="Choisir un emoji"
      >
        {value ? <span>{value}</span> : <span className="text-ink-5">+</span>}
      </button>

      {open && (
        <BottomSheet
          title="Emoji"
          onClose={() => setOpen(false)}
          heightFraction={0.6}
        >
          {/* Le picker gère son propre scroll interne à height=350. */}
          <div className="flex flex-col h-full">
            <EmojiMartPicker
              onSelect={(emoji) => {
                hapticImpact("light");
                onChange(emoji);
                setOpen(false);
              }}
            />
            <div
              className={clsx(
                "w-full left-0 justify-center px-4 pt-3",
                "bg-surface"
              )}
            >
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    hapticImpact("light");
                    onChange("");
                    setOpen(false);
                  }}
                  className={clsx(
                    "w-full py-3 text-sm active:opacity-60 transition-opacity",
                    "text-danger"
                  )}
                >
                  Supprimer l'emoji
                </button>
              )}
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
