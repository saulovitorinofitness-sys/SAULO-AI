import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateNutritionAdequacy,
  canFinalizeMealPlanNutrition,
  nutritionTargetsOutsideTolerance,
} from "./adequacy-engine";

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

test("rejeita conclusão ou aprovação quando carboidratos excedem a tolerância final", () => {
  const finalTarget = {
    energyKcal: 1_836,
    proteinGrams: 114.7,
    carbohydratesGrams: 206.5,
    fatsGrams: 61.2,
  };
  const generated = {
    energyKcal: 1_888.8,
    proteinGrams: 112.1,
    carbohydratesGrams: 234.6,
    fatsGrams: 55.7,
  };

  assert.equal(
    canFinalizeMealPlanNutrition({ target: finalTarget, actual: generated }),
    false,
  );
  assert.deepEqual(
    nutritionTargetsOutsideTolerance({ target: finalTarget, actual: generated }),
    ["carbohydratesGrams", "fatsGrams"],
  );
});

test("permite conclusão somente quando energia e os três macronutrientes estão em ±5%", () => {
  const finalTarget = {
    energyKcal: 1_836,
    proteinGrams: 114.7,
    carbohydratesGrams: 206.5,
    fatsGrams: 61.2,
  };

  assert.equal(
    canFinalizeMealPlanNutrition({
      target: finalTarget,
      actual: {
        energyKcal: 1_820,
        proteinGrams: 113,
        carbohydratesGrams: 210,
        fatsGrams: 60,
      },
    }),
    true,
  );
});

test("fibra igual ou acima da meta mínima é classificada como adequada", () => {
  const result = calculateNutritionAdequacy({
    target: { ...target, fiberGrams: 25 },
    actual: { ...target, fiberGrams: 27.5 },
  });

  assert.equal(result.metrics.fiberGrams.status, "ADEQUATE");
  assert.equal(result.metrics.fiberGrams.adherencePercent, 100);
  assert.equal(result.needsAdjustment.includes("fiberGrams"), false);
});
