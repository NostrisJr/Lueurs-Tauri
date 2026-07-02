import { getSvgPath } from "figma-squircle";
import { type ReactNode, useEffect, useRef } from "react";
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const borderPathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    function updatePath(w: number, h: number) {
      if (!borderPathRef.current || !w || !h) return;
      borderPathRef.current.setAttribute(
        "d",
        getSvgPath({
          width: w,
          height: h,
          cornerSmoothing: 0.6,
          topLeftCornerRadius: 9999,
          topRightCornerRadius: 9999,
          bottomRightCornerRadius: 9999,
          bottomLeftCornerRadius: 9999,
        })
      );
    }

    updatePath(el.offsetWidth, el.offsetHeight);
    const obs = new ResizeObserver(([entry]) => {
      const bbs = entry.borderBoxSize?.[0];
      updatePath(
        bbs?.inlineSize ?? entry.contentRect.width,
        bbs?.blockSize ?? entry.contentRect.height
      );
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={wrapperClassName}
      style={{
        position: "relative",
        borderRadius: 9999,
        boxShadow: "0 8px 24px rgba(70,70,70,0.2)",
      }}
    >
      <Squircle
        radius={9999}
        className={`flex items-center liquid-glass-shadow ${
          vertical ? "flex-col gap-2 px-2 py-2.5" : "h-13 gap-3 px-3 py-2"
        } ${className ?? ""}`}
        style={{
          backgroundColor: bgColor ?? "rgba(250, 251, 253, 0.5)",
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
