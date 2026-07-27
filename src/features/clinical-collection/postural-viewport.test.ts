import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePosturalFitZoom,
  clampPosturalPan,
  clampPosturalZoom,
  POSTURAL_MAX_ZOOM_PERCENT,
} from "./postural-viewport";

test("calcula ajuste à tela sem ampliar além de 100%", () => {
  assert.ok(
    Math.abs(
      calculatePosturalFitZoom(
        { width: 3000, height: 5000 },
        { width: 420, height: 660 },
      ) - 13.2,
    ) < 0.001,
  );
  assert.equal(
    calculatePosturalFitZoom(
      { width: 200, height: 300 },
      { width: 420, height: 660 },
    ),
    100,
  );
});

test("limita o zoom entre o ajuste à tela e 500%", () => {
  assert.equal(clampPosturalZoom(-10, 15), 15);
  assert.equal(
    clampPosturalZoom(900, 15),
    POSTURAL_MAX_ZOOM_PERCENT,
  );
  assert.equal(clampPosturalZoom(Number.NaN, 15), 15);
});

test("limita o pan para manter parte da fotografia visível", () => {
  assert.deepEqual(
    clampPosturalPan({
      image: { width: 1000, height: 1500 },
      viewport: { width: 420, height: 660 },
      zoomPercent: 100,
      pan: { x: 10000, y: -10000 },
    }),
    { x: 662, y: -1032 },
  );
});
