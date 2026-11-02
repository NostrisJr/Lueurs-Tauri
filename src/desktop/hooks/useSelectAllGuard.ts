import { useEffect } from "react";
import {
  isSelectAllShortcut,
  isTextEditingTarget,
} from "../../shared/lib/selectAllGuard";

/** Neutralise Cmd+A quand le focus n'est pas dans un champ éditable. */
export function useSelectAllGuard() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!isSelectAllShortcut(e)) return;
      if (isTextEditingTarget(e.target as HTMLElement | null)) return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
