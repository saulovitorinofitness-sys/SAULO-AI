import {
  NUTRITION_OBJECTIVES,
  type NutritionDecisionObjective,
} from "./decision-engine";
import {
  nutritionStrategyApprovalIssues,
  type NutritionStrategyMealAllocation,
  type NutritionStrategyRecordView,
  type NutritionStrategySupplement,
} from "./strategy-record";
import type { NutritionMethod } from "./contracts";
import {
  SPORTS_OBJECTIVE_OPTIONS,
  type ClinicalNutritionProtocol,
  type NutritionEnergyGoal,
  type NutritionModification,
  type NutritionSpecificConfigurations,
} from "./prescription";
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
  readonly modifications?: readonly NutritionModification[];
  readonly clinicalProtocols?: readonly ClinicalNutritionProtocol[];
  /** @deprecated Compatibilidade com consumidores anteriores. */
  readonly clinicalProtocol?: ClinicalNutritionProtocol;
  readonly specificConfigurations?: NutritionSpecificConfigurations;
  readonly energyGoal?: NutritionEnergyGoal;
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

export interface MealPlanObjectiveResolution {
  readonly code: string;
  readonly label: string;
  readonly source: "CLINICAL_OBJECTIVE" | "SPORTS_PERIODIZATION_OBJECTIVE";
}

/** Resolve o objetivo aprovado sem confundir fase ou modalidade esportiva. */
export function resolveMealPlanObjective(
  strategy: MealPlanStrategyInheritance,
): MealPlanObjectiveResolution {
  const periodization = strategy.specificConfigurations?.sportsPeriodization;
  if (strategy.method === "SPORTS_PERIODIZATION" && periodization?.objective) {
    const code = periodization.objective;
    const configuredLabel = SPORTS_OBJECTIVE_OPTIONS.find(
      ([option]) => option === code,
    )?.[1];
    const label =
      code === "OTHER"
        ? periodization.objectiveOther?.trim()
        : configuredLabel ?? code;

    if (label) {
      return {
        code,
        label,
        source: "SPORTS_PERIODIZATION_OBJECTIVE",
      };
    }
  }

  return {
    code: strategy.objective,
    label: NUTRITION_OBJECTIVES[strategy.objective],
    source: "CLINICAL_OBJECTIVE",
  };
}

export function mealPlanStrategyInheritanceIssues(
  record: NutritionStrategyRecordView,
): readonly string[] {
  const issues = [...nutritionStrategyApprovalIssues(record)];
  if (record.status !== "APPROVED") {
    issues.unshift("Status da Estratégia Nutricional: ainda não concluída");
  }
  if (!record.approvedAt) {
    issues.push("Data de conclusão da Estratégia Nutricional");
  }
  if (!record.approvedByUserId) {
    issues.push("Profissional responsável pela conclusão da Estratégia Nutricional");
  }
  if (!record.waterMl) {
    issues.push("Meta diária de água");
  }
  return [...new Set(issues)];
}

export function toMealPlanStrategyInheritance(
  record: NutritionStrategyRecordView,
): MealPlanStrategyInheritance | null {
  if (mealPlanStrategyInheritanceIssues(record).length > 0) {
    return null;
  }

  return {
    sourceStrategyId: record.id,
    patientId: record.patientId,
    masterRecordId: record.masterRecordId,
    attendanceId: record.attendanceId,
    evaluationEntryId: record.evaluationEntryId,
    objective: record.objective!,
    secondaryObjectives: record.secondaryObjectives ?? [],
    method: record.method!,
    modifications: record.modifications ?? [],
    clinicalProtocols:
      record.clinicalProtocols ??
      (record.clinicalProtocol ? [record.clinicalProtocol] : []),
    clinicalProtocol:
      record.clinicalProtocols?.[0] ?? record.clinicalProtocol,
    specificConfigurations: record.specificConfigurations ?? {},
    energyGoal: record.energyGoal,
    protocol: record.protocol!,
    totalEnergyExpenditureKcal:
      record.totalEnergyExpenditureKcal!,
    caloriesKcal: record.finalCaloriesKcal!,
    proteinGrams: record.calculatedMacros.protein!.grams,
    proteinPercentage: record.calculatedMacros.protein!.percentage,
    carbohydratesGrams: record.calculatedMacros.carbohydrates!.grams,
    carbohydratesPercentage:
      record.calculatedMacros.carbohydrates!.percentage,
    fatsGrams: record.calculatedMacros.fats!.grams,
    fatsPercentage: record.calculatedMacros.fats!.percentage,
    fiberGrams: record.fiberGrams!,
    waterMl: record.waterMl!,
    mealCount: record.mealCount!,
    mealDistribution: record.mealDistribution,
    supplementation: record.supplementation,
    clinicalObservations: record.clinicalObservations,
    calorieAdjustmentPercentage: record.calorieAdjustmentPercentage ?? 0,
    status: "APPROVED",
    approvedAt: record.approvedAt!,
    approvedByUserId: record.approvedByUserId!,
  };
}
