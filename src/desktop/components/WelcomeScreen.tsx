import clsx from "clsx";
import { IconFolder } from "../../shared/components/PlatformIcon";

export function WelcomeScreen({ onPick }: { onPick: () => void }) {
  return (
    <div className="h-screen flex items-center justify-center bg-transparent">
      <div className="flex flex-col items-center gap-4 text-center max-w-xs">
        <div
          className={clsx(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            "bg-surface-3 text-ink-4"
          )}
        >
          <IconFolder className="size-4" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-ink">Aucun dossier sélectionné</p>
          <p className="text-sm text-ink-4 mt-1">
            Choisis un dossier contenant tes fichiers&nbsp;.md
          </p>
        </div>
        <button
          type="button"
          onClick={onPick}
          className={clsx(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
            "bg-inverse text-on-inverse",
            "hover:bg-inverse-2"
          )}
        >
          Choisir un dossier
        </button>
      </div>
    </div>
  );
}
