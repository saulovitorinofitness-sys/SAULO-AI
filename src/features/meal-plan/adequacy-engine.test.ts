import assert from "node:assert/strict";
import test from "node:test";

import { calculateNutritionAdequacy } from "./adequacy-engine";

const target = {
  energyKcal: 2_000,
  proteinGrams: 150,
  carbohydratesGrams: 220,
  fatsGrams: 65,
  fiberGrams: 30,
  waterMl: 2_500,
};

test("classifica adequado, próximo e fora da meta pelos limites padrão", () => {
  const result = calculateNutritionAdequacy({
    target,
    actual: {
      energyKcal: 1_920,
      proteinGrams: 138,
      carbohydratesGrams: 176,
      fatsGrams: 65,
      fiberGrams: 30,
      waterMl: 2_500,
    },
    updatedAt: "2026-07-27T12:00:00.000Z",
  });

  assert.equal(result.metrics.energyKcal.status, "ADEQUATE");
  assert.equal(result.metrics.proteinGrams.status, "NEAR_TARGET");
  assert.equal(result.metrics.carbohydratesGrams.status, "OUTSIDE_TARGET");
  assert.equal(result.metrics.proteinGrams.absoluteDifference, 12);
  assert.equal(result.metrics.proteinGrams.percentageDifference, -8);
});

test("calcula aderência geral e lista somente métricas que exigem ajuste", () => {
  const result = calculateNutritionAdequacy({
    target,
    actual: { ...target, fiberGrams: 27 },
  });

  assert.equal(result.overallAdherencePercent, 98.3);
  assert.deepEqual(result.needsAdjustment, ["fiberGrams"]);
  assert.equal(result.metrics.waterMl.status, "ADEQUATE");
});

test("aceita limites parametrizados por nutriente", () => {
  const base = calculateNutritionAdequacy({ target, actual: target });
  const result = calculateNutritionAdequacy({
    target,
    actual: { ...target, proteinGrams: 135 },
    thresholds: {
      ...base.thresholds,
      proteinGrams: {
        adequateMaximumDeviationPercent: 10,
        nearTargetMaximumDeviationPercent: 15,
      },
    },
  });

  assert.equal(result.metrics.proteinGrams.status, "ADEQUATE");
});
