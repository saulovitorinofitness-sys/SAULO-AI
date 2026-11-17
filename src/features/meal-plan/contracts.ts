import type { ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import type { MealPlanStrategyInheritance } from "@/features/nutrition-strategy/inheritance";
import type {
  MealPlanAiDecision,
  MealPlanNutritionValues,
  MealPlanRecordMeal,
  MealPlanReuseMode,
  StoredMealPlanPayload,
} from "./record";
import type { NutritionAdequacyResult } from "./adequacy-engine";
import type { PrescriptionHistoryEntry } from "./prescription-history";
import type {
  MealPlanProfessionalReview,
  MealPlanTargetDeviationAuthorization,
} from "./completion-policy";
import type { DietaryReferenceProfile, DietaryReferenceValue } from "./dietary-reference";

export type MealPlanStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "NEEDS_UPDATE";
export type AssistedPreviewStatus = MealPlanStatus;
export type AssistedMicronutrientKey = "calciumMg" | "ironMg" | "magnesiumMg" | "zincMg" | "sodiumMg" | "potassiumMg" | "vitaminAMcg" | "vitaminCMg" | "vitaminDMcg" | "vitaminEMg" | "vitaminB1Mg" | "vitaminB2Mg" | "vitaminB6Mg" | "vitaminB12Mcg" | "folateMcg";
export interface AssistedMacronutrientValues { readonly calories: number; readonly carbohydratesGrams: number; readonly proteinGrams: number; readonly fatsGrams: number; }
export interface AssistedNutritionValues extends AssistedMacronutrientValues { readonly fiberGrams: number; readonly micronutrients: Readonly<Record<AssistedMicronutrientKey, number>>; }
export interface AssistedPreviewFood {
  readonly id: string;
  readonly scientificLibraryItemId: string;
  readonly name: string;
  readonly category: string;
  readonly householdMeasure: string;
  readonly quantity: number;
  readonly gramsPerMeasure: number;
  readonly grams: number;
  readonly nutrition: AssistedNutritionValues;
  readonly source: string;
  readonly demonstrative: true;
}
export interface AssistedPreviewMeal { readonly id: string; readonly name: string; readonly time: string; readonly foods: readonly AssistedPreviewFood[]; }
export interface AssistedMealPreview {
  readonly id: string;
  readonly nutritionDataVersion: 1;
  readonly patientId: string;
  readonly masterRecordId: string;
  readonly scenario: ClinicalCollectionScenarioKey;
  readonly strategyFingerprint: string;
  readonly revision: number;
  readonly status: AssistedPreviewStatus;
  readonly approvedAt?: string;
  readonly approvedBy?: string;
  readonly meals: readonly AssistedPreviewMeal[];
  readonly createdAt: string;
  readonly notice: "Sugestão assistida por regras locais. Requer revisão e validação do nutricionista.";
  readonly demonstrative: true;
}
export interface MealPlanFood { readonly id: string; readonly name: string; readonly quantity: string; readonly householdMeasure: string; readonly substitutions: readonly string[]; }
export interface MealPlanMeal { readonly id: string; readonly order?: number; readonly name: string; readonly time: string; readonly objective: string; readonly foods: readonly MealPlanFood[]; readonly optionCount: number; readonly observations: string; readonly supplements: string; readonly hydration: string; }
export interface NutritionSummary { readonly primaryObjective: string; readonly strategy: string; readonly plannedCalories: string; readonly protein: string; readonly carbohydrates: string; readonly fats: string; readonly mealCount: number; readonly restrictions: readonly string[]; readonly supplementation: string; readonly observations: string; }
export interface MealPlanView {
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly masterRecordId: string;
  readonly attendanceId?: string;
  readonly strategyEntryId?: string;
  readonly strategyApprovedAt?: string;
  readonly strategyStatus?: "APPROVED";
  readonly createdAt?: string;
  readonly scenario: ClinicalCollectionScenarioKey;
  readonly status: MealPlanStatus;
  readonly responsibleUserId: string;
  readonly responsibleProfessional: string;
  readonly updatedAt: string;
  readonly summary: NutritionSummary;
  readonly meals: readonly MealPlanMeal[];
}
export interface MealPlanPrescriptionView extends MealPlanView {
  readonly revision: number;
  readonly strategy?: MealPlanStrategyInheritance;
  readonly latestStrategy?: MealPlanStrategyInheritance;
  readonly strategyUpdateAvailable: boolean;
  readonly totals: MealPlanNutritionValues;
  readonly comparison: StoredMealPlanPayload["comparison"];
  readonly aiDecision: MealPlanAiDecision;
  readonly smartGenerationVersion?: number;
  readonly adequacy?: NutritionAdequacyResult;
  readonly prescriptionMeals: readonly MealPlanRecordMeal[];
  readonly prescriptionSupplements: StoredMealPlanPayload["supplements"];
  readonly prescriptionHistory: readonly PrescriptionHistoryEntry[];
  readonly sourcePlanEntryId?: string;
  readonly sourcePlanAttendanceId?: string;
  readonly sourcePlanRevision?: number;
  readonly reuseMode?: MealPlanReuseMode;
  readonly patientBirthDate: string;
  readonly patientSex: "FEMALE" | "MALE" | "INTERSEX" | "NOT_INFORMED";
  readonly attendanceDate: string;
  readonly dietaryReferenceProfile?: DietaryReferenceProfile;
  readonly dietaryReferences?: readonly DietaryReferenceValue[];
  readonly professionalReview?: MealPlanProfessionalReview;
  readonly targetDeviationAuthorization?: MealPlanTargetDeviationAuthorization;
  readonly currentWeightKg?: number;
}
export interface GetMealPlanInput { readonly patientId: string; readonly scenario: ClinicalCollectionScenarioKey; }
