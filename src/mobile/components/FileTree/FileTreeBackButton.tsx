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
          ? "bg-accent-soft-2 border-accent-2"
          : dragActive
            ? "bg-surface-2 border-line-3"
            : "border-transparent"
      )}
    >
      <button
        type="button"
        onClick={onDrillOut}
        className={clsx(
          "w-8 h-8 shrink-0 flex items-center justify-center rounded-full",
          iconAccentClass,
          "active:bg-tint transition-colors"
        )}
      >
        <IconChevronLeft className="size-4" />
      </button>
      {dragActive && (
        <span
          className={clsx("text-xs font-medium truncate pr-1", "text-ink-2")}
        >
          {parentName ?? rootName}
        </span>
      )}
    </div>
  );
}
