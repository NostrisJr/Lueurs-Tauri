import { sfCheckmark } from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { useAtomValue } from "jotai";
import { activeNoteAtom, savingAtom } from "../lib/atoms";

function SavingIndicator() {
  const activeNote = useAtomValue(activeNoteAtom);
  const saving = useAtomValue(savingAtom);
  return (
    <div>
      {activeNote && (
        <div className="flex justify-end items-center px-4 h-8 pt-2">
          <span
            className={`flex items-baseline gap-1.5 text-xs transition-opacity ${
              saving ? "text-gray-400 opacity-100" : "text-gray-300 opacity-60"
            }`}
          >
            <SFIcon icon={sfCheckmark} className="size-3" aria-hidden="true" />
            {saving ? "Sauvegarde..." : "Sauvegardé"}
          </span>
        </div>
      )}
    </div>
  );
}

export { SavingIndicator };
