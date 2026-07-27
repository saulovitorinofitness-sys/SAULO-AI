import type { NutritionDecisionObjective } from "./decision-engine";
import {
  canApproveNutritionStrategy,
  type NutritionStrategyMealAllocation,
  type NutritionStrategyRecordView,
  type NutritionStrategySupplement,
} from "./strategy-record";
import type { NutritionMethod } from "./contracts";
import type { EnergyProtocol } from "@/lib/nutrition";

/**
 * Contrato canônico entregue ao Plano Alimentar.
 *
 * Os valores não são persistidos novamente: permanecem vinculados à entrada
 * aprovada da Estratégia Nutricional no mesmo Prontuário Mestre.
 */
export interface MealPlanStrategyInheritance {
  readonly sourceStrategyId: string;
  readonly patientId: string;
  readonly masterRecordId: string;
  readonly attendanceId: string;
  readonly evaluationEntryId?: string;
  readonly objective: NutritionDecisionObjective;
  readonly secondaryObjectives: readonly string[];
  readonly method: NutritionMethod;
  readonly protocol: EnergyProtocol;
  readonly totalEnergyExpenditureKcal: number;
  readonly caloriesKcal: number;
  readonly proteinGrams: number;
  readonly proteinPercentage: number;
  readonly carbohydratesGrams: number;
  readonly carbohydratesPercentage: number;
  readonly fatsGrams: number;
  readonly fatsPercentage: number;
  readonly fiberGrams: number;
  readonly waterMl: number;
  readonly mealCount: number;
  readonly mealDistribution: readonly NutritionStrategyMealAllocation[];
  readonly supplementation: readonly NutritionStrategySupplement[];
  readonly clinicalObservations: string;
  readonly calorieAdjustmentPercentage: number;
  readonly status: "APPROVED";
  readonly approvedAt: string;
  readonly approvedByUserId: string;
}

export function toMealPlanStrategyInheritance(
  record: NutritionStrategyRecordView,
): MealPlanStrategyInheritance | null {
  if (
    record.status !== "APPROVED" ||
    !record.objective ||
    !record.method ||
    !record.approvedAt ||
    !record.approvedByUserId ||
    !record.finalCaloriesKcal ||
    !record.calculatedMacros.protein ||
    !record.calculatedMacros.carbohydrates ||
    !record.calculatedMacros.fats ||
    !record.totalEnergyExpenditureKcal ||
    !record.fiberGrams ||
    !record.waterMl ||
    !record.mealCount ||
    !canApproveNutritionStrategy(record)
  ) {
    return null;
  }

  return {
    sourceStrategyId: record.id,
    patientId: record.patientId,
    masterRecordId: record.masterRecordId,
    attendanceId: record.attendanceId,
    evaluationEntryId: record.evaluationEntryId,
    objective: record.objective,
    secondaryObjectives: record.secondaryObjectives,
    method: record.method,
    protocol: record.protocol,
    totalEnergyExpenditureKcal:
      record.totalEnergyExpenditureKcal,
    caloriesKcal: record.finalCaloriesKcal,
    proteinGrams: record.calculatedMacros.protein.grams,
    proteinPercentage: record.calculatedMacros.protein.percentage,
    carbohydratesGrams: record.calculatedMacros.carbohydrates.grams,
    carbohydratesPercentage:
      record.calculatedMacros.carbohydrates.percentage,
    fatsGrams: record.calculatedMacros.fats.grams,
    fatsPercentage: record.calculatedMacros.fats.percentage,
    fiberGrams: record.fiberGrams,
    waterMl: record.waterMl,
    mealCount: record.mealCount,
    mealDistribution: record.mealDistribution,
    supplementation: record.supplementation,
    clinicalObservations: record.clinicalObservations,
    calorieAdjustmentPercentage: record.calorieAdjustmentPercentage,
    status: "APPROVED",
    approvedAt: record.approvedAt,
    approvedByUserId: record.approvedByUserId,
  };
}
