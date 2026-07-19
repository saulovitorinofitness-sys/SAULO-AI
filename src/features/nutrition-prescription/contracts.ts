import type { ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import type { SessionUser } from "@/features/mvp";
import type { ScientificLibraryItem } from "@/features/scientific-library";

export interface NutritionPatientContext {
  readonly patientId: string;
  readonly patientName: string;
  readonly masterRecordId: string;
  readonly objective: string;
  readonly diagnoses: readonly string[];
  readonly restrictions: readonly string[];
  readonly allergies: readonly string[];
  readonly preferences: readonly string[];
  readonly aversions: readonly string[];
  readonly supplementation: readonly string[];
  readonly schedules: readonly string[];
  readonly routine: readonly string[];
}

export interface PrescriptionMealReference {
  readonly id: string;
  readonly name: string;
  readonly time: string;
}

export interface FoodSubstitution {
  readonly id: string;
  readonly scientificLibraryItemId: string;
  readonly name: string;
  readonly foodGroup: string;
  readonly notes: string;
  readonly priority: number;
}

export type PrescriptionEntryKind = "FOOD" | "RECIPE" | "SUPPLEMENT";

export interface PrescriptionMealEntry {
  readonly id: string;
  readonly scientificLibraryItemId: string;
  readonly kind: PrescriptionEntryKind;
  readonly name: string;
  readonly quantity: string;
  readonly householdMeasure: string;
  readonly notes: string;
  readonly order: number;
  readonly group: string;
  readonly substitutions: readonly FoodSubstitution[];
}

export interface PrescriptionMealDraft {
  readonly mealId: string;
  readonly time: string;
  readonly guidance: string;
  readonly observations: string;
  readonly preparation: string;
  readonly entries: readonly PrescriptionMealEntry[];
}

export interface NutritionPrescriptionView {
  readonly scenario: ClinicalCollectionScenarioKey;
  readonly patient: NutritionPatientContext;
  readonly meals: readonly PrescriptionMealReference[];
  readonly foods: readonly ScientificLibraryItem[];
  readonly recipes: readonly ScientificLibraryItem[];
  readonly supplements: readonly ScientificLibraryItem[];
  readonly responsibleProfessional: string;
  readonly lastEditedAt: string;
}

export interface GetNutritionPrescriptionInput {
  readonly patientId: string;
  readonly scenario: ClinicalCollectionScenarioKey;
  readonly user: SessionUser;
}

