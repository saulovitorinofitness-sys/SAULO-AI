import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCarbohydratesByDifference,
  calculateMacronutrient,
  validateMacroDistribution,
} from "@/lib/nutrition";

import {
  canApproveNutritionStrategy,
  nutritionStrategyApprovalIssues,
} from "./strategy-record";
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
    method: "STANDARD" as const,
    protocol: "MIFFLIN_ST_JEOR" as const,
    calorieAdjustmentPercentage: 0 as const,
    manualFinalCaloriesKcal: finalCaloriesKcal,
    finalCaloriesKcal,
    basalMetabolicRateKcal: 1340.25,
    totalEnergyExpenditureKcal: 2200,
    protein: { mode: "GRAMS_PER_KG" as const, value: 1.6 },
    carbohydrates: {
      mode: "PERCENTAGE" as const,
      value: carbohydrates.percentage,
    },
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
      name: `Refeição ${index + 1}`,
      time: `${String(7 + index * 3).padStart(2, "0")}:00`,
      vetPercentage: 20,
      plannedCaloriesKcal: 400,
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
  assert.equal(
    parseNutritionStrategyDraft({
      ...strategy,
      protein: {
        mode: "GRAMS",
        value: strategy.calculatedMacros.protein.grams,
      },
    }),
    null,
  );
});

test("GET ausente bloqueia aprovação mesmo com VET manual", () => {
  const strategy = completeStrategy();
  const incomplete = {
    ...strategy,
    totalEnergyExpenditureKcal: undefined,
  };
  assert.equal(
    canApproveNutritionStrategy(incomplete),
    false,
  );
  assert.deepEqual(nutritionStrategyApprovalIssues(incomplete), [
    "GET calculado",
  ]);
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

test("valida a distribuição do VET por refeição", () => {
  const strategy = completeStrategy();
  assert.equal(canApproveNutritionStrategy(strategy), true);
  assert.equal(
    canApproveNutritionStrategy({
      ...strategy,
      mealDistribution: strategy.mealDistribution.map((meal, index) => ({
        ...meal,
        vetPercentage:
          index === 0 ? meal.vetPercentage - 1 : meal.vetPercentage,
        plannedCaloriesKcal:
          index === 0
            ? meal.plannedCaloriesKcal - 20
            : meal.plannedCaloriesKcal,
      })),
    }),
    false,
  );
  assert.deepEqual(
    nutritionStrategyApprovalIssues({
      ...strategy,
      mealDistribution: strategy.mealDistribution.map((meal, index) => ({
        ...meal,
        vetPercentage:
          index === 0 ? meal.vetPercentage - 5 : meal.vetPercentage,
      })),
    }),
    [
      "Distribuição das refeições: total atual 95%; necessário 100%",
    ],
  );
});
