import { describe, expect, it } from "vitest";
import {
  type ColumnSpan,
  currentColumnIndex,
  edgeDirection,
  stepColumnScrollLeft,
} from "./kanbanColumnScroll";

// 5 colonnes de 200px espacées de 20px, dans un board large de 500px.
const COLUMNS: ColumnSpan[] = [0, 1, 2, 3, 4].map((i) => ({
  start: i * 220,
  size: 200,
}));
const VIEWPORT = 500;
const SCROLL_WIDTH = 4 * 220 + 200; // 1080
const MAX_SCROLL = SCROLL_WIDTH - VIEWPORT; // 580

function step(scrollLeft: number, direction: -1 | 1) {
  return stepColumnScrollLeft(
    COLUMNS,
    scrollLeft,
    VIEWPORT,
    SCROLL_WIDTH,
    direction
  );
}

describe("currentColumnIndex", () => {
  it("désigne la colonne dont le centre est le plus proche du centre visible", () => {
    // Centre visible à 250 → colonne 1 (centre 320) plus proche que 0 (centre 100)
    expect(currentColumnIndex(COLUMNS, 0, VIEWPORT)).toBe(1);
    // Colonne 2 centrée (centre 540 → scrollLeft 290)
    expect(currentColumnIndex(COLUMNS, 290, VIEWPORT)).toBe(2);
  });

  it("reste dans les bornes aux deux extrémités du board", () => {
    // En butée droite la dernière colonne est collée au bord : la plus proche
    // du centre est l'avant-dernière.
    expect(currentColumnIndex(COLUMNS, MAX_SCROLL, VIEWPORT)).toBe(3);
    expect(currentColumnIndex([], 0, VIEWPORT)).toBe(-1);
  });
});

describe("stepColumnScrollLeft", () => {
  it("centre la colonne suivante, sans l'aligner à gauche", () => {
    // Départ colonne 1 centrée (scrollLeft 70) → colonne 2 centrée en 290
    expect(step(70, 1)).toBe(290);
  });

  it("centre la colonne précédente", () => {
    expect(step(290, -1)).toBe(70);
  });

  it("borne la cible au début du board plutôt que de passer en négatif", () => {
    // Centrer la colonne 0 demanderait scrollLeft -150
    expect(step(70, -1)).toBe(0);
  });

  it("borne la cible à la fin du board", () => {
    // Depuis la colonne 3 centrée : centrer la dernière demanderait 730, au-delà
    // du maximum atteignable.
    expect(step(510, 1)).toBe(MAX_SCROLL);
  });

  it("ne fait rien quand il n'y a plus de colonne dans cette direction", () => {
    expect(step(MAX_SCROLL, 1)).toBeNull();
    expect(step(0, -1)).toBeNull();
    expect(stepColumnScrollLeft([], 0, VIEWPORT, VIEWPORT, 1)).toBeNull();
  });

  it("ne fait rien quand tout le board tient déjà dans la vue", () => {
    const courtes: ColumnSpan[] = [
      { start: 0, size: 200 },
      { start: 220, size: 200 },
    ];
    expect(stepColumnScrollLeft(courtes, 0, 900, 420, 1)).toBeNull();
  });
});

describe("edgeDirection", () => {
  // Board occupant tout l'écran : bords à 0 et 390, bandes de 56px.
  const dir = (x: number) => edgeDirection(x, 0, 390, 56);

  it("désigne le bord approché", () => {
    expect(dir(10)).toBe(-1);
    expect(dir(380)).toBe(1);
  });

  it("ne déclenche rien au centre", () => {
    expect(dir(195)).toBe(0);
    expect(dir(56)).toBe(0);
    expect(dir(390 - 56)).toBe(0);
  });

  it("reste actif quand le doigt sort du board", () => {
    // Le doigt peut dépasser le bord de l'écran pendant le drag.
    expect(dir(-20)).toBe(-1);
    expect(dir(420)).toBe(1);
  });

  it("privilégie le bord gauche sur un board plus étroit que deux bandes", () => {
    expect(edgeDirection(40, 0, 80, 56)).toBe(-1);
  });
});
