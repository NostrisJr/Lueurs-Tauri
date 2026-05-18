import { IconCheckmark } from "../../shared/components/PlatformIcon";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { activeNoteAtom, savingAtom } from "../../shared/lib/Atoms";

type DisplayState = "saving" | "saved" | "hidden";

function SavingIndicator() {
  const activeNote = useAtomValue(activeNoteAtom);
  const saving = useAtomValue(savingAtom);
  const [displayState, setDisplayState] = useState<DisplayState>("hidden");
  const [opaque, setOpaque] = useState(false);

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (saving) {
      // Annuler toutes les transitions en cours
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);

      setDisplayState("saving");
      setOpaque(true);
    } else {
      // Garder l'état "sauvegarde" encore 1s après la dernière modification
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => {
        setDisplayState("saved");

        // Après 3s en état "sauvegardé", lancer le fade out
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setOpaque(false);
          // Démonter après la fin de la transition CSS
          unmountTimerRef.current = setTimeout(() => {
            setDisplayState("hidden");
          }, 500);
        }, 3000);
      }, 1000);
    }

    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    };
  }, [saving]);

  if (!activeNote || displayState === "hidden") return null;

  return (
    <div
      className={`liquid-glass-shadow rounded-xl absolute bottom-2 right-4 px-2 min-w-40 flex justify-start transition-opacity duration-300 ${opaque ? "opacity-100" : "opacity-0"}`}
    >
      <div className="flex justify-end items-center px-4 h-8">
        <span className="flex items-baseline gap-1.5 text-xs text-gray-500">
          <IconCheckmark className="size-3" aria-hidden="true" />
          {displayState === "saving" ? "Sauvegarde..." : "Sauvegardé"}
        </span>
      </div>
    </div>
  );
}

export { SavingIndicator };
