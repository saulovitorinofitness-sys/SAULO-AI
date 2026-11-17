import type { ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import type { SessionUser } from "@/features/mvp";
import type { EntityId, ISODateTime } from "@/modules/shared";
import type { NutritionMethod } from "./prescription";

export type NutritionStrategyStatus = "DRAFT" | "ACTIVE";
export type { NutritionMethod } from "./prescription";
export type EnergyTargetMode = "CALORIES" | "BMR";

export interface MacronutrientTarget {
  readonly percentage: number;
  readonly grams: number;
}

export interface NutritionGoals {
  readonly method: NutritionMethod;
  readonly energyMode: EnergyTargetMode;
  readonly targetCalories: number;
  readonly basalMetabolicRateKcal?: number;
  readonly carbohydrates: MacronutrientTarget;
  readonly protein: MacronutrientTarget;
  readonly fats: MacronutrientTarget;
}

export interface AssembledDietNutrition {
  readonly calories: number;
  readonly carbohydratesGrams: number;
  readonly proteinGrams: number;
  readonly fatsGrams: number;
  readonly demonstrative: true;
}

export interface NutritionStrategySelection {
  readonly patientId: EntityId;
  readonly masterRecordId: EntityId;
  readonly scenario: ClinicalCollectionScenarioKey;
  readonly objectiveMain: string;
  readonly method: NutritionMethod;
  readonly energyMode: EnergyTargetMode;
  readonly targetCalories: number;
  readonly carbohydrates: MacronutrientTarget;
  readonly protein: MacronutrientTarget;
  readonly fats: MacronutrientTarget;
  readonly mealCount: number;
  readonly mealTimes: readonly string[];
  readonly complementaryStrategies: readonly string[];
  readonly updatedAt: ISODateTime;
  readonly demonstrative: true;
}

export interface NutritionStrategyDraftSnapshot {
  readonly selection: NutritionStrategySelection;
  readonly secondaryObjectives: readonly string[];
  readonly strategyType: string;
  readonly window: string;
  readonly preTraining: string;
  readonly postTraining: string;
  readonly supper: string;
  readonly supplementationNotes: string;
  readonly observations: string;
}

export interface NutritionStrategyPatientContext {
  readonly patientId: EntityId;
  readonly patientName: string;
  readonly patientCode: string;
  readonly age: number;
  readonly primaryObjective: string;
  readonly diagnoses: readonly string[];
  readonly restrictions: readonly string[];
  readonly allergies: readonly string[];
  readonly preferences: readonly string[];
  readonly supplementation: readonly string[];
  readonly schedules: readonly string[];
  readonly routine: readonly string[];
}

export interface NutritionStrategySupplementationItem {
  readonly id: string;
  readonly supplementId: string;
  readonly name: string;
  readonly objective: string;
  readonly schedule: string;
  readonly observations: string;
}

export interface NutritionStrategyScientificReference {
  readonly id: string;
  readonly domain: string;
  readonly name: string;
  readonly source: string;
}

export interface NutritionStrategyMealDistribution {
  readonly mealCount: number;
  readonly mealTimes: readonly string[];
  readonly window: string;
  readonly preTraining: string;
  readonly postTraining: string;
  readonly supper: string;
}

export interface NutritionStrategySummary {
  readonly primaryObjective: string;
  readonly strategyType: string;
  readonly mealCount: number;
  readonly supplementationCount: number;
  readonly statusLabel: string;
  readonly lastUpdatedAt: ISODateTime;
  readonly responsibleProfessional: string;
}

export interface NutritionStrategyView {
  readonly patientId: EntityId;
  readonly masterRecordId: EntityId;
  readonly scenario: ClinicalCollectionScenarioKey;
  readonly status: NutritionStrategyStatus;
  readonly patient: NutritionStrategyPatientContext;
  readonly objectiveMain: string;
  readonly secondaryObjectives: readonly string[];
  readonly strategyType: string;
  readonly nutritionGoals: NutritionGoals;
  readonly assembledDiet: AssembledDietNutrition;
  readonly mealDistribution: NutritionStrategyMealDistribution;
  readonly complementaryStrategies: readonly string[];
  readonly supplementation: readonly NutritionStrategySupplementationItem[];
  readonly clinicalObservations: string;
  readonly summary: NutritionStrategySummary;
  readonly scientificReferences: readonly NutritionStrategyScientificReference[];
  readonly updatedAt: ISODateTime;
  readonly responsibleProfessional: string;
  readonly canOpenMealPlan: boolean;
  readonly mealPlanHref?: string;
  readonly decisionContext: string;
  readonly planContext: string;
}

export interface GetNutritionStrategyInput {
  readonly patientId: EntityId;
  readonly scenario: ClinicalCollectionScenarioKey;
  readonly user: SessionUser;
}
