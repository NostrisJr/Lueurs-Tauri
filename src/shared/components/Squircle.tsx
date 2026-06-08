import { getSvgPath } from "figma-squircle";
/**
 * Squircle — conteneur avec coins superellipse (style iOS).
 *
 * Le clip-path est appliqué directement sur le DOM element dans le callback
 * ResizeObserver (avant le paint du navigateur), sans passer par React state.
 * Cela évite un cycle de rendu supplémentaire et élimine tout lag visuel.
 */
import { type ComponentProps, useEffect, useRef } from "react";

interface SquircleProps extends ComponentProps<"div"> {
  radius?: number;
  topRadius?: number;
  bottomRadius?: number;
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

  const TL = topLeft ?? topRadius ?? radius;
  const TR = topRight ?? topRadius ?? radius;
  const BR = bottomRight ?? bottomRadius ?? radius;
  const BL = bottomLeft ?? bottomRadius ?? radius;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function applyClip(w: number, h: number) {
      if (!el || !w || !h) return;
      el.style.clipPath = `path('${getSvgPath({
        width: w,
        height: h,
        cornerSmoothing: 0.6,
        topLeftCornerRadius: TL,
        topRightCornerRadius: TR,
        bottomRightCornerRadius: BR,
        bottomLeftCornerRadius: BL,
      })}')`;
    }

    // Appliquer immédiatement pour le cas d'un changement de radius sans resize
    applyClip(el.offsetWidth, el.offsetHeight);

    const obs = new ResizeObserver(([entry]) => {
      const bbs = entry.borderBoxSize?.[0];
      applyClip(
        bbs?.inlineSize ?? entry.contentRect.width,
        bbs?.blockSize ?? entry.contentRect.height
      );
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [TL, TR, BR, BL]);

  // clipPath n'est pas dans style — il est appliqué impérativement par l'effet
  // pour ne jamais être écrasé par React lors d'un re-render.
  return (
    <div ref={ref} style={style} {...divProps}>
      {children}
    </div>
  );
}
