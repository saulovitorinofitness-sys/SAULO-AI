import type { ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import type { MealPlanView } from "@/features/meal-plan";
import type {
  NutritionStrategySelection,
  NutritionStrategyStatus,
} from "@/features/nutrition-strategy";
import type { PatientHubView } from "@/features/patient-hub";
import type { EntityId, ISODateTime } from "@/modules/shared";

export type ClinicalEngineSectionStatus = "COMPLETE" | "PENDING" | "RESTRICTED";
export type NutritionDecisionPriority = "HIGH" | "MEDIUM" | "LOW";
export type NutritionCompatibilityStatus =
  | "COMPATIBLE"
  | "REVIEW"
  | "DIVERGENT"
  | "UNAVAILABLE";

export interface ClinicalEngineMetric {
  readonly label: string;
  readonly value: string;
  readonly pending?: boolean;
}

export interface ClinicalEngineSection {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: ClinicalEngineSectionStatus;
  readonly metrics: readonly ClinicalEngineMetric[];
  readonly items?: readonly string[];
}

export interface NutritionDecisionAlert {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly priority: NutritionDecisionPriority;
  readonly source: string;
}

export interface NutritionDecisionPriorityItem {
  readonly id: string;
  readonly title: string;
  readonly priority: NutritionDecisionPriority;
  readonly source: string;
}

export interface NutritionDecisionSuggestion {
  readonly id: string;
  readonly title: string;
  readonly priority: NutritionDecisionPriority;
  readonly reason: string;
  readonly dataUsed: readonly string[];
  readonly trigger: string;
}

export interface NutritionDecisionComparison {
  readonly id: string;
  readonly label: string;
  readonly target?: number | string;
  readonly current?: number | string;
  readonly unit?: string;
  readonly difference?: number;
  readonly adequacyPercentage?: number;
  readonly status: NutritionCompatibilityStatus;
  readonly explanation: string;
}

export interface NutritionDecisionTimelineEvent {
  readonly id: string;
  readonly occurredAt: ISODateTime;
  readonly title: string;
  readonly description: string;
  readonly professionalName: string;
  readonly source: string;
}

export interface NutritionDecisionAnalysisAudit {
  readonly analyzedAt: ISODateTime;
  readonly engineVersion: string;
  readonly strategyReference?: string;
  readonly mealPlanReference?: string;
}

export interface NutritionDecisionRuntimeContext {
  readonly objective?: string;
  readonly initialStrategy?: NutritionStrategySelection;
  readonly initialStrategyStatus?: NutritionStrategyStatus;
  readonly initialPlan?: MealPlanView;
  readonly anthropometry: {
    readonly weightKg?: number;
    readonly bioimpedanceWeightKg?: number;
    readonly heightCm?: number;
    readonly assessedAt?: ISODateTime;
  };
  readonly supplementCount: number;
}

export interface ClinicalEngineView {
  readonly patientId: EntityId;
  readonly masterRecordId: EntityId;
  readonly scenario: ClinicalCollectionScenarioKey;
  readonly hub: PatientHubView;
  readonly sections: readonly ClinicalEngineSection[];
  readonly comparisons: readonly NutritionDecisionComparison[];
  readonly alerts: readonly NutritionDecisionAlert[];
  readonly priorities: readonly NutritionDecisionPriorityItem[];
  readonly suggestions: readonly NutritionDecisionSuggestion[];
  readonly timeline: readonly NutritionDecisionTimelineEvent[];
  readonly analysisAudit: NutritionDecisionAnalysisAudit;
  readonly runtimeContext: NutritionDecisionRuntimeContext;
  readonly demonstrative: boolean;
  readonly completeSectionCount: number;
  readonly pendingSectionCount: number;
  readonly lastUpdatedAt: ISODateTime;
  readonly responsibleProfessional: string;
  readonly masterRecordVersion: string;
}
