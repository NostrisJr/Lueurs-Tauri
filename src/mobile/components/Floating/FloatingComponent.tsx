import type { ReactNode } from "react";
import { Squircle } from "../../../shared/components/Squircle";

interface FloatingComponentProps {
  className?: string;
  onClick?: () => void;
  children?: ReactNode;
  // rgba string pour contourner color-mix(oklab) de Tailwind v4 non supporté sur certains WebView Android
  bgColor?: string;
  // Pile verticale (hauteur auto) au lieu de la pilule horizontale par défaut
  vertical?: boolean;
}

function FloatingComponent({
  className,
  onClick,
  children,
  bgColor,
  vertical,
}: FloatingComponentProps) {
  return (
    <Squircle
      radius={9999}
      className={`flex items-center liquid-glass-shadow ${
        vertical ? "flex-col gap-2 px-2 py-2.5" : "h-13 gap-3 px-3 py-2"
      } ${className ?? ""}`}
      style={{
        filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.15))",
        ...(bgColor ? { backgroundColor: bgColor } : {}),
      }}
      onClick={onClick}
      tabIndex={-1}
    >
      {children}
    </Squircle>
  );
}

export { FloatingComponent };
