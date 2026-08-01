import type { FC, ReactNode } from "react";

/** Une entrée du menu contextuel iOS (rangée d'icônes ou liste verticale). */
export interface RowMenuAction {
  id: string;
  label: string;
  icon: FC<{ className?: string }>;
  destructive?: boolean;
  /** Le menu se ferme avant l'exécution — l'action ne doit donc rien attendre de l'overlay. */
  onPress: () => void | Promise<void>;
}

export interface RowMenuConfig {
  /** Aperçu soulevé (carte). Absent = pas de menu contextuel sur cette rangée. */
  preview: ReactNode;
  /** Rangée d'icônes en haut du menu (0 à 3 actions ; vide = rangée masquée). */
  primary?: RowMenuAction[];
  /** Liste verticale sous la rangée d'icônes. */
  items?: RowMenuAction[];
}
