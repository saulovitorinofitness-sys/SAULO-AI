import type {
  CalorieAdjustmentPercentage,
  NutritionDecisionObjective,
} from "./decision-engine";
import type {
  MacroAdequacyStatus,
  MacronutrientCalculation,
  MacronutrientInputMode,
  EnergyProtocol,
} from "@/lib/nutrition";
import type { NutritionMethod } from "./contracts";

export type NutritionStrategyRecordStatus = "DRAFT" | "APPROVED";

export interface MacronutrientDraftInput {
  readonly mode: MacronutrientInputMode;
  readonly value?: number;
}

export interface NutritionStrategyMealAllocation {
  readonly mealNumber: number;
  readonly energyPercentage: number;
  readonly proteinPercentage: number;
  readonly carbohydratesPercentage: number;
  readonly fatsPercentage: number;
}

export interface NutritionStrategySupplement {
  readonly id: string;
  readonly name: string;
  readonly objective: string;
  readonly schedule: string;
  readonly observations: string;
}

export interface NutritionStrategyDraft {
  readonly objective?: NutritionDecisionObjective;
  readonly secondaryObjectives: readonly string[];
  readonly method?: NutritionMethod;
  readonly protocol: EnergyProtocol;
  readonly calorieAdjustmentPercentage: CalorieAdjustmentPercentage;
  readonly manualFinalCaloriesKcal?: number;
  readonly finalCaloriesKcal?: number;
  readonly basalMetabolicRateKcal?: number;
  readonly totalEnergyExpenditureKcal?: number;
  readonly protein: MacronutrientDraftInput;
  readonly carbohydrates: MacronutrientDraftInput;
  readonly fats: MacronutrientDraftInput;
  readonly calculatedMacros: {
    readonly protein?: MacronutrientCalculation;
    readonly carbohydrates?: MacronutrientCalculation;
    readonly fats?: MacronutrientCalculation;
  };
  readonly macroValidation?: {
    readonly plannedCalories: number;
    readonly calculatedCalories: number;
    readonly differenceKcal: number;
    readonly differencePercent: number;
    readonly percentageTotal: number;
    readonly status: MacroAdequacyStatus;
  };
  readonly fiberGrams?: number;
  readonly waterMl?: number;
  readonly mealCount?: number;
  readonly mealDistribution: readonly NutritionStrategyMealAllocation[];
  readonly supplementation: readonly NutritionStrategySupplement[];
  readonly clinicalObservations: string;
  readonly evaluationEntryId?: string;
}

export interface NutritionStrategyRecordView extends NutritionStrategyDraft {
  readonly id: string;
  readonly patientId: string;
  readonly masterRecordId: string;
  readonly attendanceId: string;
  readonly status: NutritionStrategyRecordStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly responsibleUserId: string;
  readonly responsibleName: string;
  readonly approvedAt?: string;
  readonly approvedByUserId?: string;
  readonly approvedByName?: string;
  readonly version: number;
}

function positive(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function validDistribution(
  distribution: readonly NutritionStrategyMealAllocation[],
  mealCount: number,
) {
  if (distribution.length !== mealCount) return false;
  const keys = [
    "energyPercentage",
    "proteinPercentage",
    "carbohydratesPercentage",
    "fatsPercentage",
  ] as const;

  return keys.every((key) => {
    const total = distribution.reduce(
      (sum, meal) => sum + meal[key],
      0,
    );
    return (
      distribution.every(
        (meal) =>
          Number.isFinite(meal[key]) && meal[key] >= 0,
      ) && Math.abs(total - 100) < 0.1
    );
  });
}

export function canApproveNutritionStrategy(
  strategy: NutritionStrategyDraft,
) {
  return Boolean(
    strategy.objective &&
      strategy.protocol &&
      strategy.method &&
      positive(strategy.totalEnergyExpenditureKcal) &&
      positive(strategy.finalCaloriesKcal) &&
      positive(strategy.calculatedMacros.protein?.grams) &&
      positive(strategy.calculatedMacros.carbohydrates?.grams) &&
      positive(strategy.calculatedMacros.fats?.grams) &&
      strategy.mealCount !== undefined &&
      Number.isInteger(strategy.mealCount) &&
      strategy.mealCount > 0 &&
      validDistribution(
        strategy.mealDistribution,
        strategy.mealCount,
      ) &&
      positive(strategy.fiberGrams) &&
      positive(strategy.waterMl),
  );
}
