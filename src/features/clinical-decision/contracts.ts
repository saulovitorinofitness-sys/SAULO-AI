import type { ClinicalCollectionScenarioKey, ProfessionalAudit } from "@/features/clinical-collection";
import type { EntityId, ISODateTime } from "@/modules/shared";

export type ClinicalDecisionAlertLevel = "INFORMATIVE" | "ATTENTION" | "PRIORITY";
export type ClinicalDecisionReviewStatus = "PENDING" | "IN_REVIEW" | "RESOLVED" | "NOT_APPLICABLE";
export type ClinicalDecisionArea = "NUTRITION" | "PHYSICAL_EDUCATION" | "PHYSICAL_ASSESSMENT" | "BIOIMPEDANCE" | "PERIMETRY" | "POSTURAL_ASSESSMENT" | "CLINICAL_HISTORY" | "LABORATORY" | "GENERAL";
export type ProfessionalDecisionSource = "OWN_DECISION" | "ASSISTED_SUGGESTION_ACCEPTED" | "ASSISTED_SUGGESTION_REJECTED" | "PREVIOUS_DECISION_REVIEW";
export type ClinicalDecisionScenarioKey = "COMPLETE" | "POSTURAL_PENDING" | "MARIA_FUNCTIONAL" | "EMPTY" | "SAVE_ERROR";

export interface ClinicalDecisionEvidence {
  readonly id: string;
  readonly area: ClinicalDecisionArea;
  readonly label: string;
  readonly value: string;
  readonly source: string;
  readonly recordedAt?: ISODateTime;
  readonly recordedBy?: string;
}

export interface ClinicalDecisionAlert {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly level: ClinicalDecisionAlertLevel;
  readonly area: ClinicalDecisionArea;
  readonly source: string;
  readonly status: ClinicalDecisionReviewStatus;
  readonly createdAt: ISODateTime;
  readonly actionLabel: string;
}

export interface ClinicalDecisionPendingItem {
  readonly id: string;
  readonly description: string;
  readonly area: ClinicalDecisionArea;
  readonly priority: ClinicalDecisionAlertLevel;
  readonly reason: string;
  readonly possibleResponsible: string;
  readonly suggestedAction: string;
  readonly status: ClinicalDecisionReviewStatus;
}

export interface ClinicalDecisionReviewPoint {
  readonly id: string;
  readonly title: string;
  readonly rationale: string;
  readonly evidenceIds: readonly string[];
  readonly area: ClinicalDecisionArea;
  readonly relevance: ClinicalDecisionAlertLevel;
  readonly status: ClinicalDecisionReviewStatus;
}

export interface ProfessionalClinicalDecision {
  readonly id: string;
  readonly patientId: EntityId;
  readonly professionalId: EntityId;
  readonly professionalName: string;
  readonly area: ClinicalDecisionArea;
  readonly decision: string;
  readonly rationale: string;
  readonly priority: ClinicalDecisionAlertLevel;
  readonly conducts: readonly string[];
  readonly followUpRequired: boolean;
  readonly reassessmentDate?: string;
  readonly notes?: string;
  readonly source: ProfessionalDecisionSource;
  readonly createdAt: ISODateTime;
  readonly status: "DRAFT" | "REVIEWED";
}

export interface ClinicalDecisionPermissions {
  readonly canRead: boolean;
  readonly canWrite: boolean;
  readonly canViewNutrition: boolean;
  readonly allowedDecisionAreas: readonly ClinicalDecisionArea[];
}

export interface ClinicalDecisionWorkspace {
  readonly patientId: EntityId;
  readonly attendanceId: EntityId;
  readonly masterRecordId: EntityId;
  readonly collectionScenario: ClinicalCollectionScenarioKey;
  readonly scenario: ClinicalDecisionScenarioKey;
  readonly patient: { readonly fullName: string; readonly code: string; readonly age: number; readonly mainObjective?: string };
  readonly consultationTypeLabel: string;
  readonly responsibleProfessional: ProfessionalAudit;
  readonly updatedAt: ISODateTime;
  readonly attendanceStatus: string;
  readonly evidences: readonly ClinicalDecisionEvidence[];
  readonly alerts: readonly ClinicalDecisionAlert[];
  readonly pendingItems: readonly ClinicalDecisionPendingItem[];
  readonly reviewPoints: readonly ClinicalDecisionReviewPoint[];
  readonly history: readonly ProfessionalClinicalDecision[];
  readonly permissions: ClinicalDecisionPermissions;
  readonly posturalAssessmentRequired: boolean;
  readonly posturalAssessmentCompleted: boolean;
}

export interface GetClinicalDecisionWorkspaceInput {
  readonly patientId: EntityId;
  readonly attendanceId: EntityId;
  readonly collectionScenario: ClinicalCollectionScenarioKey;
  readonly decisionScenario?: ClinicalDecisionScenarioKey;
}

export interface SaveProfessionalDecisionInput {
  readonly workspace: ClinicalDecisionWorkspace;
  readonly decision: Omit<ProfessionalClinicalDecision, "id" | "patientId" | "professionalId" | "professionalName" | "createdAt" | "status">;
}

export interface ClinicalDecisionScenario {
  readonly key: ClinicalDecisionScenarioKey;
  readonly label: string;
  readonly description: string;
}
