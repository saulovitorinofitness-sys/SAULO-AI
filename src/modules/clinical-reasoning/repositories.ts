import type { EntityId, ISODateTime, JsonValue } from "../shared";
import type {
  ClinicalDecision,
  ClinicalEvidence,
  ClinicalAlert,
  ClinicalPriorityLevel,
  ClinicalAlertStatus,
  EvidenceLevel,
  EvidenceType,
  ClinicalFinding,
  ClinicalFindingCategory,
  ClinicalObjective,
  ClinicalObjectiveType,
  ClinicalPriority,
  ClinicalReasoningSession,
  TherapeuticStrategy,
} from "./domain";

export interface CreateClinicalReasoningSessionInput {
  readonly attendanceId: EntityId;
  readonly professionalUserId: EntityId;
  readonly openedAt: ISODateTime;
}

export interface ClinicalReasoningSessionRepository {
  findById(id: EntityId): Promise<ClinicalReasoningSession | null>;
  findByAttendanceId(attendanceId: EntityId): Promise<ClinicalReasoningSession | null>;
  create(input: CreateClinicalReasoningSessionInput): Promise<ClinicalReasoningSession>;
}

export interface CreateClinicalFindingInput {
  readonly sessionId: EntityId;
  readonly professionalUserId: EntityId;
  readonly code: string;
  readonly label: string;
  readonly description?: string;
  readonly category: ClinicalFindingCategory;
  readonly deduplicationKey: string;
  readonly observedAt: ISODateTime;
  readonly sourceReference?: JsonValue;
  readonly priorityLevel: ClinicalPriorityLevel;
}

export interface FindingWithPriority {
  readonly finding: ClinicalFinding;
  readonly priority: ClinicalPriority;
}

export interface ClinicalFindingRepository {
  findByDeduplicationKey(sessionId: EntityId, key: string): Promise<FindingWithPriority | null>;
  createWithPriority(input: CreateClinicalFindingInput): Promise<FindingWithPriority>;
}

export interface CreateClinicalObjectiveInput {
  readonly sessionId: EntityId;
  readonly professionalUserId: EntityId;
  readonly type: ClinicalObjectiveType;
  readonly title: string;
  readonly description?: string;
  readonly sequence: number;
  readonly deduplicationKey: string;
  readonly createdAt: ISODateTime;
}

export interface ClinicalObjectiveRepository {
  create(input: CreateClinicalObjectiveInput): Promise<ClinicalObjective>;
  createMany(inputs: readonly CreateClinicalObjectiveInput[]): Promise<readonly ClinicalObjective[]>;
}

export interface ClinicalEvidenceRepository {
  findByKey(key: string): Promise<ClinicalEvidence | null>;
  findByIds(ids: readonly EntityId[]): Promise<readonly ClinicalEvidence[]>;
  register(input: RegisterClinicalEvidenceRecord): Promise<ClinicalEvidence>;
}

export interface RegisterClinicalEvidenceRecord {
  readonly professionalUserId: EntityId;
  readonly key: string;
  readonly title: string;
  readonly reference: string;
  readonly type: EvidenceType;
  readonly level: EvidenceLevel;
  readonly registeredAt: ISODateTime;
}

export interface CreateClinicalDecisionInput {
  readonly sessionId: EntityId;
  readonly professionalUserId: EntityId;
  readonly statement: string;
  readonly reason: string;
  readonly evidenceIds: readonly [EntityId, ...EntityId[]];
  readonly idempotencyKey: string;
  readonly madeAt: ISODateTime;
}

export interface ClinicalDecisionRepository {
  findByIdempotencyKey(sessionId: EntityId, key: string): Promise<ClinicalDecision | null>;
  createWithEvidence(input: CreateClinicalDecisionInput): Promise<ClinicalDecision>;
}

export interface DefineTherapeuticStrategyRecord {
  readonly sessionId: EntityId;
  readonly professionalUserId: EntityId;
  readonly title: string;
  readonly description: string;
  readonly idempotencyKey: string;
  readonly definedAt: ISODateTime;
}

export interface TherapeuticStrategyRepository {
  findByIdempotencyKey(sessionId: EntityId, key: string): Promise<TherapeuticStrategy | null>;
  define(input: DefineTherapeuticStrategyRecord): Promise<TherapeuticStrategy>;
}

export interface RaiseClinicalAlertRecord {
  readonly sessionId: EntityId;
  readonly findingId?: EntityId;
  readonly professionalUserId: EntityId;
  readonly code: string;
  readonly message: string;
  readonly level: ClinicalPriorityLevel;
  readonly status: ClinicalAlertStatus;
  readonly deduplicationKey: string;
  readonly raisedAt: ISODateTime;
}

export interface ClinicalAlertRepository {
  findByDeduplicationKey(sessionId: EntityId, key: string): Promise<ClinicalAlert | null>;
  raise(input: RaiseClinicalAlertRecord): Promise<ClinicalAlert>;
}
