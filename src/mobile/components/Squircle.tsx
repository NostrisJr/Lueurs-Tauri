import { getSvgPath } from "figma-squircle";
/**
 * Squircle — conteneur avec coins superellipse (style iOS).
 *
 * Génération du path via figma-squircle (getSvgPath).
 * Supporte radius (tous les coins), topRadius, bottomRadius,
 * ou topLeft / topRight / bottomLeft / bottomRight individuellement.
 */
import { type ComponentProps, useEffect, useRef, useState } from "react";

interface SquircleProps extends ComponentProps<"div"> {
  /** Rayon pour tous les coins (défaut 0) */
  radius?: number;
  /** Rayon pour les deux coins du haut */
  topRadius?: number;
  /** Rayon pour les deux coins du bas */
  bottomRadius?: number;
  /** Coins individuels (priorité sur topRadius/bottomRadius/radius) */
  topLeft?: number;
  topRight?: number;
  bottomLeft?: number;
  bottomRight?: number;
}

export function Squircle({
  radius = 0,
  topRadius,
  bottomRadius,
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  style,
  children,
  ...divProps
}: SquircleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const TL = topLeft ?? topRadius ?? radius;
  const TR = topRight ?? topRadius ?? radius;
  const BR = bottomRight ?? bottomRadius ?? radius;
  const BL = bottomLeft ?? bottomRadius ?? radius;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const bbs = entry.borderBoxSize?.[0];
      setDims({
        w: bbs?.inlineSize ?? entry.contentRect.width,
        h: bbs?.blockSize ?? entry.contentRect.height,
      });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const clipPath =
    dims.w && dims.h
      ? `path('${getSvgPath({
          width: dims.w,
          height: dims.h,
          cornerSmoothing: 0.6,
          topLeftCornerRadius: TL,
          topRightCornerRadius: TR,
          bottomRightCornerRadius: BR,
          bottomLeftCornerRadius: BL,
        })}')`
      : undefined;

  return (
    <div ref={ref} style={{ ...style, clipPath }} {...divProps}>
      {children}
    </div>
  );
}
