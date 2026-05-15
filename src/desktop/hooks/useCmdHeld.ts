import { useEffect, useState } from "react";

/** Retourne true tant que la touche Cmd (Meta) est enfoncée. */
export function useCmdHeld(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Meta") setHeld(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "Meta") setHeld(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);
  return held;
}
