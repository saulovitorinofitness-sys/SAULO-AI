import type { NutritionClinicalFlowStep } from "@/features/nutrition-clinical-flow";

import type { NutritionReturnAnamnesisSaveMode } from "./contracts";

export interface AttendanceAnamnesisKind {
  readonly clinicalType?: string | null;
  readonly consultationType?: string | null;
}

export function isNutritionReturnAttendance(
  attendance: AttendanceAnamnesisKind,
) {
  return (
    attendance.clinicalType === "RETURN" ||
    (attendance.clinicalType == null &&
      attendance.consultationType === "FOLLOW_UP")
  );
}

export function flowForAttendanceAnamnesis(
  flow: readonly NutritionClinicalFlowStep[],
  attendance: AttendanceAnamnesisKind,
) {
  return isNutritionReturnAttendance(attendance)
    ? flow.filter((step) => step.id !== "PATIENT_REGISTRATION")
    : flow;
}

export function returnAnamnesisEntryStatus(
  saveMode: NutritionReturnAnamnesisSaveMode,
) {
  return saveMode === "COMPLETE" ? "FINALIZED" : "DRAFT";
}
