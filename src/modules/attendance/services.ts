import type { EntityId, ISODateTime, ModuleKey } from "../shared";
import type { ConsultationType } from "./domain";

export interface ProfessionalContextService {
  currentProfessionalUserId(): Promise<EntityId>;
}

export interface ClockService {
  now(): ISODateTime;
}

export interface AttendanceAuthorizationService {
  assertCanStart(professionalUserId: EntityId, consultationType: ConsultationType): Promise<void>;
  assertCanRecordActivity(professionalUserId: EntityId, attendanceId: EntityId, moduleKey: ModuleKey): Promise<void>;
}

export interface PendingCheckResult {
  readonly continuityId: EntityId;
  readonly continuityVersion: number;
  readonly pendingStepIds: readonly EntityId[];
}

export interface PendingVerificationService {
  verify(masterRecordId: EntityId): Promise<PendingCheckResult>;
}

export interface ClinicalSummaryResult {
  readonly masterRecordVersion: number;
  readonly entryIds: readonly EntityId[];
}

export interface ClinicalSummaryService {
  prepare(masterRecordId: EntityId): Promise<ClinicalSummaryResult>;
}
