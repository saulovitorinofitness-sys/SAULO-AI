import type { AuditableRecord, BaseEntity, EntityId, ISODateTime, JsonValue } from "../shared";

export type ClinicalReasoningStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
export type ClinicalFindingCategory = "CONDITION" | "NUTRITION" | "BEHAVIOR" | "LIFESTYLE" | "LABORATORY" | "FUNCTIONAL" | "OTHER";
export type ClinicalFindingStatus = "ACTIVE" | "RESOLVED" | "DISMISSED";
export type ClinicalPriorityLevel = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
export type PriorityClassificationSource = "AUTOMATED_SERVICE" | "PROFESSIONAL_OVERRIDE";
export type ClinicalObjectiveType = "PRIMARY" | "SECONDARY";
export type ClinicalObjectiveStatus = "PLANNED" | "ACTIVE" | "ACHIEVED" | "CANCELLED";
export type ClinicalDecisionStatus = "PROPOSED" | "ACCEPTED" | "REVISED" | "CANCELLED";
export type TherapeuticStrategyStatus = "DRAFT" | "ACTIVE" | "REVISED" | "COMPLETED" | "CANCELLED";
export type EvidenceLevel = "HIGH" | "MODERATE" | "LOW" | "VERY_LOW" | "NOT_GRADED";
export type EvidenceType = "GUIDELINE" | "SYSTEMATIC_REVIEW" | "CLINICAL_TRIAL" | "OBSERVATIONAL_STUDY" | "CONSENSUS" | "OTHER";
export type ClinicalEvidenceStatus = "ACTIVE" | "RETIRED";
export type ClinicalAlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";

export interface ClinicalReasoningSession extends AuditableRecord {
  readonly attendanceId: EntityId;
  readonly responsibleProfessionalUserId: EntityId;
  readonly status: ClinicalReasoningStatus;
  readonly openedAt: ISODateTime;
  readonly closedAt?: ISODateTime;
}

export interface ClinicalFinding extends AuditableRecord {
  readonly sessionId: EntityId;
  readonly code: string;
  readonly label: string;
  readonly description?: string;
  readonly category: ClinicalFindingCategory;
  readonly status: ClinicalFindingStatus;
  readonly deduplicationKey: string;
  readonly observedAt: ISODateTime;
  readonly sourceReference?: JsonValue;
}

export interface ClinicalPriority extends BaseEntity {
  readonly findingId: EntityId;
  readonly level: ClinicalPriorityLevel;
  readonly source: PriorityClassificationSource;
  readonly classifiedAt: ISODateTime;
  readonly classifiedForUserId: EntityId;
  readonly version: number;
}

export interface ClinicalObjective extends AuditableRecord {
  readonly sessionId: EntityId;
  readonly type: ClinicalObjectiveType;
  readonly title: string;
  readonly description?: string;
  readonly sequence: number;
  readonly status: ClinicalObjectiveStatus;
  readonly deduplicationKey: string;
}

export interface ClinicalEvidence extends AuditableRecord {
  readonly key: string;
  readonly title: string;
  readonly reference: string;
  readonly type: EvidenceType;
  readonly level: EvidenceLevel;
  readonly status: ClinicalEvidenceStatus;
}

export interface ClinicalDecision extends AuditableRecord {
  readonly sessionId: EntityId;
  readonly statement: string;
  readonly reason: string;
  readonly professionalUserId: EntityId;
  readonly madeAt: ISODateTime;
  readonly evidenceIds: readonly [EntityId, ...EntityId[]];
  readonly status: ClinicalDecisionStatus;
  readonly idempotencyKey: string;
}

export interface TherapeuticStrategy extends AuditableRecord {
  readonly sessionId: EntityId;
  readonly title: string;
  readonly description: string;
  readonly professionalUserId: EntityId;
  readonly definedAt: ISODateTime;
  readonly status: TherapeuticStrategyStatus;
  readonly idempotencyKey: string;
}

export interface ClinicalAlert extends AuditableRecord {
  readonly sessionId: EntityId;
  readonly findingId?: EntityId;
  readonly code: string;
  readonly message: string;
  readonly level: ClinicalPriorityLevel;
  readonly status: ClinicalAlertStatus;
  readonly deduplicationKey: string;
  readonly raisedAt: ISODateTime;
  readonly resolvedAt?: ISODateTime;
}
