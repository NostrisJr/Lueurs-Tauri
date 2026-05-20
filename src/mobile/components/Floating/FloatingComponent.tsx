import type { ReactNode } from "react";
import { Squircle } from "../Squircle";

interface FloatingComponentProps {
  className?: string;
  onClick?: () => void;
  children?: ReactNode;
  // rgba string pour contourner color-mix(oklab) de Tailwind v4 non supporté sur certains WebView Android
  bgColor?: string;
}

function FloatingComponent({
  className,
  onClick,
  children,
  bgColor,
}: FloatingComponentProps) {
  return (
    <Squircle
      radius={9999}
      className={`flex h-13 items-center gap-3 px-3 py-2 liquid-glass-shadow ${className ?? ""}`}
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
