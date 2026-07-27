import type { ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import {
  NUTRITION_OBJECTIVES,
  type MealPlanStrategyInheritance,
} from "@/features/nutrition-strategy";
import { ENERGY_PROTOCOLS } from "@/lib/nutrition";

import type { MealPlanPrescriptionView } from "./contracts";
import { EMPTY_NUTRITION_VALUES } from "./nutrition-calculations";
import { calculateNutritionAdequacy } from "./adequacy-engine";
import type { PersistedMealPlanView } from "./repository";

function number(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits,
  }).format(value);
}

function adjustment(value: number) {
  if (value === 0) return "Sem ajuste";
  return `${value > 0 ? "+" : ""}${value}%`;
}

export function assembleMealPlanView(input: {
  readonly record: PersistedMealPlanView;
  readonly strategy: MealPlanStrategyInheritance;
  readonly scenario: ClinicalCollectionScenarioKey;
}): MealPlanPrescriptionView {
  const { record, strategy } = input;
  const displayedStrategy = record.strategySnapshot ?? strategy;
  const recordTotals = record.totals ?? EMPTY_NUTRITION_VALUES;

  return {
    id: record.id,
    patientId: record.patientId,
    patientName: record.patientName,
    masterRecordId: record.masterRecordId,
    attendanceId: record.attendanceId,
    strategyEntryId: strategy.sourceStrategyId,
    strategyApprovedAt: displayedStrategy.approvedAt,
    strategyStatus: strategy.status,
    createdAt: record.createdAt,
    scenario: input.scenario,
    status: record.status === "IN_REVIEW" ? "PENDING_REVIEW" : record.status,
    responsibleUserId: record.responsibleUserId,
    responsibleProfessional: record.responsibleProfessional,
    updatedAt: record.updatedAt,
    strategy: displayedStrategy,
    latestStrategy: strategy,
    strategyUpdateAvailable:
      record.strategyApprovedAt !== strategy.approvedAt,
    totals: recordTotals,
    comparison: record.comparison ?? {
      energyKcal: "BELOW",
      proteinGrams: "BELOW",
      carbohydratesGrams: "BELOW",
      fatsGrams: "BELOW",
      fiberGrams: "BELOW",
    },
    aiDecision: record.aiDecision ?? "IDLE",
    adequacy:
      record.adequacy ??
      calculateNutritionAdequacy({
        target: {
          energyKcal: displayedStrategy.caloriesKcal,
          proteinGrams: displayedStrategy.proteinGrams,
          carbohydratesGrams: displayedStrategy.carbohydratesGrams,
          fatsGrams: displayedStrategy.fatsGrams,
          fiberGrams: displayedStrategy.fiberGrams,
          waterMl: displayedStrategy.waterMl,
        },
        actual: {
          ...recordTotals,
          waterMl: displayedStrategy.waterMl,
        },
        updatedAt: record.updatedAt,
      }),
    prescriptionMeals: record.meals,
    summary: {
      primaryObjective: NUTRITION_OBJECTIVES[displayedStrategy.objective],
      strategy: `${displayedStrategy.method ? `${displayedStrategy.method} · ` : ""}${ENERGY_PROTOCOLS[displayedStrategy.protocol]} · ${adjustment(displayedStrategy.calorieAdjustmentPercentage)} · Aprovada`,
      plannedCalories: `${number(displayedStrategy.caloriesKcal, 0)} kcal`,
      protein: `${number(displayedStrategy.proteinGrams)} g · ${number(displayedStrategy.proteinPercentage)}%`,
      carbohydrates: `${number(displayedStrategy.carbohydratesGrams)} g · ${number(displayedStrategy.carbohydratesPercentage)}%`,
      fats: `${number(displayedStrategy.fatsGrams)} g · ${number(displayedStrategy.fatsPercentage)}%`,
      mealCount: displayedStrategy.mealCount,
      restrictions: [],
      supplementation:
        displayedStrategy.supplementation.map((item) => item.name).join(" · "),
      observations:
        displayedStrategy.clinicalObservations ||
        `Estratégia aprovada em ${new Intl.DateTimeFormat("pt-BR").format(new Date(displayedStrategy.approvedAt))}.`,
    },
    meals: record.meals.map((meal) => ({
      id: meal.id,
      order: meal.order,
      name: meal.name,
      time: meal.time ?? "",
      objective: "",
      foods: [],
      optionCount: 0,
      observations: meal.observations ?? "",
      supplements: "",
      hydration: "",
    })),
  };
}
