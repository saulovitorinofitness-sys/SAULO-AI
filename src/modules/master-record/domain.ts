import type {
  AuthoredEntity,
  AuditableRecord,
  BaseEntity,
  EntityId,
  ISODateTime,
  JsonValue,
  ModuleKey,
  PageRequest,
  PageResult,
} from "../shared";

export type MasterRecordStatus = "ACTIVE" | "ARCHIVED";
export type RecordEntryStatus = "DRAFT" | "FINALIZED" | "SUPERSEDED" | "VOIDED";
export type CanonicalDataCategory = "ANTHROPOMETRIC" | "CLINICAL" | "FUNCTIONAL";
export type ContinuityStatus = "ACTIVE" | "PAUSED" | "COMPLETED";
export type ContinuityStepStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "BLOCKED";
export type ContinuitySuggestionSource = "MANUAL" | "WORKFLOW";

export interface MasterRecord extends AuditableRecord {
  readonly patientId: EntityId;
  readonly status: MasterRecordStatus;
  readonly version: number;
}

export interface MasterRecordEntry extends AuthoredEntity {
  readonly masterRecordId: EntityId;
  readonly moduleKey: ModuleKey;
  readonly attendanceId?: EntityId;
  readonly aggregateId: EntityId;
  readonly type: string;
  readonly status: RecordEntryStatus;
  readonly occurredAt: ISODateTime;
  readonly revision: number;
  readonly lastModifiedByUserId: EntityId;
  readonly payload?: JsonValue;
}

export interface CanonicalDataReference extends BaseEntity {
  readonly masterRecordId: EntityId;
  readonly category: CanonicalDataCategory;
  readonly key: string;
  readonly currentEntryId: EntityId;
  readonly moduleKey: ModuleKey;
  readonly responsibleUserId: EntityId;
  readonly version: number;
}

export interface ContinuityStep extends BaseEntity {
  readonly continuityId: EntityId;
  readonly moduleKey: ModuleKey;
  readonly key: string;
  readonly title: string;
  readonly status: ContinuityStepStatus;
  readonly responsibleUserId?: EntityId;
  readonly completedByUserId?: EntityId;
  readonly completedAt?: ISODateTime;
  readonly version: number;
}

export interface MasterRecordContinuity extends BaseEntity {
  readonly masterRecordId: EntityId;
  readonly status: ContinuityStatus;
  readonly lastCompletedStepKey?: string;
  readonly responsibleUserId?: EntityId;
  readonly lastActivityAt?: ISODateTime;
  readonly nextSuggestedStepKey?: string;
  readonly suggestionSource?: ContinuitySuggestionSource;
  readonly version: number;
  readonly pendingSteps: readonly ContinuityStep[];
}

export interface MasterRecordRepository {
  findByPatientId(patientId: EntityId): Promise<MasterRecord | null>;
  appendEntryVersion(entry: MasterRecordEntry): Promise<void>;
  listEntries(recordId: EntityId, page: PageRequest): Promise<PageResult<MasterRecordEntry>>;
  findCanonicalData(recordId: EntityId, category: CanonicalDataCategory, key: string): Promise<CanonicalDataReference | null>;
  findContinuity(recordId: EntityId): Promise<MasterRecordContinuity | null>;
}
