import type { ClinicalAttendanceTypeInput } from "./contracts";

export interface AttendanceSummary {
  readonly id: string;
  readonly status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  readonly clinicalCycleId: string | null;
  readonly clinicalCycleSequence: number | null;
}

export function resolvePatientClinicalStatus(input: {
  readonly attendances: readonly Pick<AttendanceSummary, "status">[];
  readonly hasScheduledReturn: boolean;
}) {
  if (input.attendances.some((item) => item.status === "IN_PROGRESS")) return "IN_PROGRESS" as const;
  if (input.attendances.some((item) => item.status === "DRAFT")) return "PREPARED" as const;
  if (input.hasScheduledReturn) return "RETURN_SCHEDULED" as const;
  if (input.attendances.some((item) => item.status === "COMPLETED")) return "COMPLETED" as const;
  return "NO_ATTENDANCE" as const;
}

export function planClinicalAttendance(
  attendances: readonly AttendanceSummary[],
  clinicalType: ClinicalAttendanceTypeInput,
  newCycleId: string,
) {
  const open = attendances.find((item) => item.status === "DRAFT" || item.status === "IN_PROGRESS");
  if (open) return { openAttendanceId: open.id } as const;

  const previous = attendances.find((item) => item.status === "COMPLETED");
  if (clinicalType === "FIRST_CONSULTATION" && attendances.length) throw new Error("FIRST_CONSULTATION_NOT_ALLOWED");
  if (["RETURN", "REASSESSMENT", "FOLLOW_UP"].includes(clinicalType) && !previous) throw new Error("PREVIOUS_ATTENDANCE_REQUIRED");

  const continuesCycle = clinicalType === "RETURN" || clinicalType === "FOLLOW_UP";
  return {
    openAttendanceId: undefined,
    previousAttendanceId: clinicalType === "SINGLE_CONSULTATION" ? undefined : previous?.id,
    clinicalCycleId: continuesCycle && previous?.clinicalCycleId ? previous.clinicalCycleId : newCycleId,
    clinicalCycleSequence: continuesCycle && previous ? (previous.clinicalCycleSequence ?? 0) + 1 : 1,
    consultationType:
      clinicalType === "FIRST_CONSULTATION"
        ? "INITIAL"
        : clinicalType === "REASSESSMENT"
          ? "PHYSICAL_ASSESSMENT"
          : "FOLLOW_UP",
  } as const;
}
