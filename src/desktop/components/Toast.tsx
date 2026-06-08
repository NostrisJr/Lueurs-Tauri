import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { toastAtom } from "../../shared/lib/atoms";

const VISIBLE_MS = 4500;
const FADE_MS = 300;

// Notification transitoire bas-centre. Affiche toastAtom puis l'efface après VISIBLE_MS.
function Toast() {
  const [toast, setToast] = useAtom(toastAtom);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const hideTimer = setTimeout(() => setVisible(false), VISIBLE_MS);
    const clearTimer = setTimeout(() => setToast(null), VISIBLE_MS + FADE_MS);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
    };
  }, [toast, setToast]);

  if (!toast) return null;

  return (
    <div
      className={`liquid-glass-shadow rounded-xl fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md px-4 py-2.5 text-xs text-gray-600 text-center transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      role="status"
    >
      {toast}
    </div>
  );
}

export { Toast };
