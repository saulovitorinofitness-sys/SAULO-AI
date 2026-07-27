import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCarbohydratesByDifference,
  calculateMacronutrient,
  validateMacroDistribution,
} from "@/lib/nutrition";

import { canApproveNutritionStrategy } from "./strategy-record";
import { parseNutritionStrategyDraft } from "./strategy-validation";

function completeStrategy() {
  const finalCaloriesKcal = 2000;
  const weightKg = 68;
  const protein = calculateMacronutrient(
    "protein",
    "GRAMS_PER_KG",
    1.6,
    finalCaloriesKcal,
    weightKg,
  )!;
  const fats = calculateMacronutrient(
    "fats",
    "PERCENTAGE",
    30,
    finalCaloriesKcal,
    weightKg,
  )!;
  const carbohydrates = calculateCarbohydratesByDifference(
    finalCaloriesKcal,
    protein.kcal,
    fats.kcal,
    weightKg,
  )!;

  return {
    objective: "MAINTENANCE" as const,
    secondaryObjectives: ["Manter composição corporal"],
    method: "STANDARD" as const,
    protocol: "MIFFLIN_ST_JEOR" as const,
    calorieAdjustmentPercentage: 0 as const,
    manualFinalCaloriesKcal: finalCaloriesKcal,
    finalCaloriesKcal,
    basalMetabolicRateKcal: 1340.25,
    totalEnergyExpenditureKcal: 2200,
    protein: { mode: "GRAMS_PER_KG" as const, value: 1.6 },
    carbohydrates: { mode: "GRAMS" as const },
    fats: { mode: "PERCENTAGE" as const, value: 30 },
    calculatedMacros: { protein, carbohydrates, fats },
    macroValidation: validateMacroDistribution(finalCaloriesKcal, [
      protein,
      carbohydrates,
      fats,
    ]),
    fiberGrams: 30,
    waterMl: 2500,
    mealCount: 5,
    mealDistribution: Array.from({ length: 5 }, (_, index) => ({
      mealNumber: index + 1,
      energyPercentage: 20,
      proteinPercentage: 20,
      carbohydratesPercentage: 20,
      fatsPercentage: 20,
    })),
    supplementation: [],
    clinicalObservations: "",
  };
}

test("valida payload persistível e critérios mínimos de aprovação", () => {
  const strategy = completeStrategy();
  const parsed = parseNutritionStrategyDraft(strategy);

  assert.ok(parsed);
  assert.equal(canApproveNutritionStrategy(parsed), true);
});

test("GET ausente bloqueia aprovação mesmo com calorias finais manuais", () => {
  const strategy = completeStrategy();
  assert.equal(
    canApproveNutritionStrategy({
      ...strategy,
      totalEnergyExpenditureKcal: undefined,
    }),
    false,
  );
});

test("bloqueia aprovação sem refeição ou macronutriente", () => {
  const strategy = completeStrategy();

  assert.equal(
    canApproveNutritionStrategy({ ...strategy, mealCount: undefined }),
    false,
  );
  assert.equal(
    canApproveNutritionStrategy({
      ...strategy,
      calculatedMacros: {
        ...strategy.calculatedMacros,
        carbohydrates: undefined,
      },
    }),
    false,
  );
});
