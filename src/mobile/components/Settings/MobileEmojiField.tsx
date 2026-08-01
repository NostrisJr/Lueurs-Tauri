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
        className="w-10 h-10 shrink-0 flex items-center justify-center text-xl bg-gray-50 border border-gray-200 rounded-lg active:bg-gray-100 transition-colors"
        aria-label="Choisir un emoji"
      >
        {value ? (
          <span>{value}</span>
        ) : (
          <span className="text-gray-300">+</span>
        )}
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
            <div className="w-full left-0 justify-center bg-white px-4 pt-3">
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    hapticImpact("light");
                    onChange("");
                    setOpen(false);
                  }}
                  className="w-full py-3 text-sm text-red-500 active:opacity-60 transition-opacity"
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
