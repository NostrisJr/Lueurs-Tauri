import clsx from "clsx";
import { IconChevronLeft } from "../../../shared/components/PlatformIcon";
import { iconAccentClass } from "../../../shared/lib/platform";

interface Props {
  canGoBack: boolean;
  onDrillOut: () => void;
  /** Un déplacement est en cours : ce bouton devient la cible de dépôt du
   * dossier parent — il s'élargit et affiche son nom pour se lire comme une
   * destination, pas comme un retour. */
  dragActive?: boolean;
  dropOverParent?: boolean;
  /** Nom du dossier parent. Absent = le parent est la racine (rootName). */
  parentName?: string;
  rootName: string;
}

export function FileTreeBackButton({
  canGoBack,
  onDrillOut,
  dragActive,
  dropOverParent,
  parentName,
  rootName,
}: Props) {
  if (!canGoBack) return null;
  return (
    <div
      data-dropzone-parent={dragActive ? "" : undefined}
      className={clsx(
        "h-8 flex items-center rounded-full transition-all",
        dragActive && "px-2 gap-1 max-w-[45%] border border-dashed",
        dropOverParent
          ? "bg-amber-100 border-amber-400"
          : dragActive
            ? "bg-gray-50 border-gray-300"
            : "border-transparent"
      )}
    >
      <button
        type="button"
        onClick={onDrillOut}
        className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full ${iconAccentClass} active:bg-black/5 transition-colors`}
      >
        <IconChevronLeft className="size-4" />
      </button>
      {dragActive && (
        <span className="text-xs font-medium text-gray-600 truncate pr-1">
          {parentName ?? rootName}
        </span>
      )}
    </div>
  );
}
