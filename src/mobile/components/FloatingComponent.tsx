import type { ReactNode } from "react";

interface FloatingComponentProps {
  className?: string;
  onClick?: () => void;
  children?: ReactNode;
}

function FloatingComponent({
  className,
  onClick,
  children,
}: FloatingComponentProps) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
    <span
      className={`flex h-13 items-center gap-3 px-3 py-2 rounded-full liquid-glass-shadow ${className ?? ""}`}
      onClick={onClick}
      tabIndex={-1}
    >
      {children}
    </span>
  );
}

export { FloatingComponent };
