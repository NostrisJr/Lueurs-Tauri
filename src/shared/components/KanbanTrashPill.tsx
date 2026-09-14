import clsx from "clsx";
import { IconTrash } from "./PlatformIcon";

interface Props {
  /** Un drag est en cours — la cible ne se montre qu'à ce moment-là. */
  visible: boolean;
  /** La carte survole la cible. */
  active: boolean;
  /** Cible plus large et texte plus lisible au doigt. */
  touch?: boolean;
  /** Posé par le parent : droppable dnd-kit (desktop) ou dropzone (mobile). */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Pilule « corbeille » du board kanban — présentation seule, partagée par les
 * deux plateformes : desktop et mobile détectent le survol par des mécanismes
 * différents (dnd-kit / elementsFromPoint) mais montrent la même cible.
 */
export function KanbanTrashPill({ visible, active, touch, ref }: Props) {
  return (
    <div
      ref={ref}
      // Recouvre la zone d'autoscroll haute de la page : sans ce marqueur,
      // viser la corbeille ferait remonter la page sous la carte.
      data-no-autoscroll=""
      aria-hidden={!visible}
      className={clsx(
        "flex items-center gap-2 rounded-full border border-dashed font-body shadow-sm transition-all duration-150",
        touch ? "px-6 py-3 text-sm" : "px-5 py-2.5 text-xs",
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-2 pointer-events-none",
        active
          ? "bg-danger-soft border-danger-2 text-danger scale-105"
          : "bg-surface/90 border-line-3 text-ink-4"
      )}
    >
      <IconTrash className={touch ? "size-4" : "size-3.5"} aria-hidden="true" />
      <span>Supprimer</span>
    </div>
  );
}
