import type { EntityId, ISODateTime, JsonValue, ModuleKey } from "../shared";
import type {
  Attendance,
  AttendanceClinicalSummary,
  AttendancePendingCheck,
  AttendanceStage,
  AttendanceStatus,
  AttendanceTimelineEvent,
  AttendanceTimelineEventType,
  ConsultationType,
} from "./domain";

export interface TimelineEventDraft {
  readonly type: AttendanceTimelineEventType;
  readonly sequence: number;
  readonly occurredAt: ISODateTime;
  readonly payload?: JsonValue;
}

export interface CreateIntelligentAttendanceInput {
  readonly masterRecordId: EntityId;
  readonly appointmentId?: EntityId;
  readonly professionalUserId: EntityId;
  readonly consultationType: ConsultationType;
  readonly currentStage: AttendanceStage;
  readonly status: AttendanceStatus;
  readonly idempotencyKey: string;
  readonly receivedAt: ISODateTime;
  readonly startedAt: ISODateTime;
  readonly continuityId: EntityId;
  readonly continuityVersion: number;
  readonly pendingStepIds: readonly EntityId[];
  readonly masterRecordVersion: number;
  readonly summaryEntryIds: readonly EntityId[];
  readonly timeline: readonly TimelineEventDraft[];
}

export interface IntelligentAttendanceAggregate {
  readonly attendance: Attendance;
  readonly timeline: readonly AttendanceTimelineEvent[];
  readonly pendingCheck: AttendancePendingCheck;
  readonly clinicalSummary: AttendanceClinicalSummary;
}

export interface AppendActivityInput {
  readonly moduleKey: ModuleKey;
  readonly actorUserId: EntityId;
  readonly occurredAt: ISODateTime;
  readonly referenceType: string;
  readonly referenceId: EntityId;
}

export interface AttendanceRepository {
  findById(id: EntityId): Promise<Attendance | null>;
  findByAppointmentId(appointmentId: EntityId): Promise<Attendance | null>;
  findAggregateByIdempotencyKey(idempotencyKey: string): Promise<IntelligentAttendanceAggregate | null>;
  createIntelligentAttendance(input: CreateIntelligentAttendanceInput): Promise<IntelligentAttendanceAggregate>;
}

export interface AttendanceTimelineRepository {
  appendActivity(attendanceId: EntityId, activity: AppendActivityInput): Promise<AttendanceTimelineEvent>;
  listChronologically(attendanceId: EntityId): Promise<readonly AttendanceTimelineEvent[]>;
}
