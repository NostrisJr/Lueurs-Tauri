import { describe, expect, it } from "vitest";
import {
  AUTOSCROLL_EDGE_PX,
  AUTOSCROLL_MAX_STEP_PX,
  computeAutoscrollStep,
} from "./dragAutoscroll";

// Conteneur de référence : 0 → 1000 sur l'axe testé.
const START = 0;
const END = 1000;

describe("computeAutoscrollStep", () => {
  it("ne défile pas au centre, hors des deux zones de bord", () => {
    expect(computeAutoscrollStep(500, START, END)).toBe(0);
    expect(computeAutoscrollStep(AUTOSCROLL_EDGE_PX, START, END)).toBe(0);
    expect(computeAutoscrollStep(END - AUTOSCROLL_EDGE_PX, START, END)).toBe(0);
  });

  it("défile vers le début dans la zone haute/gauche, de plus en plus vite", () => {
    const loin = computeAutoscrollStep(AUTOSCROLL_EDGE_PX - 1, START, END);
    const proche = computeAutoscrollStep(10, START, END);
    expect(loin).toBeLessThan(0);
    expect(proche).toBeLessThan(loin);
    expect(computeAutoscrollStep(START, START, END)).toBe(
      -AUTOSCROLL_MAX_STEP_PX
    );
  });

  it("défile vers la fin dans la zone basse/droite, de plus en plus vite", () => {
    const loin = computeAutoscrollStep(
      END - AUTOSCROLL_EDGE_PX + 1,
      START,
      END
    );
    const proche = computeAutoscrollStep(END - 10, START, END);
    expect(loin).toBeGreaterThan(0);
    expect(proche).toBeGreaterThan(loin);
    expect(computeAutoscrollStep(END, START, END)).toBe(AUTOSCROLL_MAX_STEP_PX);
  });

  it("plafonne la vitesse quand le pointeur sort du conteneur", () => {
    expect(computeAutoscrollStep(-300, START, END)).toBe(
      -AUTOSCROLL_MAX_STEP_PX
    );
    expect(computeAutoscrollStep(END + 300, START, END)).toBe(
      AUTOSCROLL_MAX_STEP_PX
    );
  });

  it("privilégie le bord de début quand le conteneur est plus étroit que deux zones", () => {
    // Les deux zones se recouvrent : le bord de début l'emporte, jamais les deux.
    const step = computeAutoscrollStep(40, 0, 80);
    expect(step).toBeLessThan(0);
  });
});
