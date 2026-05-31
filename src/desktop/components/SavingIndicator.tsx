import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { IconCheckmark } from "../../shared/components/PlatformIcon";
import { useDocStats } from "../../shared/hooks/useDocStats";
import {
  activeNoteAtom,
  pageFormatAtom,
  savingAtom,
} from "../../shared/lib/atoms";

type SaveState = "saving" | "saved" | "hidden";

// Encart de statut bas-droite : stats du document (pages/mots) en permanence,
// et état de sauvegarde affiché en ligne puis estompé.
function SavingIndicator() {
  const activeNote = useAtomValue(activeNoteAtom);
  const saving = useAtomValue(savingAtom);
  const pageFormat = useAtomValue(pageFormatAtom);
  const stats = useDocStats();

  const [saveState, setSaveState] = useState<SaveState>("hidden");
  const [saveOpaque, setSaveOpaque] = useState(false);

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (saving) {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
      setSaveState("saving");
      setSaveOpaque(true);
    } else {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      // Garder "Sauvegarde" 1s après la dernière modification, puis "Sauvegardé",
      // puis estompage du seul sous-indicateur (les stats restent visibles).
      savedTimerRef.current = setTimeout(() => {
        setSaveState("saved");
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setSaveOpaque(false);
          unmountTimerRef.current = setTimeout(() => {
            setSaveState("hidden");
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

  if (!activeNote) return null;
  // Rien à afficher tant qu'on n'a ni stats ni état de sauvegarde
  if (!stats && saveState === "hidden") return null;

  return (
    <div className="liquid-glass-shadow rounded-xl absolute bottom-2 right-4 px-2 flex justify-end">
      <div className="flex items-center gap-3 px-4 h-8 text-xs text-gray-500">
        {saveState !== "hidden" && (
          <span
            className={`flex items-baseline gap-1.5 transition-opacity duration-300 ${saveOpaque ? "opacity-100" : "opacity-0"}`}
          >
            <IconCheckmark className="size-3" aria-hidden="true" />
            {saveState === "saving" ? "Sauvegarde..." : "Sauvegardé"}
          </span>
        )}
        {stats && (
          <span className="tabular-nums whitespace-nowrap">
            ~{stats.pages} p. {pageFormat} · {stats.words}{" "}
            {stats.words > 1 ? "mots" : "mot"}
          </span>
        )}
      </div>
    </div>
  );
}

export { SavingIndicator };
