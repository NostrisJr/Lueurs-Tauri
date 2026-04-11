import { invoke } from "@tauri-apps/api/core";
import { useCallback, useRef } from "react";
import type { SpellError } from "../types/spellcheck";

export function useSpellcheck() {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const check = useCallback(
    (text: string, onResult: (errors: SpellError[]) => void) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        if (!text.trim()) return;
        try {
          const errors = await invoke<SpellError[]>("check_grammar", { text });
          onResult(errors);
        } catch (e) {
          console.error("Grammalecte error:", e);
        }
      }, 600);
    },
    []
  );

  return { check };
}
