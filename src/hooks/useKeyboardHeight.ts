import { useEffect, useState } from "react";

interface KeyboardState {
  keyboardHeight: number;
  isKeyboardOpen: boolean;
}

/**
 * Hauteur du clavier iOS via window.visualViewport.
 * Quand le clavier s'ouvre, visualViewport.height diminue tandis que
 * window.innerHeight reste stable (body { position:fixed }).
 */
export function useKeyboardHeight(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({
    keyboardHeight: 0,
    isKeyboardOpen: false,
  });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const height = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setState({ keyboardHeight: height, isKeyboardOpen: height > 50 });
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return state;
}
