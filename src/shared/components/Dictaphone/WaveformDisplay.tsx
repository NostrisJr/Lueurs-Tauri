import { Channel, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import { createLogger } from "../../lib/logger";

const log = createLogger("WaveformDisplay");

interface AmplitudePayload {
  rms: number;
}

interface Props {
  isActive: boolean;
  width?: number;
  height?: number;
  color: string | CanvasGradient | CanvasPattern;
}

const BAR_WIDTH = 1;
const BAR_GAP = 4;
const BAR_STEP = BAR_WIDTH + BAR_GAP;

// Facteur de grossissement logarithmique — amplifie les sons faibles,
// laisse les sons forts à 1. Ajuste `gamma` pour plus ou moins d'effet.
function amplify(rms: number, gamma = 0.3): number {
  if (rms <= 0) return 0;
  return Math.min(1, rms ** gamma);
}

export function WaveformDisplay({
  isActive,
  width = 280,
  height = 64,
  color,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const numBars = Math.floor(width / BAR_STEP);
  const bufRef = useRef(new Float32Array(numBars).fill(0));
  const rafRef = useRef<number>(0);
  const dirtyRef = useRef(false);
  // draw stable : remappé à chaque changement de visuel (width/height/color).
  // Stocké en ref pour que la loop RAF (effet listener) reste indépendante des
  // changements visuels et ne soit pas recyclée à chaque tweak de couleur.
  const drawRef = useRef<() => void>(() => {});
  // cancelListener accessible synchronisement par la cleanup, même si l'assignation
  // se fait après l'await async.
  const cancelListenerRef = useRef<(() => void) | null>(null);

  // ── Resize canvas + buffer ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const newNumBars = Math.floor(width / BAR_STEP);
    const oldBuf = bufRef.current;
    if (newNumBars !== oldBuf.length) {
      const newBuf = new Float32Array(newNumBars);
      if (newNumBars <= oldBuf.length) {
        // Garde les barres les plus récentes (côté droit du buffer)
        newBuf.set(oldBuf.slice(oldBuf.length - newNumBars));
      } else {
        // Buffer plus grand : les anciennes valeurs sont repoussées à droite
        newBuf.set(oldBuf, newNumBars - oldBuf.length);
      }
      bufRef.current = newBuf;
    }
  }, [width, height]);

  // ── Setup du rendu (draw) + repaint immédiat à chaque tweak visuel ───────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cy = (height / 2) * dpr;
    const amp = (height / 2) * dpr * 0.88;
    const bw = BAR_WIDTH * dpr;
    const step = BAR_STEP * dpr;
    const radius = bw / 2;
    const bars = Math.floor(width / BAR_STEP);

    drawRef.current = () => {
      ctx.clearRect(0, 0, width * dpr, height * dpr);
      ctx.fillStyle = color;
      const buf = bufRef.current;
      for (let i = 0; i < bars; i++) {
        const amplified = amplify(buf[i]);
        const barH = Math.max(2 * dpr, amplified * amp * 2);
        const x = i * step;
        const y = cy - barH / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, bw, barH, radius);
        ctx.fill();
      }
      dirtyRef.current = false;
    };

    drawRef.current();
  }, [width, height, color]);

  // ── Listener Tauri + boucle RAF — pilotés uniquement par isActive ────────
  // Le re-mount de ce listener à chaque changement de color/size est ce qui
  // causait des événements amplitude perdus pendant l'await. Cf. audit A12.
  useEffect(() => {
    if (!isActive) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      // Preserve le buffer pour restauration au toggle pill/sheet ; le repaint
      // statique de la frame courante est fait par l'effet visuel ci-dessus.
      drawRef.current?.();
      return;
    }

    function loop() {
      if (dirtyRef.current) drawRef.current?.();
      rafRef.current = requestAnimationFrame(loop);
    }
    loop();

    let firstEvent = true;
    const handleAmplitude = (payload: AmplitudePayload) => {
      if (firstEvent) {
        log.info("premier événement amplitude reçu", { rms: payload.rms });
        firstEvent = false;
      }
      // length - 1 : la longueur peut changer entre setup et émission si width
      // bouge ; on écrit toujours dans la dernière case du buffer courant.
      const buf = bufRef.current;
      buf.copyWithin(0, 1);
      buf[buf.length - 1] = Math.min(1, Math.max(0, payload.rms));
      dirtyRef.current = true;
    };

    let cancelled = false;
    (async () => {
      log.info("enregistrement amplitude listener...");
      try {
        // iOS : commande directe avec Channel explicite → registerAmplitudeListener dans Swift.
        // Nom en snake_case (Tauri mappe vers la méthode Swift camelCase).
        const ch = new Channel<AmplitudePayload>(handleAmplitude);
        await invoke("plugin:audio-recorder|register_amplitude_listener", {
          handler: ch,
        });
        log.info("registerAmplitudeListener OK", { channelId: ch.id });
        if (cancelled) return;
        cancelListenerRef.current = () => {};
      } catch (err) {
        log.warn("registerAmplitudeListener échoué, fallback listen()", err);
        const unlisten = await listen<AmplitudePayload>(
          "audio-recorder://amplitude",
          (event) => handleAmplitude(event.payload)
        );
        log.info("listen() enregistré (desktop fallback)");
        if (cancelled) {
          unlisten();
          return;
        }
        cancelListenerRef.current = unlisten;
      }
    })().catch((e) => log.error("impossible d'écouter l'event amplitude", e));

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      cancelListenerRef.current?.();
      cancelListenerRef.current = null;
      log.info("écoute amplitude arrêtée");
    };
  }, [isActive]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: "block" }}
      className="px-4 rounded-2xl bg-gray-50"
    />
  );
}
