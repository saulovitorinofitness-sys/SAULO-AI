import assert from "node:assert/strict";
import test from "node:test";

import {
  nutritionStrategyDecisionService,
  resolveNutritionObjective,
} from "./decision-engine";

const patientEnergy = {
  sex: "FEMALE",
  ageYears: 37,
  weightKg: 68,
  heightCm: 161,
  leanMassKg: 47,
  activityFactor: 1.55,
} as const;

test("carrega objetivo existente por chave ou descrição", () => {
  assert.equal(resolveNutritionObjective("WEIGHT_LOSS"), "WEIGHT_LOSS");
  assert.equal(resolveNutritionObjective("Emagrecimento"), "WEIGHT_LOSS");
  assert.equal(resolveNutritionObjective("Manutenção"), "MAINTENANCE");
  assert.equal(resolveNutritionObjective("Saúde"), "HEALTH");
});

test("respeita Mifflin-St Jeor como protocolo padrão do sistema", () => {
  const result = nutritionStrategyDecisionService.calculate({
    energy: patientEnergy,
    objective: "MAINTENANCE",
    calorieAdjustmentPercentage: 0,
  });

  assert.equal(result.protocol, "MIFFLIN_ST_JEOR");
  assert.equal(result.basalMetabolicRateKcal, 1340.25);
  assert.ok(result.totalEnergyExpenditureKcal);
  assert.ok(
    Math.abs(result.totalEnergyExpenditureKcal - 2077.3875) < 0.00001,
  );
  assert.equal(result.finalCaloriesKcal, result.totalEnergyExpenditureKcal);
});

test("recalcula calorias ao alterar déficit ou superávit", () => {
  const deficit = nutritionStrategyDecisionService.calculate({
    energy: patientEnergy,
    objective: "WEIGHT_LOSS",
    calorieAdjustmentPercentage: -20,
  });
  const surplus = nutritionStrategyDecisionService.calculate({
    energy: patientEnergy,
    objective: "HYPERTROPHY",
    calorieAdjustmentPercentage: 10,
  });

  assert.ok(deficit.finalCaloriesKcal);
  assert.ok(surplus.finalCaloriesKcal);
  assert.ok(Math.abs(deficit.finalCaloriesKcal - 1661.91) < 0.00001);
  assert.ok(Math.abs(surplus.finalCaloriesKcal - 2285.12625) < 0.00001);
});

test("não sugere calorias sem objetivo ou GET", () => {
  const withoutObjective = nutritionStrategyDecisionService.calculate({
    energy: patientEnergy,
    calorieAdjustmentPercentage: 0,
  });
  const withoutGet = nutritionStrategyDecisionService.calculate({
    energy: { ...patientEnergy, activityFactor: undefined },
    objective: "MAINTENANCE",
    calorieAdjustmentPercentage: 0,
  });

  assert.equal(withoutObjective.finalCaloriesKcal, undefined);
  assert.equal(withoutGet.totalEnergyExpenditureKcal, undefined);
  assert.equal(withoutGet.finalCaloriesKcal, undefined);
});

test("disponibiliza somente protocolos compatíveis com os dados", () => {
  assert.deepEqual(
    nutritionStrategyDecisionService.availableProtocols(patientEnergy),
    ["HARRIS_BENEDICT", "MIFFLIN_ST_JEOR", "FAO_WHO", "CUNNINGHAM"],
  );
  assert.deepEqual(
    nutritionStrategyDecisionService.availableProtocols({
      ...patientEnergy,
      leanMassKg: undefined,
    }),
    ["HARRIS_BENEDICT", "MIFFLIN_ST_JEOR", "FAO_WHO"],
  );
});
