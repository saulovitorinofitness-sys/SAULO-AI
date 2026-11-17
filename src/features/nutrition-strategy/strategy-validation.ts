import { z } from "zod";

import {
  NUTRITION_OBJECTIVES,
} from "./decision-engine";
import type { NutritionStrategyDraft } from "./strategy-record";
import {
  CLINICAL_PROTOCOL_OPTIONS,
  ENERGY_GOAL_OPTIONS,
  NUTRITION_METHOD_OPTIONS,
  NUTRITION_MODIFICATION_OPTIONS,
} from "./prescription";
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
const calorieAdjustment = z.number().finite().min(-100).max(100);
const nutritionMethodCodes = NUTRITION_METHOD_OPTIONS.map(([code]) => code);
const modificationCodes = NUTRITION_MODIFICATION_OPTIONS.map(([code]) => code);
const clinicalProtocolCodes = CLINICAL_PROTOCOL_OPTIONS.map(([code]) => code);
const energyGoalCodes = ENERGY_GOAL_OPTIONS.map(([code]) => code);
const weekday = z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
const macroTarget = z.object({
  mode: z.enum(["GRAMS_PER_KG", "PERCENTAGE", "GRAMS"]),
  value: positiveNumber.optional(),
});
const carbohydrateCyclingTarget = z.object({
  mode: z.enum(["GRAMS_PER_KG", "GRAMS"]),
  value: positiveNumber.optional(),
});
const sportsNutritionTarget = z.object({
  energyKcal: positiveNumber.optional(),
  protein: macroTarget.optional(),
  carbohydrates: macroTarget.optional(),
  fats: macroTarget.optional(),
});
const specificConfigurations = z.object({
  fasting: z.object({
    protocol: z.enum(["12_12", "14_10", "16_8", "18_6", "CUSTOM"]).optional(),
    eatingWindowHours: positiveNumber.max(24).optional(),
    fastingWindowHours: positiveNumber.max(24).optional(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    weekdays: z.array(weekday).max(7),
  }).optional(),
  carbohydrateCycling: z.object({
    lowDays: z.array(weekday).max(7),
    moderateDays: z.array(weekday).max(7),
    highDays: z.array(weekday).max(7),
    linkedToTraining: z.boolean(),
    lowTarget: carbohydrateCyclingTarget.optional(),
    moderateTarget: carbohydrateCyclingTarget.optional(),
    highTarget: carbohydrateCyclingTarget.optional(),
  }).optional(),
  sportsPeriodization: z.object({
    phase: z.string().trim().max(200).optional(),
    objective: z.string().trim().max(500).optional(),
    trainingDays: z.array(weekday).max(7),
    restDays: z.array(weekday).max(7),
    competitionDays: z.array(weekday).max(7),
    phaseOther: z.string().trim().max(200).optional(),
    objectiveOther: z.string().trim().max(500).optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
    sport: z.string().trim().max(200).optional(),
    days: z.array(z.object({
      weekday,
      type: z.enum(["TRAINING", "REST", "COMPETITION"]),
      trainingType: z.string().trim().max(200).optional(),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      durationMinutes: positiveNumber.max(1_440).optional(),
      intensity: z.enum(["LOW", "MODERATE", "HIGH"]).optional(),
    })).max(7).optional(),
    nutritionTargets: z.object({
      TRAINING: sportsNutritionTarget.optional(),
      REST: sportsNutritionTarget.optional(),
      COMPETITION: sportsNutritionTarget.optional(),
    }).optional(),
  }).optional(),
  ketogenic: z.object({
    dailyCarbohydrateLimitGrams: positiveNumber.optional(),
    monitoringAcknowledged: z.boolean(),
  }).optional(),
  lowFodmap: z.object({
    phase: z.enum(["RESTRICTION", "REINTRODUCTION", "PERSONALIZATION"]).optional(),
  }).optional(),
  renal: z.object({
    proteinGrams: positiveNumber.optional(),
    sodiumMg: positiveNumber.optional(),
    potassiumMg: positiveNumber.optional(),
    phosphorusMg: positiveNumber.optional(),
    fluidsMl: positiveNumber.optional(),
  }).optional(),
  otherProtocolDescription: z.string().trim().max(1000).optional(),
});
const recallItem = z.object({
  id: z.string().trim().min(1).max(100),
  foodId: z.string().uuid(),
  foodName: z.string().trim().min(1).max(180),
  mealName: z.string().trim().max(100),
  amount: positiveNumber.optional(),
  unit: z.enum(["g", "ml"]),
});
const intakeTotals = z.object({
  energyKcal: z.number().finite().nonnegative().optional(),
  proteinGrams: z.number().finite().nonnegative().optional(),
  carbohydratesGrams: z.number().finite().nonnegative().optional(),
  fatsGrams: z.number().finite().nonnegative().optional(),
  fiberGrams: z.number().finite().nonnegative().optional(),
  micronutrients: z.record(z.string(), z.number().finite().nonnegative()),
});
const intakeEstimate = z.object({
  totals: intakeTotals,
  confidence: z.enum(["NOT_ESTIMATED", "LOW", "HIGH"]),
  quantifiedItemCount: z.number().int().nonnegative(),
  totalItemCount: z.number().int().nonnegative(),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20),
});
const evolutionGoal = z.object({
  direction: z.enum(["LOSS", "GAIN", "MAINTENANCE"]),
  targetKg: positiveNumber.optional(),
  periodDays: z.number().int().positive().max(3_650).optional(),
});
export const nutritionPatternAnalysisInputSchema = z.object({
  items: z.array(recallItem).max(100),
  totalEnergyExpenditureKcal: positiveNumber.optional(),
  objective: z.enum(Object.keys(NUTRITION_OBJECTIVES) as [
    keyof typeof NUTRITION_OBJECTIVES,
    ...(keyof typeof NUTRITION_OBJECTIVES)[],
  ]).optional(),
  evolutionGoal: evolutionGoal.optional(),
});
const patternEnergySuggestion = z.object({
  habitualEnergyKcal: positiveNumber,
  totalEnergyExpenditureKcal: positiveNumber,
  differenceFromGetKcal: z.number().finite(),
  adjustmentType: z.enum(["DEFICIT", "SURPLUS", "MAINTENANCE"]),
  suggestedAdjustmentKcal: z.number().finite(),
  suggestedVetKcal: positiveNumber.optional(),
  targetVetFromGoalKcal: positiveNumber.optional(),
  incompatible: z.boolean(),
  rationale: z.string().trim().min(1).max(1_000),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20),
});

export const habitualIntakeDraftSchema = z.object({
  items: z.array(recallItem).max(100),
  estimate: intakeEstimate.optional(),
});

export const nutritionStrategyDraftSchema = z.object({
  objective: z.enum(Object.keys(NUTRITION_OBJECTIVES) as [
    keyof typeof NUTRITION_OBJECTIVES,
    ...(keyof typeof NUTRITION_OBJECTIVES)[],
  ]).optional(),
  secondaryObjectives: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  method: z.enum(nutritionMethodCodes).optional(),
  modifications: z.array(z.enum(modificationCodes)).max(modificationCodes.length).optional(),
  clinicalProtocols: z.array(z.enum(clinicalProtocolCodes)).max(clinicalProtocolCodes.length).optional(),
  clinicalProtocol: z.enum(clinicalProtocolCodes).optional(),
  specificConfigurations: specificConfigurations.optional(),
  energyGoal: z.enum(energyGoalCodes).optional(),
  protocol: z.enum(Object.keys(ENERGY_PROTOCOLS) as [
    keyof typeof ENERGY_PROTOCOLS,
    ...(keyof typeof ENERGY_PROTOCOLS)[],
  ]).optional(),
  calorieAdjustmentPercentage: calorieAdjustment.optional(),
  activityFactor: positiveNumber.optional(),
  manualFinalCaloriesKcal: positiveNumber.optional(),
  finalCaloriesKcal: positiveNumber.optional(),
  basalMetabolicRateKcal: positiveNumber.optional(),
  totalEnergyExpenditureKcal: positiveNumber.optional(),
  habitualIntake: habitualIntakeDraftSchema.optional(),
  evolutionGoal: evolutionGoal.optional(),
  patternEnergySuggestion: patternEnergySuggestion.optional(),
  vetDecisionState: z.enum(["SUGGESTED", "EDITED", "APPROVED"]).optional(),
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
      name: z.string().trim().max(500),
      time: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .or(z.literal("")),
      vetPercentage: z.number().finite().min(0).max(100),
      plannedCaloriesKcal: positiveNumber.optional(),
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

const draftFieldLabels: Readonly<Record<string, string>> = {
  objective: "Objetivo nutricional",
  method: "Método nutricional",
  modifications: "Modificações nutricionais",
  clinicalProtocols: "Protocolo clínico",
  specificConfigurations: "Configurações avançadas",
  energyGoal: "Objetivo energético",
  protocol: "Protocolo energético",
  calorieAdjustmentPercentage: "Ajuste energético",
  activityFactor: "Fator de atividade",
  finalCaloriesKcal: "VET",
  totalEnergyExpenditureKcal: "GET",
  protein: "Proteínas",
  carbohydrates: "Carboidratos",
  fats: "Lipídios",
  calculatedMacros: "Cálculo dos macronutrientes",
  macroValidation: "Distribuição dos macronutrientes",
  fiberGrams: "Meta diária de fibras",
  waterMl: "Meta diária de água",
  mealCount: "Número de refeições",
  mealDistribution: "Organização alimentar",
  supplementation: "Suplementação",
  clinicalObservations: "Justificativa / conduta profissional",
};

export function nutritionStrategyDraftValidationIssues(value: unknown) {
  const result = nutritionStrategyDraftSchema.safeParse(value);
  if (result.success) return [];
  return [...new Set(result.error.issues.map((issue) => {
    const [field, configuration] = issue.path.map(String);
    if (field === "specificConfigurations") {
      if (configuration === "sportsPeriodization") return "Periodização nutricional esportiva";
      if (configuration === "fasting") return "Jejum intermitente";
      if (configuration === "carbohydrateCycling") return "Ciclagem de carboidratos";
    }
    return draftFieldLabels[field] ?? field ?? "Dados da Estratégia Nutricional";
  }))];
}

export function parseNutritionStrategyDraft(
  value: unknown,
): NutritionStrategyDraft | null {
  const result = nutritionStrategyDraftSchema.safeParse(value);
  if (!result.success) return null;
  const data = result.data as NutritionStrategyDraft;
  return {
    ...data,
    clinicalProtocols:
      data.clinicalProtocols ??
      (data.clinicalProtocol ? [data.clinicalProtocol] : []),
  };
}
