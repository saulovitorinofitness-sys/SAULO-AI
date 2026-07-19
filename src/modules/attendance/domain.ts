import type { AuditableRecord, BaseEntity, EntityId, ISODateTime, JsonValue, ModuleKey } from "../shared";

export type AttendanceStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type ConsultationType =
  | "INITIAL"
  | "FOLLOW_UP"
  | "PHYSICAL_ASSESSMENT"
  | "POSTURAL_ASSESSMENT"
  | "TRAINING"
  | "NUTRITION";

export type AttendanceStage =
  | "RECEPTION"
  | "MASTER_RECORD_LOADING"
  | "PENDING_CHECK"
  | "CLINICAL_SUMMARY"
  | "CONSULTATION_TYPE"
  | "READY"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type AttendanceTimelineEventType =
  | "PATIENT_RECEIVED"
  | "MASTER_RECORD_LOADED"
  | "PENDENCIES_VERIFIED"
  | "CLINICAL_SUMMARY_PREPARED"
  | "CONSULTATION_TYPE_RECORDED"
  | "ATTENDANCE_STARTED"
  | "ACTIVITY_RECORDED"
  | "ATTENDANCE_COMPLETED"
  | "ATTENDANCE_CANCELLED";

export type AttendanceTimelineStatus = "RECORDED" | "VOIDED";
export type AttendancePreparationStatus = "READY" | "STALE" | "VOIDED";

export interface Attendance extends AuditableRecord {
  readonly masterRecordId: EntityId;
  readonly appointmentId?: EntityId;
  readonly professionalUserId: EntityId;
  readonly consultationType: ConsultationType;
  readonly currentStage: AttendanceStage;
  readonly idempotencyKey: string;
  readonly status: AttendanceStatus;
  readonly receivedAt: ISODateTime;
  readonly startedAt?: ISODateTime;
  readonly endedAt?: ISODateTime;
  readonly context?: JsonValue;
}

export interface AttendanceTimelineEvent extends BaseEntity {
  readonly attendanceId: EntityId;
  readonly moduleKey: ModuleKey;
  readonly actorUserId: EntityId;
  readonly type: AttendanceTimelineEventType;
  readonly status: AttendanceTimelineStatus;
  readonly sequence: number;
  readonly occurredAt: ISODateTime;
  readonly version: number;
  readonly payload?: JsonValue;
}

export interface AttendancePendingCheck extends BaseEntity {
  readonly attendanceId: EntityId;
  readonly continuityId: EntityId;
  readonly performedByUserId: EntityId;
  readonly continuityVersion: number;
  readonly pendingStepIds: readonly EntityId[];
  readonly status: AttendancePreparationStatus;
  readonly version: number;
}

export interface AttendanceClinicalSummary extends BaseEntity {
  readonly attendanceId: EntityId;
  readonly generatedByUserId: EntityId;
  readonly masterRecordVersion: number;
  readonly entryIds: readonly EntityId[];
  readonly status: AttendancePreparationStatus;
  readonly version: number;
}
