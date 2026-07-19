import type { EntityId, ISODate, ISODateTime } from "../shared";
import type {
  AdherenceCategory,
  AdherenceClassification,
  AthleteProgressProfile,
  AthleteProgressReferenceType,
  ClinicalEvolutionSession,
  EvolutionAssociatedFactor,
  EvolutionClassification,
  EvolutionComparison,
  EvolutionDimension,
  EvolutionFactorStatus,
  EvolutionFactorType,
  ProtocolDecision,
  ProtocolDecisionType,
  ProtocolHistory,
  ProtocolChange,
  ProtocolStatus,
  ProtocolType,
  TreatmentAdherence,
} from "./domain";

export interface CreateClinicalEvolutionSessionInput {
  readonly patientId: EntityId;
  readonly masterRecordId: EntityId;
  readonly attendanceId: EntityId;
  readonly professionalUserId: EntityId;
  readonly previousSessionId?: EntityId;
  readonly evaluatedAt: ISODateTime;
}

export interface ClinicalEvolutionSessionRepository {
  findById(id: EntityId): Promise<ClinicalEvolutionSession | null>;
  findByAttendanceId(attendanceId: EntityId): Promise<ClinicalEvolutionSession | null>;
  findLatestByMasterRecordId(masterRecordId: EntityId): Promise<ClinicalEvolutionSession | null>;
  create(input: CreateClinicalEvolutionSessionInput): Promise<ClinicalEvolutionSession>;
}

export interface EvolutionComparisonDraft {
  readonly dimension: EvolutionDimension;
  readonly comparisonKey: string;
  readonly currentEntryId?: EntityId;
  readonly previousEntryId?: EntityId;
  readonly classification: EvolutionClassification;
  readonly classifiedAt: ISODateTime;
}

export interface EvolutionComparisonRepository {
  createMany(sessionId: EntityId, professionalUserId: EntityId, drafts: readonly EvolutionComparisonDraft[]): Promise<readonly EvolutionComparison[]>;
  listBySessionId(sessionId: EntityId): Promise<readonly EvolutionComparison[]>;
}

export interface TreatmentAdherenceItemDraft {
  readonly category: AdherenceCategory;
  readonly percentage?: number;
  readonly classification: AdherenceClassification;
  readonly observations?: string;
  readonly sourceEntryId?: EntityId;
}

export interface TreatmentAdherenceRepository {
  findBySessionId(sessionId: EntityId): Promise<TreatmentAdherence | null>;
  create(sessionId: EntityId, professionalUserId: EntityId, recordedAt: ISODateTime, items: readonly TreatmentAdherenceItemDraft[]): Promise<TreatmentAdherence>;
}

export interface RegisterProtocolHistoryInput {
  readonly masterRecordId: EntityId;
  readonly evolutionSessionId: EntityId;
  readonly strategyId?: EntityId;
  readonly professionalUserId: EntityId;
  readonly protocolKey: string;
  readonly name: string;
  readonly type: ProtocolType;
  readonly startedAt: ISODate;
  readonly endedAt?: ISODate;
  readonly choiceReason: string;
  readonly responseEntryId?: EntityId;
  readonly responseNotes?: string;
  readonly status: ProtocolStatus;
}

export interface ProtocolHistoryRepository {
  findById(id: EntityId): Promise<ProtocolHistory | null>;
  findByKey(masterRecordId: EntityId, protocolKey: string): Promise<ProtocolHistory | null>;
  register(input: RegisterProtocolHistoryInput): Promise<ProtocolHistory>;
  appendChange(input: AppendProtocolChangeRecord): Promise<ProtocolChange>;
}

export interface AppendProtocolChangeRecord {
  readonly protocolHistoryId: EntityId;
  readonly professionalUserId: EntityId;
  readonly description: string;
  readonly reason: string;
  readonly responseEntryId?: EntityId;
  readonly changedAt: ISODateTime;
}

export interface RecordProtocolDecisionInput {
  readonly evolutionSessionId: EntityId;
  readonly protocolHistoryId?: EntityId;
  readonly professionalUserId: EntityId;
  readonly type: ProtocolDecisionType;
  readonly decidedAt: ISODateTime;
  readonly justification: string;
  readonly evidenceIds: readonly [EntityId, ...EntityId[]];
  readonly idempotencyKey: string;
  readonly nutritionExclusive: boolean;
}

export interface ProtocolDecisionRepository {
  findByIdempotencyKey(sessionId: EntityId, key: string): Promise<ProtocolDecision | null>;
  recordWithEvidence(input: RecordProtocolDecisionInput): Promise<ProtocolDecision>;
}

export interface EvolutionFactorDraft {
  readonly type: EvolutionFactorType;
  readonly status: EvolutionFactorStatus;
  readonly notes?: string;
  readonly sourceEntryId?: EntityId;
  readonly deduplicationKey: string;
}

export interface EvolutionAssociatedFactorRepository {
  createMany(sessionId: EntityId, professionalUserId: EntityId, recordedAt: ISODateTime, factors: readonly EvolutionFactorDraft[]): Promise<readonly EvolutionAssociatedFactor[]>;
}

export interface AthleteProgressReferenceDraft {
  readonly type: AthleteProgressReferenceType;
  readonly sourceEntryId: EntityId;
  readonly recordedAt: ISODateTime;
}

export interface AthleteProgressProfileRepository {
  findByMasterRecordId(masterRecordId: EntityId): Promise<AthleteProgressProfile | null>;
  createOrAppendReferences(masterRecordId: EntityId, professionalUserId: EntityId, references: readonly AthleteProgressReferenceDraft[]): Promise<AthleteProgressProfile>;
}
