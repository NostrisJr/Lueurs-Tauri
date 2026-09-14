import clsx from "clsx";
import type { ReactNode } from "react";
import { Squircle } from "../../../shared/components/Squircle";

interface FloatingComponentProps {
  className?: string;
  // Classes appliquées au wrapper externe (flex-1, shrink-0, min-w-0…)
  wrapperClassName?: string;
  onClick?: () => void;
  children?: ReactNode;
  // rgba string pour contourner color-mix(oklab) de Tailwind v4 non supporté sur certains WebView Android
  bgColor?: string;
  // Pile verticale (hauteur auto) au lieu de la pilule horizontale par défaut
  vertical?: boolean;
}

function FloatingComponent({
  className,
  wrapperClassName,
  onClick,
  children,
  bgColor,
  vertical,
}: FloatingComponentProps) {
  return (
    <div
      className={wrapperClassName}
      style={{
        position: "relative",
        borderRadius: 9999,
        boxShadow: "0 8px 24px var(--glass-drop-shadow)",
      }}
    >
      <Squircle
        radius={9999}
        className={clsx(
          "flex items-center liquid-glass-shadow",
          vertical ? "flex-col gap-2 px-2 py-2.5" : "h-13 gap-3 px-3 py-2",
          className ?? ""
        )}
        style={{
          // Indispensable en plus du clip-path : les reflets de bezel sont des
          // `box-shadow: inset`, qui suivent le border-radius de la boîte. Sans
          // rayon ici, ils dessinent un rectangle que le clip tronque aux coins
          // — 4 traits qui ne se rejoignent pas, comme une sous-div incrustée.
          borderRadius: 9999,
          backgroundColor: bgColor ?? "var(--glass-fill)",
        }}
        onClick={onClick}
        tabIndex={-1}
      >
        {children}
      </Squircle>
    </div>
  );
}

export { FloatingComponent };
