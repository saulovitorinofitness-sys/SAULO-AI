import type { ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import type { SessionUser } from "@/features/mvp";

export const SHARED_DATA_DOMAINS = ["FOOD", "EXERCISE", "LABORATORY_EXAM", "SUPPLEMENT", "RECIPE", "CLINICAL_PROTOCOL", "PHYSICAL_ASSESSMENT_PROTOCOL", "POSTURAL_ASSESSMENT_PROTOCOL", "DOCUMENT_TEMPLATE", "MARKETING_CAMPAIGN", "OPERATIONAL_PROCEDURE", "CATEGORY_TAG"] as const;
export type SharedDataDomain = (typeof SHARED_DATA_DOMAINS)[number];
export type SharedDataStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "REVIEWED" | "ARCHIVED";
export type SharedDataVisibility = "SHARED" | "PHYSICAL" | "NUTRITION" | "ADMINISTRATIVE";

export interface SharedDataAudit {
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
  readonly reviewedBy?: string;
  readonly reviewStatus: "PENDING" | "REVIEWED" | "NOT_APPLICABLE";
}
export interface SharedDataCategory { readonly id: string; readonly domain: SharedDataDomain; readonly name: string; readonly status: "ACTIVE" | "ARCHIVED"; }
export interface SharedDataTag { readonly id: string; readonly name: string; readonly color: "neutral" | "info" | "success" | "warning"; }
export interface SharedDataHistoryEntry { readonly id: string; readonly occurredAt: string; readonly professionalName: string; readonly description: string; }

export interface SharedDataItemBase {
  readonly id: string;
  readonly domain: SharedDataDomain;
  readonly visibility: SharedDataVisibility;
  readonly name: string;
  readonly code?: string;
  readonly description?: string;
  readonly categoryId?: string;
  readonly tags: readonly string[];
  readonly status: SharedDataStatus;
  readonly source?: string;
  readonly notes?: string;
  readonly audit: SharedDataAudit;
  readonly history: readonly SharedDataHistoryEntry[];
  readonly reusableBy: readonly string[];
}
export interface FoodAttributes { readonly foodGroup: string; readonly defaultUnit: string; readonly householdMeasure: string; readonly mockPortion: string; readonly synonyms: readonly string[]; readonly observations: string; }
export interface ExerciseAttributes { readonly muscleGroup: string; readonly equipment: string; readonly level: string; readonly objective: string; readonly instructions: string; readonly variations: readonly string[]; readonly professionalContraindications: string; readonly futureMedia?: string; }
export interface LaboratoryExamAttributes { readonly unit: string; readonly examCategory: string; readonly observations: string; readonly mockInformativeReference: string; readonly sourceRecordId?: string; }
export interface SupplementAttributes { readonly supplementCategory: string; readonly presentation: string; readonly observations: string; readonly professionalUse: string; }
export interface ProtocolMesocyclePhase {
  readonly name: string;
  readonly objective: string;
  readonly progressionCriteria: readonly string[];
}

export interface ProtocolAttributes {
  readonly area: string;
  readonly version: string;
  readonly steps: readonly string[];
  readonly responsibleProfessional: string;
  readonly objective?: string;
  readonly targetAudience?: readonly string[];
  readonly entryRequirements?: readonly string[];
  readonly requiredAssessments?: readonly string[];
  readonly safetyCriteria?: readonly string[];
  readonly periodizationModel?: string;
  readonly macrocycleGuidance?: string;
  readonly mesocyclePhases?: readonly ProtocolMesocyclePhase[];
  readonly microcycleOrganization?: string;
  readonly weeklyFrequencyGuidance?: string;
  readonly intensityGuidance?: string;
  readonly volumeGuidance?: string;
  readonly progressionCriteria?: readonly string[];
  readonly regressionCriteria?: readonly string[];
  readonly recoveryAndDeload?: string;
  readonly monitoringIndicators?: readonly string[];
  readonly reassessmentCriteria?: readonly string[];
  readonly assistedPlanApplication?: string;
}
export type GenericSharedDataAttributes = Readonly<Record<string, string | readonly string[]>>;

export type SharedDataItem =
  | (SharedDataItemBase & { readonly domain: "FOOD"; readonly attributes: FoodAttributes })
  | (SharedDataItemBase & { readonly domain: "EXERCISE"; readonly attributes: ExerciseAttributes })
  | (SharedDataItemBase & { readonly domain: "LABORATORY_EXAM"; readonly attributes: LaboratoryExamAttributes })
  | (SharedDataItemBase & { readonly domain: "SUPPLEMENT"; readonly attributes: SupplementAttributes })
  | (SharedDataItemBase & { readonly domain: "CLINICAL_PROTOCOL" | "PHYSICAL_ASSESSMENT_PROTOCOL" | "POSTURAL_ASSESSMENT_PROTOCOL"; readonly attributes: ProtocolAttributes })
  | (SharedDataItemBase & { readonly domain: "RECIPE" | "DOCUMENT_TEMPLATE" | "MARKETING_CAMPAIGN" | "OPERATIONAL_PROCEDURE" | "CATEGORY_TAG"; readonly attributes: GenericSharedDataAttributes });

export interface SharedDataPermissions { readonly canRead: boolean; readonly canCreate: boolean; readonly canEdit: boolean; readonly canArchive: boolean; readonly canRestore: boolean; readonly canManageCategories: boolean; readonly allowedDomains: readonly SharedDataDomain[]; }
export interface SharedDataWorkspaceView { readonly scenario: ClinicalCollectionScenarioKey; readonly connectedProfessional: string; readonly items: readonly SharedDataItem[]; readonly categories: readonly SharedDataCategory[]; readonly tags: readonly SharedDataTag[]; readonly permissions: SharedDataPermissions; readonly lastUpdatedAt: string; }
export interface SharedDataDraft { readonly domain: SharedDataDomain; readonly name: string; readonly code: string; readonly description: string; readonly categoryId: string; readonly tags: readonly string[]; readonly status: SharedDataStatus; readonly source: string; readonly notes: string; }
export interface GetSharedDataWorkspaceInput { readonly scenario: ClinicalCollectionScenarioKey; readonly defaultUser: SessionUser; }

export interface SharedDataGateway {
  getWorkspace(input: GetSharedDataWorkspaceInput): Promise<SharedDataWorkspaceView>;
  create(item: SharedDataItem): Promise<SharedDataItem>;
  update(item: SharedDataItem): Promise<SharedDataItem>;
  archive(item: SharedDataItem): Promise<SharedDataItem>;
  restore(item: SharedDataItem): Promise<SharedDataItem>;
}
