import type { Prisma } from "@/generated/prisma/client";

export interface ClinicalReturnInput {
  readonly date: string;
  readonly time?: string;
  readonly clinicalType: "RETURN" | "REASSESSMENT" | "FOLLOW_UP";
  readonly notes?: string;
  readonly durationMinutes?: number;
}

export async function upsertClinicalReturn(
  transaction: Prisma.TransactionClient,
  input: {
    attendanceId: string;
    actorUserId: string;
    returnPlan: ClinicalReturnInput;
  },
) {
  const attendance = await transaction.attendance.findUnique({
    where: { id: input.attendanceId },
    select: {
      id: true,
      masterRecordId: true,
      professionalUserId: true,
      masterRecord: { select: { patientId: true } },
    },
  });
  if (!attendance) throw new Error("ATTENDANCE_NOT_FOUND");

  const schedulingModule = await transaction.systemModule.findFirst({
    where: { key: "SCHEDULING", active: true },
    select: { id: true },
  });
  if (!schedulingModule) throw new Error("SCHEDULING_MODULE_NOT_FOUND");

  const time = input.returnPlan.time || "09:00";
  const startsAt = new Date(`${input.returnPlan.date}T${time}:00-03:00`);
  const durationMinutes = input.returnPlan.durationMinutes ?? 60;
  if (!Number.isFinite(startsAt.getTime()) || durationMinutes <= 0) {
    throw new Error("INVALID_RETURN_PERIOD");
  }
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const existing = await transaction.appointment.findUnique({
    where: { sourceAttendanceId: attendance.id },
    select: { id: true, startsAt: true, endsAt: true, status: true },
  });
  const changed = Boolean(
    existing &&
      (existing.startsAt.getTime() !== startsAt.getTime() ||
        existing.endsAt.getTime() !== endsAt.getTime()),
  );

  return transaction.appointment.upsert({
    where: { sourceAttendanceId: attendance.id },
    update: {
      patientId: attendance.masterRecord.patientId,
      masterRecordId: attendance.masterRecordId,
      professionalUserId: attendance.professionalUserId,
      updatedByUserId: input.actorUserId,
      clinicalType: input.returnPlan.clinicalType,
      origin: "CLINICAL_RETURN",
      startsAt,
      endsAt,
      estimatedDurationMinutes: durationMinutes,
      status: changed ? "RESCHEDULED" : existing?.status,
      notes: input.returnPlan.notes,
      version: { increment: 1 },
    },
    create: {
      patientId: attendance.masterRecord.patientId,
      masterRecordId: attendance.masterRecordId,
      sourceAttendanceId: attendance.id,
      professionalUserId: attendance.professionalUserId,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
      moduleId: schedulingModule.id,
      clinicalType: input.returnPlan.clinicalType,
      origin: "CLINICAL_RETURN",
      startsAt,
      endsAt,
      estimatedDurationMinutes: durationMinutes,
      status: "SCHEDULED",
      notes: input.returnPlan.notes,
      deduplicationKey: `clinical-return:${attendance.id}`,
    },
  });
}
