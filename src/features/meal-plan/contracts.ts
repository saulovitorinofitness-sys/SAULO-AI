import type { ClinicalCollectionScenarioKey } from "@/features/clinical-collection";

export type MealPlanStatus = "DRAFT" | "IN_REVIEW" | "ACTIVE";
export interface MealPlanFood { readonly id: string; readonly name: string; readonly quantity: string; readonly householdMeasure: string; readonly substitutions: readonly string[]; }
export interface MealPlanMeal { readonly id: string; readonly name: string; readonly time: string; readonly objective: string; readonly foods: readonly MealPlanFood[]; readonly optionCount: number; readonly observations: string; readonly supplements: string; readonly hydration: string; }
export interface NutritionSummary { readonly primaryObjective: string; readonly strategy: string; readonly plannedCalories: string; readonly protein: string; readonly carbohydrates: string; readonly fats: string; readonly mealCount: number; readonly restrictions: readonly string[]; readonly supplementation: string; readonly observations: string; }
export interface MealPlanView {
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly masterRecordId: string;
  readonly scenario: ClinicalCollectionScenarioKey;
  readonly status: MealPlanStatus;
  readonly responsibleProfessional: string;
  readonly updatedAt: string;
  readonly summary: NutritionSummary;
  readonly meals: readonly MealPlanMeal[];
}
export interface GetMealPlanInput { readonly patientId: string; readonly scenario: ClinicalCollectionScenarioKey; }
