import { useEffect, useRef } from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const newNumBars = Math.floor(width / BAR_STEP);
    bufRef.current = new Float32Array(newNumBars).fill(0);
  }, [width, height]);

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

    function draw() {
      if (!ctx) return;
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
    }

    if (!isActive) {
      cancelAnimationFrame(rafRef.current);
      bufRef.current.fill(0);
      draw();
      return;
    }

    function loop() {
      if (dirtyRef.current) draw();
      rafRef.current = requestAnimationFrame(loop);
    }
    loop();

    // Sur iOS, le plugin Swift émet via trigger() → Channel (addPluginListener standard Tauri).
    // Sur desktop, le plugin Rust émet via app.emit() → listen() global.
    let cancelListener: (() => void) | undefined;
    let firstEvent = true;

    const handleAmplitude = (payload: AmplitudePayload) => {
      if (firstEvent) {
        log.info("premier événement amplitude reçu", { rms: payload.rms });
        firstEvent = false;
      }
      bufRef.current.copyWithin(0, 1);
      bufRef.current[bars - 1] = Math.min(1, Math.max(0, payload.rms));
      dirtyRef.current = true;
    };

    (async () => {
      log.info("enregistrement amplitude listener...");
      try {
        // iOS : commande directe avec Channel explicite → registerAmplitudeListener dans Swift
        const ch = new Channel<AmplitudePayload>(handleAmplitude);
        await invoke("plugin:audio-recorder|registerAmplitudeListener", { handler: ch });
        log.info("registerAmplitudeListener OK", { channelId: ch.id });
        cancelListener = () => {};
      } catch (err) {
        log.warn("registerAmplitudeListener échoué, fallback listen()", err);
        const unlisten = await listen<AmplitudePayload>(
          "audio-recorder://amplitude",
          (event) => handleAmplitude(event.payload)
        );
        log.info("listen() enregistré (desktop fallback)");
        cancelListener = unlisten;
      }
    })().catch((e) => log.error("impossible d'écouter l'event amplitude", e));

    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelListener?.();
      log.info("écoute amplitude arrêtée");
    };
  }, [isActive, width, height, color]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: "block" }}
      className="px-4 rounded-2xl bg-gray-50"
    />
  );
}
