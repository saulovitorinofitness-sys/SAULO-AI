import type { AttendanceStage, AttendanceStatus } from "@/modules/attendance";

export interface AttendanceStateTransition {
  readonly status: AttendanceStatus;
  readonly currentStage: AttendanceStage;
  readonly startedAt?: Date | null;
  readonly endedAt?: Date | null;
}

export function preparedAttendanceState(): AttendanceStateTransition {
  return {
    status: "DRAFT",
    currentStage: "READY",
    startedAt: null,
    endedAt: null,
  };
}

export function startedAttendanceState(
  currentStatus: AttendanceStatus,
  occurredAt: Date,
): AttendanceStateTransition {
  if (currentStatus !== "DRAFT") throw new Error("ATTENDANCE_NOT_PREPARED");
  return {
    status: "IN_PROGRESS",
    currentStage: "IN_PROGRESS",
    startedAt: occurredAt,
    endedAt: null,
  };
}

export function completedAttendanceState(
  currentStatus: AttendanceStatus,
  occurredAt: Date,
  hasClinicalRecords: boolean,
  closureObservation?: string,
): AttendanceStateTransition {
  validateAttendanceCompletion(currentStatus, hasClinicalRecords, closureObservation);
  return {
    status: "COMPLETED",
    currentStage: "COMPLETED",
    endedAt: occurredAt,
  };
}

export function validateAttendanceCompletion(
  currentStatus: AttendanceStatus,
  hasClinicalRecords: boolean,
  closureObservation?: string,
) {
  if (currentStatus !== "IN_PROGRESS") throw new Error("ATTENDANCE_NOT_FINALIZABLE");
  if (!hasClinicalRecords && (closureObservation?.trim().length ?? 0) < 10) {
    throw new Error("ATTENDANCE_EMPTY_CLOSURE_JUSTIFICATION_REQUIRED");
  }
}

export function cancelledPreparedAttendanceState(
  currentStatus: AttendanceStatus,
  occurredAt: Date,
): AttendanceStateTransition {
  if (currentStatus !== "DRAFT") throw new Error("ATTENDANCE_NOT_CANCELLABLE");
  return {
    status: "CANCELLED",
    currentStage: "CANCELLED",
    startedAt: null,
    endedAt: occurredAt,
  };
}
