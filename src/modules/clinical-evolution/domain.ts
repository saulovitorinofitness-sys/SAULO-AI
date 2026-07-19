import type { AuditableRecord, BaseEntity, EntityId, ISODate, ISODateTime } from "../shared";

export type ClinicalEvolutionStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
export type EvolutionClassification = "PROGRESS" | "PARTIAL_PROGRESS" | "STABLE" | "REGRESSION" | "PLATEAU" | "INSUFFICIENT_DATA";
export type EvolutionDimension =
  | "WEIGHT"
  | "BODY_COMPOSITION"
  | "PERIMETRY"
  | "BIOIMPEDANCE"
  | "PHYSICAL_ASSESSMENT"
  | "POSTURAL_ASSESSMENT"
  | "SYMPTOMS"
  | "LABORATORY_EXAMS"
  | "TRAINING_PERFORMANCE"
  | "DIETARY_ADHERENCE"
  | "TRAINING_ADHERENCE"
  | "HYDRATION"
  | "SLEEP"
  | "SUPPLEMENTATION";
export type AdherenceCategory = "DIETARY" | "TRAINING" | "CARDIO" | "HYDRATION" | "SLEEP" | "SUPPLEMENTATION" | "OVERALL";
export type AdherenceClassification = "EXCELLENT" | "GOOD" | "PARTIAL" | "LOW" | "NONE" | "NOT_EVALUATED";
export type ProtocolType = "NUTRITION" | "TRAINING" | "CARDIO" | "RECOVERY" | "MULTIDISCIPLINARY" | "OTHER";
export type ProtocolStatus = "PLANNED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" | "REPLACED";
export type ProtocolDecisionType = "MAINTAIN" | "MINOR_ADJUSTMENT" | "PARTIAL_CHANGE" | "COMPLETE_CHANGE" | "PAUSE" | "REQUEST_MORE_DATA" | "REFER_TO_ANOTHER_PROFESSIONAL";
export type EvolutionFactorType =
  | "INSUFFICIENT_ADHERENCE"
  | "INADEQUATE_ENERGY_INTAKE"
  | "INADEQUATE_ENERGY_EXPENDITURE"
  | "ROUTINE_CHANGE"
  | "INADEQUATE_SLEEP"
  | "STRESS"
  | "MEDICATION_USE"
  | "FLUID_RETENTION"
  | "MUSCLE_MASS_CHANGE"
  | "CLINICAL_CONDITION"
  | "ALTERED_EXAMS"
  | "PHYSICAL_LIMITATION"
  | "OTHER";
export type EvolutionFactorStatus = "REPORTED" | "OBSERVED" | "UNDER_REVIEW" | "DISMISSED";
export type AthleteProfileStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type AthleteProgressReferenceType =
  | "PREPARATION_PHASE"
  | "COMPETITIVE_PERIOD"
  | "PERFORMANCE"
  | "TRAINING_VOLUME_INTENSITY"
  | "RECOVERY"
  | "BODY_COMPOSITION"
  | "PROTOCOL_RESPONSE"
  | "PROGRESSION"
  | "REGRESSION";

export interface ClinicalEvolutionSession extends AuditableRecord {
  readonly patientId: EntityId;
  readonly masterRecordId: EntityId;
  readonly attendanceId: EntityId;
  readonly professionalUserId: EntityId;
  readonly previousSessionId?: EntityId;
  readonly classification?: EvolutionClassification;
  readonly status: ClinicalEvolutionStatus;
  readonly evaluatedAt: ISODateTime;
  readonly completedAt?: ISODateTime;
}

export interface EvolutionComparison extends BaseEntity {
  readonly sessionId: EntityId;
  readonly dimension: EvolutionDimension;
  readonly comparisonKey: string;
  readonly currentEntryId?: EntityId;
  readonly previousEntryId?: EntityId;
  readonly classification: EvolutionClassification;
  readonly classifiedAt: ISODateTime;
  readonly version: number;
}

export interface TreatmentAdherence extends AuditableRecord {
  readonly sessionId: EntityId;
  readonly professionalUserId: EntityId;
  readonly status: ClinicalEvolutionStatus;
  readonly recordedAt: ISODateTime;
  readonly items: readonly TreatmentAdherenceItem[];
}

export interface TreatmentAdherenceItem extends BaseEntity {
  readonly adherenceId: EntityId;
  readonly category: AdherenceCategory;
  readonly percentage?: number;
  readonly classification: AdherenceClassification;
  readonly observations?: string;
  readonly sourceEntryId?: EntityId;
  readonly version: number;
}

export interface ProtocolHistory extends AuditableRecord {
  readonly masterRecordId: EntityId;
  readonly evolutionSessionId: EntityId;
  readonly strategyId?: EntityId;
  readonly protocolKey: string;
  readonly name: string;
  readonly type: ProtocolType;
  readonly startedAt: ISODate;
  readonly endedAt?: ISODate;
  readonly professionalUserId: EntityId;
  readonly choiceReason: string;
  readonly responseEntryId?: EntityId;
  readonly responseNotes?: string;
  readonly status: ProtocolStatus;
  readonly changes: readonly ProtocolChange[];
}

export interface ProtocolChange extends BaseEntity {
  readonly protocolHistoryId: EntityId;
  readonly professionalUserId: EntityId;
  readonly description: string;
  readonly reason: string;
  readonly responseEntryId?: EntityId;
  readonly changedAt: ISODateTime;
  readonly version: number;
}

export interface ProtocolDecision extends AuditableRecord {
  readonly evolutionSessionId: EntityId;
  readonly protocolHistoryId?: EntityId;
  readonly type: ProtocolDecisionType;
  readonly professionalUserId: EntityId;
  readonly decidedAt: ISODateTime;
  readonly justification: string;
  readonly evidenceIds: readonly [EntityId, ...EntityId[]];
  readonly idempotencyKey: string;
  readonly status: ClinicalEvolutionStatus;
}

export interface EvolutionAssociatedFactor extends AuditableRecord {
  readonly evolutionSessionId: EntityId;
  readonly type: EvolutionFactorType;
  readonly status: EvolutionFactorStatus;
  readonly notes?: string;
  readonly sourceEntryId?: EntityId;
  readonly deduplicationKey: string;
  readonly recordedAt: ISODateTime;
}

export interface AthleteProgressProfile extends AuditableRecord {
  readonly masterRecordId: EntityId;
  readonly professionalUserId: EntityId;
  readonly status: AthleteProfileStatus;
  readonly references: readonly AthleteProgressReference[];
}

export interface AthleteProgressReference extends BaseEntity {
  readonly profileId: EntityId;
  readonly type: AthleteProgressReferenceType;
  readonly sourceEntryId: EntityId;
  readonly recordedAt: ISODateTime;
  readonly version: number;
}
