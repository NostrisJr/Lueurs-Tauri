import clsx from "clsx";
import { isMobile } from "../lib/platform";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  Icon?: React.FC<{ className?: string }>;
  disabled?: boolean;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * "rounded" (défaut) : pills à coins arrondis, largeur au contenu — utilisé
   * pour les choix secondaires (réglages éditeur, vue Table/Kanban).
   * "pill" : arrondi complet + inset-shadow, largeur égale — style de la barre
   * d'onglets des Réglages (SettingsModal) et de la TabBar des notes ouvertes.
   */
  variant?: "rounded" | "pill";
}

/** Sélecteur à choix exclusif (pills), style natif macOS. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = "rounded",
}: SegmentedControlProps<T>) {
  const isPill = variant === "pill";
  // 16px minimum sur mobile (lisibilité) — text-xs/text-sm ne conviennent
  // qu'au desktop, plus dense.

  return (
    <div
      className={clsx(
        "flex gap-1 bg-track",
        isPill
          ? "w-full inset-shadow-xs rounded-full p-0.75"
          : "w-fit rounded-lg p-1"
      )}
    >
      {options.map(({ value: v, label, Icon, disabled, title }) => (
        <button
          key={v}
          type="button"
          disabled={disabled}
          title={title}
          // Empêche de voler le focus à un champ actif ailleurs (ex: un champ
          // formule en cours d'édition) — le clic change quand même la valeur.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => !disabled && onChange(v)}
          className={clsx(
            "flex items-center justify-center gap-1.5 whitespace-nowrap transition-all select-none",
            isPill ? "flex-1 rounded-full font-medium" : "rounded-md",
            isMobile
              ? "px-3 py-2 text-base"
              : isPill
                ? "px-3 py-1 text-xs"
                : "px-3 py-1.5 text-sm",
            // Sélectionné : pastille en relief sur la piste creusée.
            value === v &&
              (isPill
                ? "bg-control text-ink shadow-sm shadow-shade-2 ring-1 ring-control ring-inset inset-shadow-sm inset-shadow-control cursor-default"
                : "bg-control shadow-sm text-ink font-medium cursor-default"),
            value !== v && disabled && "text-ink-5 cursor-not-allowed",
            value !== v &&
              !disabled &&
              (isPill
                ? "text-ink-4 hover:bg-surface-4 cursor-default"
                : "text-ink-3 hover:text-ink-2 cursor-default")
          )}
        >
          {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
          {label}
        </button>
      ))}
    </div>
  );
}
