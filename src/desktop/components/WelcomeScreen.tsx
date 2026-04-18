import { sfFolder } from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";

export function WelcomeScreen({ onPick }: { onPick: () => void }) {
  return (
    <div className="h-screen flex items-center justify-center bg-transparent">
      <div className="flex flex-col items-center gap-4 text-center max-w-xs">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
          <SFIcon icon={sfFolder} className="size-4" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-gray-800">
            Aucun dossier sélectionné
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Choisis un dossier contenant tes fichiers&nbsp;.md
          </p>
        </div>
        <button
          type="button"
          onClick={onPick}
          className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors cursor-pointer"
        >
          Choisir un dossier
        </button>
      </div>
    </div>
  );
}
