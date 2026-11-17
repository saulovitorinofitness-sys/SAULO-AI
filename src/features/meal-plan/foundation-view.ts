import type { ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import {
  resolveMealPlanObjective,
  type MealPlanStrategyInheritance,
} from "@/features/nutrition-strategy";
import { ENERGY_PROTOCOLS } from "@/lib/nutrition";

import type { MealPlanPrescriptionView } from "./contracts";
import {
  compareMealPlanNutrition,
  EMPTY_NUTRITION_VALUES,
} from "./nutrition-calculations";
import { calculateNutritionAdequacy } from "./adequacy-engine";
import { deriveDietaryReferenceProfile, selectDietaryReferences } from "./dietary-reference";
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
  readonly strategy?: MealPlanStrategyInheritance;
  readonly scenario: ClinicalCollectionScenarioKey;
}): MealPlanPrescriptionView {
  const { record, strategy } = input;
  const recordTotals = record.totals ?? EMPTY_NUTRITION_VALUES;
  const objective = strategy
    ? resolveMealPlanObjective(strategy)
    : undefined;
  const derivedReferenceProfile = !record.dietaryReferenceProfile && record.status === "DRAFT"
    ? deriveDietaryReferenceProfile({
        patientSex: record.patientSex,
        birthDate: record.patientBirthDate ?? "",
        attendanceDate: record.attendanceDate ?? record.createdAt,
        clinicalProtocols: strategy?.clinicalProtocols,
      }) ?? undefined
    : undefined;
  const dietaryReferenceProfile = record.dietaryReferenceProfile ?? derivedReferenceProfile;
  const dietaryReferences = record.dietaryReferences ?? (
    derivedReferenceProfile ? selectDietaryReferences(derivedReferenceProfile) ?? undefined : undefined
  );

  return {
    id: record.id,
    patientId: record.patientId,
    patientName: record.patientName,
    patientBirthDate: record.patientBirthDate ?? "",
    patientSex: record.patientSex ?? "NOT_INFORMED",
    attendanceDate: record.attendanceDate ?? record.createdAt,
    masterRecordId: record.masterRecordId,
    attendanceId: record.attendanceId,
    strategyEntryId: strategy?.sourceStrategyId,
    strategyApprovedAt: strategy?.approvedAt,
    strategyStatus: strategy?.status,
    createdAt: record.createdAt,
    scenario: input.scenario,
    status: record.status === "IN_REVIEW" ? "PENDING_REVIEW" : record.status,
    revision: record.revision,
    responsibleUserId: record.responsibleUserId,
    responsibleProfessional: record.responsibleProfessional,
    updatedAt: record.updatedAt,
    strategy,
    latestStrategy: strategy,
    strategyUpdateAvailable: false,
    totals: recordTotals,
    comparison: strategy ? compareMealPlanNutrition(
      {
        energyKcal: strategy.caloriesKcal,
        proteinGrams: strategy.proteinGrams,
        carbohydratesGrams: strategy.carbohydratesGrams,
        fatsGrams: strategy.fatsGrams,
        fiberGrams: strategy.fiberGrams,
      },
      recordTotals,
    ) : undefined,
    aiDecision: record.aiDecision ?? "IDLE",
    smartGenerationVersion: record.smartGenerationVersion,
    adequacy: strategy ? calculateNutritionAdequacy({
        target: {
          energyKcal: strategy.caloriesKcal,
          proteinGrams: strategy.proteinGrams,
          carbohydratesGrams: strategy.carbohydratesGrams,
          fatsGrams: strategy.fatsGrams,
          fiberGrams: strategy.fiberGrams,
          waterMl: strategy.waterMl,
        },
        actual: {
          ...recordTotals,
          waterMl: strategy.waterMl,
        },
        updatedAt: record.updatedAt,
      }) : undefined,
    prescriptionMeals: record.meals,
    prescriptionSupplements: record.supplements,
    prescriptionHistory: record.history,
    sourcePlanEntryId: record.sourcePlanEntryId,
    sourcePlanAttendanceId: record.sourcePlanAttendanceId,
    sourcePlanRevision: record.sourcePlanRevision,
    reuseMode: record.reuseMode,
    dietaryReferenceProfile,
    dietaryReferences,
    professionalReview: record.professionalReview,
    targetDeviationAuthorization: record.targetDeviationAuthorization,
    summary: {
      primaryObjective: objective?.label ?? "Definição manual",
      strategy: strategy
        ? `${strategy.method ? `${strategy.method} · ` : ""}${ENERGY_PROTOCOLS[strategy.protocol]} · ${adjustment(strategy.calorieAdjustmentPercentage)} · Aprovada`
        : "Estratégia nutricional não realizada neste atendimento",
      plannedCalories: strategy ? `${number(strategy.caloriesKcal, 0)} kcal` : "Não definido",
      protein: strategy ? `${number(strategy.proteinGrams)} g · ${number(strategy.proteinPercentage)}%` : "Não definido",
      carbohydrates: strategy ? `${number(strategy.carbohydratesGrams)} g · ${number(strategy.carbohydratesPercentage)}%` : "Não definido",
      fats: strategy ? `${number(strategy.fatsGrams)} g · ${number(strategy.fatsPercentage)}%` : "Não definido",
      mealCount: strategy?.mealCount ?? record.meals.length,
      restrictions: [],
      supplementation:
        strategy?.supplementation.map((item) => item.name).join(" · ") ?? "",
      observations:
        strategy?.clinicalObservations ||
        (strategy
          ? `Estratégia aprovada em ${new Intl.DateTimeFormat("pt-BR").format(new Date(strategy.approvedAt))}.`
          : "Plano elaborado manualmente sem metas herdadas da Estratégia."),
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
