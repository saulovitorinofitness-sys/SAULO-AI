import type {
  MealPlanFoodNutrients,
  MealPlanNutritionValues,
  MealPlanRecordMeal,
} from "./record";
import {
  DEFAULT_NUTRITION_ADEQUACY_THRESHOLDS,
  type NutritionAdequacyStatus,
} from "./adequacy-engine";
import type { FoodNutrientsPer100g } from "@/features/food-database";

export const EMPTY_NUTRITION_VALUES: MealPlanNutritionValues = {
  energyKcal: 0,
  proteinGrams: 0,
  carbohydratesGrams: 0,
  fatsGrams: 0,
  fiberGrams: 0,
};

const nutritionKeys = Object.keys(
  EMPTY_NUTRITION_VALUES,
) as (keyof MealPlanNutritionValues)[];

function round(value: number) {
  return Math.round(value * 100) / 100;
}

const micronutrientKeys = [
  "sugarsGrams",
  "cholesterolMg",
  "saturatedFatsGrams",
  "monounsaturatedFatsGrams",
  "polyunsaturatedFatsGrams",
  "sodiumMg",
  "calciumMg",
  "ironMg",
  "magnesiumMg",
  "phosphorusMg",
  "potassiumMg",
  "zincMg",
  "copperMg",
  "manganeseMg",
  "seleniumMcg",
  "vitaminAMcg",
  "vitaminCMg",
  "vitaminDMcg",
  "vitaminEMg",
  "vitaminKMcg",
  "thiamineMg",
  "riboflavinMg",
  "niacinMg",
  "vitaminB6Mg",
  "folateMcg",
  "vitaminB12Mcg",
] as const satisfies readonly (keyof FoodNutrientsPer100g)[];

export const EMPTY_FOOD_NUTRIENTS = {
  ...EMPTY_NUTRITION_VALUES,
  ...Object.fromEntries(micronutrientKeys.map((key) => [key, null])),
} as MealPlanFoodNutrients;

export function normalizeFoodNutrients(
  nutrients: FoodNutrientsPer100g,
): MealPlanFoodNutrients {
  return {
    energyKcal: nutrients.energyKcal ?? 0,
    proteinGrams: nutrients.proteinGrams ?? 0,
    carbohydratesGrams: nutrients.carbohydratesGrams ?? 0,
    fatsGrams: nutrients.fatsGrams ?? 0,
    fiberGrams: nutrients.fiberGrams ?? 0,
    ...Object.fromEntries(
      micronutrientKeys.map((key) => [key, nutrients[key]]),
    ),
  } as MealPlanFoodNutrients;
}

export function calculateFoodNutrientsForGrams(
  per100g: MealPlanFoodNutrients,
  grams: number,
): MealPlanFoodNutrients {
  const factor = Math.max(0, grams) / 100;
  return Object.fromEntries(
    Object.entries(per100g).map(([key, value]) => [
      key,
      value === null ? null : round(value * factor),
    ]),
  ) as unknown as MealPlanFoodNutrients;
}

export function nutritionForGrams(
  per100g: MealPlanNutritionValues,
  grams: number,
): MealPlanNutritionValues {
  return Object.fromEntries(
    nutritionKeys.map((key) => [key, round((per100g[key] * grams) / 100)]),
  ) as unknown as MealPlanNutritionValues;
}

export function calculateMealPlanTotals(
  meals: readonly MealPlanRecordMeal[],
): MealPlanNutritionValues {
  const totals = { ...EMPTY_NUTRITION_VALUES };
  for (const meal of meals) {
    for (const food of meal.items) {
      for (const key of nutritionKeys) totals[key] += food.nutrients[key];
    }
  }
  for (const key of nutritionKeys) totals[key] = round(totals[key]);
  return totals;
}

export function compareMealPlanNutrition(
  target: MealPlanNutritionValues,
  actual: MealPlanNutritionValues,
) {
  return Object.fromEntries(
    nutritionKeys.map((key) => {
      const tolerance = Math.max(target[key] * 0.02, 0.1);
      const difference = actual[key] - target[key];
      return [
        key,
        Math.abs(difference) <= tolerance
          ? "COMPATIBLE"
          : difference > 0
            ? "ABOVE"
            : "BELOW",
      ];
    }),
  ) as Record<
    keyof MealPlanNutritionValues,
    "COMPATIBLE" | "ABOVE" | "BELOW"
  >;
}

export function compareMealEnergyTarget(
  targetKcal: number,
  actualKcal: number,
): NutritionAdequacyStatus {
  if (targetKcal <= 0) return "OUTSIDE_TARGET";
  const deviationPercentage =
    (Math.abs(actualKcal - targetKcal) / targetKcal) * 100;
  const threshold = DEFAULT_NUTRITION_ADEQUACY_THRESHOLDS.energyKcal;
  if (deviationPercentage <= threshold.adequateMaximumDeviationPercent) {
    return "ADEQUATE";
  }
  if (deviationPercentage <= threshold.nearTargetMaximumDeviationPercent) {
    return "NEAR_TARGET";
  }
  return "OUTSIDE_TARGET";
}
