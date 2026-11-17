import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { Prisma } from "@/generated/prisma/client";
import { upsertClinicalReturn } from "@/features/scheduling/clinical-return";

import {
  planClinicalAttendance,
  resolvePatientClinicalStatus,
  type AttendanceSummary,
} from "./attendance-rules";

const completed: AttendanceSummary = {
  id: "attendance-previous",
  status: "COMPLETED",
  clinicalCycleId: "11111111-1111-1111-1111-111111111111",
  clinicalCycleSequence: 2,
};

test("status verdadeiro diferencia paciente sem atendimento, aberto e concluído", () => {
  assert.equal(resolvePatientClinicalStatus({ attendances: [], hasScheduledReturn: false }), "NO_ATTENDANCE");
  assert.equal(resolvePatientClinicalStatus({ attendances: [{ ...completed, status: "DRAFT" }], hasScheduledReturn: false }), "PREPARED");
  assert.equal(resolvePatientClinicalStatus({ attendances: [{ ...completed, status: "IN_PROGRESS" }], hasScheduledReturn: false }), "IN_PROGRESS");
  assert.equal(resolvePatientClinicalStatus({ attendances: [completed], hasScheduledReturn: false }), "COMPLETED");
  assert.equal(resolvePatientClinicalStatus({ attendances: [completed], hasScheduledReturn: true }), "RETURN_SCHEDULED");
});

test("atendimento concluído nunca é tratado como atendimento aberto", () => {
  const plan = planClinicalAttendance([completed], "RETURN", "new-cycle");
  assert.equal(plan.openAttendanceId, undefined);
  assert.equal(plan.previousAttendanceId, completed.id);
});

test("segundo atendimento aberto é bloqueado e aponta para o existente", () => {
  const plan = planClinicalAttendance(
    [{ ...completed, id: "open", status: "DRAFT" }],
    "SINGLE_CONSULTATION",
    "new-cycle",
  );
  assert.equal(plan.openAttendanceId, "open");
});

test("retorno preserva atendimento anterior e continua o ciclo", () => {
  const plan = planClinicalAttendance([completed], "RETURN", "new-cycle");
  assert.equal(plan.previousAttendanceId, completed.id);
  assert.equal(plan.clinicalCycleId, completed.clinicalCycleId);
  assert.equal(plan.clinicalCycleSequence, 3);
});

test("reavaliação cria novo ciclo sem sobrescrever o atendimento anterior", () => {
  const plan = planClinicalAttendance([completed], "REASSESSMENT", "new-cycle");
  assert.equal(plan.previousAttendanceId, completed.id);
  assert.equal(plan.clinicalCycleId, "new-cycle");
  assert.equal(plan.clinicalCycleSequence, 1);
});

test("primeira consulta é recusada quando já existe histórico", () => {
  assert.throws(
    () => planClinicalAttendance([completed], "FIRST_CONSULTATION", "new-cycle"),
    /FIRST_CONSULTATION_NOT_ALLOWED/,
  );
});

test("retorno usa upsert estável e reagendamento não duplica compromisso", async () => {
  const writes: Array<Record<string, unknown>> = [];
  let existing: { id: string; startsAt: Date; endsAt: Date; status: "SCHEDULED" } | null = null;
  const transaction = {
    attendance: {
      findUnique: async () => ({
        id: completed.id,
        masterRecordId: "master-1",
        professionalUserId: "user-1",
        masterRecord: { patientId: "patient-1" },
      }),
    },
    systemModule: { findFirst: async () => ({ id: "module-1" }) },
    appointment: {
      findUnique: async () => existing,
      upsert: async (operation: Record<string, unknown>) => {
        writes.push(operation);
        return { id: "appointment-1" };
      },
    },
  } as unknown as Prisma.TransactionClient;

  await upsertClinicalReturn(transaction, {
    attendanceId: completed.id,
    actorUserId: "user-1",
    returnPlan: { date: "2026-11-10", clinicalType: "RETURN" },
  });
  const create = writes[0].create as Record<string, unknown>;
  assert.equal(create.deduplicationKey, `clinical-return:${completed.id}`);
  assert.equal((writes[0].where as Record<string, unknown>).sourceAttendanceId, completed.id);

  existing = {
    id: "appointment-1",
    startsAt: new Date("2026-11-10T12:00:00.000Z"),
    endsAt: new Date("2026-11-10T13:00:00.000Z"),
    status: "SCHEDULED",
  };
  await upsertClinicalReturn(transaction, {
    attendanceId: completed.id,
    actorUserId: "user-1",
    returnPlan: { date: "2026-11-12", clinicalType: "RETURN" },
  });
  assert.equal(writes.length, 2);
  assert.equal((writes[1].update as Record<string, unknown>).status, "RESCHEDULED");
});

test("modal abre o novo atendimento no Prontuário Mestre e oculta primeira consulta com histórico", async () => {
  const source = await readFile(
    new URL("../../components/patients/new-attendance-dialog.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /router\.push\(`\/pacientes\/\$\{encodeURIComponent\(patientId\)\}`\)/);
  assert.match(source, /option\.value !== "FIRST_CONSULTATION"/);
});

test("agenda preserva cancelamento e marca reagendamento clínico", async () => {
  const source = await readFile(
    new URL("../scheduling/repository.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /input\.status !== "CANCELLED"/);
  assert.match(source, /\? "RESCHEDULED"/);
  assert.doesNotMatch(source, /appointment\.delete/);
});

test("lista compacta não mostra percentual, pendências ou objetivo clínico", async () => {
  const source = await readFile(
    new URL("../../components/patients/patient-list.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /completionPercentage|etapas pendentes|Objetivo clínico/);
  assert.match(source, /Abrir prontuário/);
  assert.match(source, /Continuar atendimento/);
  assert.match(source, /AttendanceStateActions/);
  assert.match(source, /openAttendanceStatus === "DRAFT"/);
  assert.match(source, /NewAttendanceDialog/);
});
