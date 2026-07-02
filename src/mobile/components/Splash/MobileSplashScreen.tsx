import { useCallback, useEffect, useRef, useState } from "react";

const FADE_MS = 300;
const MIN_MS = 800; // durée minimale d'affichage (fade-in inclus)

type Phase = "fade-in" | "visible" | "fade-out" | "done";

interface Props {
  visible: boolean;
}

export function MobileSplashScreen({ visible }: Props) {
  const [phase, setPhase] = useState<Phase>("fade-in");
  const minElapsed = useRef(false);
  const hideRequested = useRef(false);

  const triggerHide = useCallback(() => {
    setPhase("fade-out");
    setTimeout(() => setPhase("done"), FADE_MS);
  }, []);

  // Lance le fade-in après le premier paint
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase("visible"));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Durée minimale : ne cache pas avant MIN_MS même si le contenu est prêt
  useEffect(() => {
    const t = setTimeout(() => {
      minElapsed.current = true;
      if (hideRequested.current) triggerHide();
    }, MIN_MS);
    return () => clearTimeout(t);
  }, [triggerHide]);

  // Réagit quand le parent signale que le contenu est prêt
  useEffect(() => {
    if (!visible) {
      hideRequested.current = true;
      if (minElapsed.current) triggerHide();
    }
  }, [visible, triggerHide]);

  if (phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white"
      style={{
        opacity: phase === "visible" ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: phase === "fade-out" ? "none" : "auto",
      }}
    >
      <div className="h-full flex items-center justify-center bg-white pt-8">
        <p className="font-title text-4xl text-gray-900 font-semibold tracking-wide">
          Lueurs
        </p>
      </div>
      <div className="mb-6">
        <p className="font-body text-md text-gray-400 ">par Théophile Donato</p>
      </div>
    </div>
  );
}
