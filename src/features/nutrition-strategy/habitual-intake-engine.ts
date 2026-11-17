import type {
  FoodNutrientsPer100g,
  ProfessionalFood,
} from "@/features/food-database";

import type { NutritionDecisionObjective } from "./decision-engine";

export type HabitualIntakeConfidence = "NOT_ESTIMATED" | "LOW" | "HIGH";
export type EvolutionGoalDirection = "LOSS" | "GAIN" | "MAINTENANCE";
export type VetDecisionState = "SUGGESTED" | "EDITED" | "APPROVED";

export interface QuantifiedRecallItem {
  readonly id: string;
  readonly foodId: string;
  readonly foodName: string;
  readonly mealName: string;
  readonly amount?: number;
  readonly unit: "g" | "ml";
}

export interface HabitualIntakeTotals {
  readonly energyKcal?: number;
  readonly proteinGrams?: number;
  readonly carbohydratesGrams?: number;
  readonly fatsGrams?: number;
  readonly fiberGrams?: number;
  readonly micronutrients: Readonly<Partial<Record<keyof FoodNutrientsPer100g, number>>>;
}

export interface HabitualIntakeEstimate {
  readonly totals: HabitualIntakeTotals;
  readonly confidence: HabitualIntakeConfidence;
  readonly quantifiedItemCount: number;
  readonly totalItemCount: number;
  readonly warnings: readonly string[];
}

export interface NutritionEvolutionGoal {
  readonly direction: EvolutionGoalDirection;
  readonly targetKg?: number;
  readonly periodDays?: number;
}

export interface PatternEnergySuggestion {
  readonly habitualEnergyKcal: number;
  readonly totalEnergyExpenditureKcal: number;
  readonly differenceFromGetKcal: number;
  readonly adjustmentType: "DEFICIT" | "SURPLUS" | "MAINTENANCE";
  readonly suggestedAdjustmentKcal: number;
  readonly suggestedVetKcal?: number;
  readonly targetVetFromGoalKcal?: number;
  readonly incompatible: boolean;
  readonly rationale: string;
  readonly warnings: readonly string[];
}

export interface HabitualGetComparison {
  readonly habitualEnergyKcal: number;
  readonly totalEnergyExpenditureKcal: number;
  readonly differenceKcal: number;
  readonly incompatible: boolean;
  readonly warning?: string;
}

const CORE_KEYS = [
  "energyKcal",
  "proteinGrams",
  "carbohydratesGrams",
  "fatsGrams",
  "fiberGrams",
] as const satisfies readonly (keyof FoodNutrientsPer100g)[];

const MICRONUTRIENT_KEYS = [
  "sodiumMg",
  "calciumMg",
  "ironMg",
  "magnesiumMg",
  "phosphorusMg",
  "potassiumMg",
  "zincMg",
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

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

function positive(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function supportsUnit(food: ProfessionalFood, unit: "g" | "ml") {
  return unit === "g" || food.referenceServingUnit === "ml";
}

export function quantifyHabitualIntake(
  items: readonly QuantifiedRecallItem[],
  foods: readonly ProfessionalFood[],
): HabitualIntakeEstimate {
  const foodsById = new Map(foods.map((food) => [food.id, food]));
  const totals: Partial<Record<(typeof CORE_KEYS)[number], number>> = {};
  const micronutrients: Partial<Record<keyof FoodNutrientsPer100g, number>> = {};
  let quantifiedItemCount = 0;
  let missingAmountCount = 0;
  let unavailableFoodCount = 0;

  for (const item of items) {
    const food = foodsById.get(item.foodId);
    if (!food?.nutrients || !supportsUnit(food, item.unit)) {
      unavailableFoodCount += 1;
      continue;
    }
    if (!positive(item.amount)) {
      missingAmountCount += 1;
      continue;
    }
    quantifiedItemCount += 1;
    const factor = item.amount / 100;
    for (const key of CORE_KEYS) {
      const value = food.nutrients[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        totals[key] = rounded((totals[key] ?? 0) + value * factor);
      }
    }
    for (const key of MICRONUTRIENT_KEYS) {
      const value = food.nutrients[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        micronutrients[key] = rounded((micronutrients[key] ?? 0) + value * factor);
      }
    }
  }

  const confidence: HabitualIntakeConfidence = items.length === 0
    ? "NOT_ESTIMATED"
    : quantifiedItemCount >= 3 && quantifiedItemCount === items.length
      ? "HIGH"
      : "LOW";
  const warnings = [
    missingAmountCount
      ? `${missingAmountCount} alimento(s) sem quantidade n\u00e3o foram estimados.`
      : undefined,
    unavailableFoodCount
      ? `${unavailableFoodCount} alimento(s) n\u00e3o possuem composi\u00e7\u00e3o ou unidade compat\u00edvel no Banco Mestre.`
      : undefined,
    confidence === "LOW"
      ? "Estimativa com baixa confian\u00e7a: revise as quantidades do recordat\u00f3rio."
      : undefined,
  ].filter((value): value is string => Boolean(value));

  return {
    totals: {
      energyKcal: totals.energyKcal,
      proteinGrams: totals.proteinGrams,
      carbohydratesGrams: totals.carbohydratesGrams,
      fatsGrams: totals.fatsGrams,
      fiberGrams: totals.fiberGrams,
      micronutrients,
    },
    confidence,
    quantifiedItemCount,
    totalItemCount: items.length,
    warnings,
  };
}

function objectiveDirection(objective: NutritionDecisionObjective | undefined) {
  if (objective === "WEIGHT_LOSS") return "LOSS" as const;
  if (objective === "HYPERTROPHY" || objective === "WEIGHT_GAIN") return "GAIN" as const;
  if (objective === "MAINTENANCE") return "MAINTENANCE" as const;
  return undefined;
}

export function compareHabitualIntakeWithGet(
  estimate: HabitualIntakeEstimate | undefined,
  totalEnergyExpenditureKcal: number | undefined,
): HabitualGetComparison | undefined {
  const habitualEnergyKcal = estimate?.totals.energyKcal;
  if (!positive(habitualEnergyKcal) || !positive(totalEnergyExpenditureKcal)) return undefined;
  const differenceKcal = rounded(habitualEnergyKcal - totalEnergyExpenditureKcal);
  const incompatible = Math.abs(differenceKcal) / totalEnergyExpenditureKcal >= 0.3;
  return {
    habitualEnergyKcal,
    totalEnergyExpenditureKcal,
    differenceKcal,
    incompatible,
    warning: incompatible
      ? "A ingest\u00e3o habitual estimada \u00e9 incompat\u00edvel com os demais dados dispon\u00edveis. Recomenda-se revisar o recordat\u00f3rio alimentar antes de definir a estrat\u00e9gia."
      : undefined,
  };
}

export function suggestPatternEnergyStrategy(input: {
  readonly estimate: HabitualIntakeEstimate | undefined;
  readonly totalEnergyExpenditureKcal: number | undefined;
  readonly objective: NutritionDecisionObjective | undefined;
  readonly goal: NutritionEvolutionGoal | undefined;
}): PatternEnergySuggestion | undefined {
  const comparison = compareHabitualIntakeWithGet(
    input.estimate,
    input.totalEnergyExpenditureKcal,
  );
  if (!comparison || !input.goal) return undefined;
  const habitualEnergyKcal = comparison.habitualEnergyKcal;
  const get = comparison.totalEnergyExpenditureKcal;
  const differenceFromGetKcal = comparison.differenceKcal;
  const incompatible = comparison.incompatible;
  const warnings = [
    input.estimate?.confidence !== "HIGH"
      ? "A sugest\u00e3o depende de um recordat\u00f3rio com baixa confian\u00e7a."
      : undefined,
    comparison.warning,
    objectiveDirection(input.objective) && objectiveDirection(input.objective) !== input.goal.direction
      ? "A meta de evolu\u00e7\u00e3o informada difere da dire\u00e7\u00e3o esperada para o objetivo cl\u00ednico."
      : undefined,
  ].filter((value): value is string => Boolean(value));

  const adjustmentType = input.goal.direction === "LOSS"
    ? "DEFICIT"
    : input.goal.direction === "GAIN"
      ? "SURPLUS"
      : "MAINTENANCE";
  if (
    incompatible ||
    input.estimate?.confidence !== "HIGH" ||
    (input.goal.direction !== "MAINTENANCE" &&
      (!positive(input.goal.targetKg) || !positive(input.goal.periodDays)))
  ) {
    return {
      habitualEnergyKcal,
      totalEnergyExpenditureKcal: get,
      differenceFromGetKcal,
      adjustmentType,
      suggestedAdjustmentKcal: 0,
      incompatible,
      rationale: "Dados insuficientes ou incompat\u00edveis para sugerir o VET com seguran\u00e7a.",
      warnings,
    };
  }

  const goalDelta = input.goal.direction === "MAINTENANCE"
    ? 0
    : (input.goal.targetKg! * 7_700 / input.goal.periodDays!) *
      (input.goal.direction === "LOSS" ? -1 : 1);
  const targetVetFromGoalKcal = get + goalDelta;
  const maximumProgressiveStep = Math.min(
    500,
    Math.max(100, habitualEnergyKcal * 0.1),
  );
  const progressiveDifference = Math.max(
    -maximumProgressiveStep,
    Math.min(maximumProgressiveStep, targetVetFromGoalKcal - habitualEnergyKcal),
  );
  const suggestedVetKcal = Math.round((habitualEnergyKcal + progressiveDifference) / 25) * 25;
  const suggestedAdjustmentKcal = rounded(suggestedVetKcal - get);
  return {
    habitualEnergyKcal,
    totalEnergyExpenditureKcal: get,
    differenceFromGetKcal,
    adjustmentType,
    suggestedAdjustmentKcal,
    suggestedVetKcal,
    targetVetFromGoalKcal: rounded(targetVetFromGoalKcal),
    incompatible: false,
    rationale:
      "Sugest\u00e3o progressiva calculada a partir da ingest\u00e3o quantificada, do GET e da meta definida pelo nutricionista. Requer aceita\u00e7\u00e3o ou ajuste profissional.",
    warnings,
  };
}
