// Décodage et rendu waveform via Web Audio API.
// Aucune dépendance React ni lecteur audio — utilisable partout.
//
// Les couleurs sont relues à CHAQUE tracé depuis les tokens : un canvas n'est
// pas atteint par la cascade CSS, il garderait donc les couleurs du thème en
// vigueur au moment du décodage. Les appelants doivent redessiner au
// changement de thème (cf. leurs effets sur resolvedThemeAtom).
//
// L'AudioContext est fourni par le consommateur et N'EST PAS fermé ici :
// le garder en vie maintient la session audio macOS initialisée, ce qui
// évite le délai ~1s de réinitialisation au premier play.

import { themeColor } from "../../lib/theme";

/**
 * Canvas porteur de son propre tracé. Appelé sans argument, drawBars redessine
 * à la position courante — c'est ce dont a besoin un changement de thème.
 */
export interface WaveformCanvas extends HTMLCanvasElement {
  _drawBars?: (progress?: number) => void;
}

export async function drawWaveform(
  canvas: HTMLCanvasElement,
  ctx: AudioContext,
  buffer: ArrayBuffer,
  onDone: (audioBuffer: AudioBuffer) => void,
  onError: (e: unknown) => void
): Promise<void> {
  try {
    const decoded = await ctx.decodeAudioData(buffer);

    const data = decoded.getChannelData(0);
    const W = canvas.width;
    const H = canvas.height;
    const c = canvas.getContext("2d")!;
    const blockSize = Math.floor(data.length / W);

    const peaks: number[] = [];
    for (let i = 0; i < W; i++) {
      let max = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize; j++) {
        const v = Math.abs(data[start + j] || 0);
        if (v > max) max = v;
      }
      peaks.push(max);
    }

    const barW = 2;
    const gap = 1.5;
    const step = barW + gap;
    const nbars = Math.floor(W / step);

    const resampled: number[] = [];
    for (let i = 0; i < nbars; i++) {
      const idx = Math.round((i / nbars) * peaks.length);
      resampled.push(peaks[idx] ?? 0);
    }

    // Mémorisée pour qu'un appel sans argument redessine à la position
    // courante — c'est ce dont a besoin un changement de thème.
    let lastProgress = 0;

    const drawBars = (progress = lastProgress) => {
      lastProgress = progress;
      const idle = themeColor("--color-wave");
      const played = themeColor("--color-wave-played");
      c.clearRect(0, 0, W, H);
      resampled.forEach((amp, i) => {
        const x = i * step;
        const bh = Math.max(3, amp * (H - 4));
        const y = (H - bh) / 2;
        c.fillStyle = x / W < progress ? played : idle;
        c.beginPath();
        c.roundRect(x, y, barW, bh, 1);
        c.fill();
      });
    };

    drawBars();
    (canvas as WaveformCanvas)._drawBars = drawBars;

    // L'AudioBuffer décodé est retourné pour la lecture directe (AudioBufferSourceNode)
    onDone(decoded);
  } catch (err) {
    onError(err);
  }
}
