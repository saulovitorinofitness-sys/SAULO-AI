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
  readonly name: string;
  readonly time: string;
  readonly vetPercentage: number;
  readonly plannedCaloriesKcal: number;
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
  readonly secondaryObjectives?: readonly string[];
  readonly method?: NutritionMethod;
  readonly protocol: EnergyProtocol;
  readonly calorieAdjustmentPercentage: CalorieAdjustmentPercentage;
  readonly activityFactor?: number;
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
  finalCaloriesKcal: number,
) {
  if (distribution.length !== mealCount) return false;
  const total = distribution.reduce(
    (sum, meal) => sum + meal.vetPercentage,
    0,
  );
  return (
    Math.abs(total - 100) < 0.01 &&
    distribution.every((meal) => {
      const expectedCalories =
        finalCaloriesKcal * (meal.vetPercentage / 100);
      return (
        Boolean(meal.name.trim()) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(meal.time) &&
        Number.isFinite(meal.vetPercentage) &&
        meal.vetPercentage > 0 &&
        Number.isFinite(meal.plannedCaloriesKcal) &&
        meal.plannedCaloriesKcal > 0 &&
        Math.abs(meal.plannedCaloriesKcal - expectedCalories) < 0.11
      );
    })
  );
}

export function canApproveNutritionStrategy(
  strategy: NutritionStrategyDraft,
) {
  return nutritionStrategyApprovalIssues(strategy).length === 0;
}

export function nutritionStrategyApprovalIssues(
  strategy: NutritionStrategyDraft,
): readonly string[] {
  const issues: string[] = [];
  if (!strategy.objective) issues.push("Objetivo nutricional");
  if (!strategy.protocol) issues.push("Protocolo utilizado");
  if (!strategy.method) issues.push("Método nutricional");
  if (!positive(strategy.activityFactor)) issues.push("Fator de atividade");
  if (!positive(strategy.totalEnergyExpenditureKcal)) {
    issues.push("GET calculado");
  }
  if (!positive(strategy.finalCaloriesKcal)) {
    issues.push("VET (Valor Energético Total)");
  }
  if (!positive(strategy.calculatedMacros.protein?.grams)) {
    issues.push("Proteínas");
  }
  if (!positive(strategy.calculatedMacros.carbohydrates?.grams)) {
    issues.push("Carboidratos");
  }
  if (!positive(strategy.calculatedMacros.fats?.grams)) {
    issues.push("Lipídios");
  }
  if (!positive(strategy.fiberGrams)) issues.push("Meta diária de fibras");
  if (!positive(strategy.waterMl)) issues.push("Meta diária de água");

  const validMealCount =
    strategy.mealCount !== undefined &&
    Number.isInteger(strategy.mealCount) &&
    strategy.mealCount > 0;
  if (!validMealCount) {
    issues.push("Número de refeições");
  } else {
    const total = strategy.mealDistribution.reduce(
      (sum, meal) => sum + meal.vetPercentage,
      0,
    );
    if (strategy.mealDistribution.length !== strategy.mealCount) {
      issues.push("Quantidade de refeições na distribuição");
    } else if (Math.abs(total - 100) >= 0.01) {
      issues.push(
        `Distribuição das refeições: total atual ${new Intl.NumberFormat(
          "pt-BR",
          { maximumFractionDigits: 2 },
        ).format(total)}%; necessário 100%`,
      );
    }
    if (
      strategy.mealDistribution.some(
        (meal) =>
          !meal.name.trim() ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(meal.time),
      )
    ) {
      issues.push("Nome e horário de todas as refeições");
    }
    if (
      positive(strategy.finalCaloriesKcal) &&
      Math.abs(total - 100) < 0.01 &&
      !validDistribution(
        strategy.mealDistribution,
        strategy.mealCount!,
        strategy.finalCaloriesKcal!,
      )
    ) {
      issues.push("Cálculo energético das refeições");
    }
  }

  return issues;
}
