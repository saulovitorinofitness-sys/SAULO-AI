import { z } from "zod";

import {
  CALORIE_ADJUSTMENT_PERCENTAGES,
  NUTRITION_OBJECTIVES,
} from "./decision-engine";
import type { NutritionStrategyDraft } from "./strategy-record";
import { ENERGY_PROTOCOLS } from "@/lib/nutrition";

const positiveNumber = z.number().finite().positive();
const requiredText = z.string().trim().min(1).max(500);
const macroInput = z.object({
  mode: z.enum(["GRAMS_PER_KG", "PERCENTAGE", "GRAMS"]),
  value: positiveNumber.optional(),
});
const calculatedMacro = z.object({
  gramsPerKg: positiveNumber.optional(),
  grams: positiveNumber,
  kcal: positiveNumber,
  percentage: positiveNumber,
});
const calorieAdjustment = z.union(
  CALORIE_ADJUSTMENT_PERCENTAGES.map((value) => z.literal(value)),
);

export const nutritionStrategyDraftSchema = z.object({
  objective: z.enum(Object.keys(NUTRITION_OBJECTIVES) as [
    keyof typeof NUTRITION_OBJECTIVES,
    ...(keyof typeof NUTRITION_OBJECTIVES)[],
  ]).optional(),
  secondaryObjectives: z.array(requiredText).max(10),
  method: z.enum(["STANDARD", "LOW_CARB", "CARB_CYCLING"]).optional(),
  protocol: z.enum(Object.keys(ENERGY_PROTOCOLS) as [
    keyof typeof ENERGY_PROTOCOLS,
    ...(keyof typeof ENERGY_PROTOCOLS)[],
  ]),
  calorieAdjustmentPercentage: calorieAdjustment,
  manualFinalCaloriesKcal: positiveNumber.optional(),
  finalCaloriesKcal: positiveNumber.optional(),
  basalMetabolicRateKcal: positiveNumber.optional(),
  totalEnergyExpenditureKcal: positiveNumber.optional(),
  protein: macroInput,
  carbohydrates: macroInput,
  fats: macroInput,
  calculatedMacros: z.object({
    protein: calculatedMacro.optional(),
    carbohydrates: calculatedMacro.optional(),
    fats: calculatedMacro.optional(),
  }),
  macroValidation: z.object({
    plannedCalories: positiveNumber,
    calculatedCalories: positiveNumber,
    differenceKcal: z.number().finite(),
    differencePercent: z.number().finite(),
    percentageTotal: z.number().finite().nonnegative(),
    status: z.enum(["ADEQUATE", "NEAR_TARGET", "OUTSIDE_TARGET"]),
  }).optional(),
  fiberGrams: positiveNumber.optional(),
  waterMl: positiveNumber.optional(),
  mealCount: z.number().int().positive().optional(),
  mealDistribution: z.array(
    z.object({
      mealNumber: z.number().int().positive(),
      energyPercentage: z.number().finite().nonnegative(),
      proteinPercentage: z.number().finite().nonnegative(),
      carbohydratesPercentage: z.number().finite().nonnegative(),
      fatsPercentage: z.number().finite().nonnegative(),
    }),
  ).max(20),
  supplementation: z.array(
    z.object({
      id: requiredText,
      name: requiredText,
      objective: z.string().trim().max(500),
      schedule: z.string().trim().max(500),
      observations: z.string().trim().max(2000),
    }),
  ).max(50),
  clinicalObservations: z.string().trim().max(10_000),
  evaluationEntryId: z.string().uuid().optional(),
});

export function parseNutritionStrategyDraft(
  value: unknown,
): NutritionStrategyDraft | null {
  const result = nutritionStrategyDraftSchema.safeParse(value);
  return result.success ? (result.data as NutritionStrategyDraft) : null;
}
