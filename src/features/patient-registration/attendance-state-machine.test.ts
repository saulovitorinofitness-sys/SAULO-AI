import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  cancelledPreparedAttendanceState,
  completedAttendanceState,
  preparedAttendanceState,
  startedAttendanceState,
} from "./attendance-state-machine";

const occurredAt = new Date("2026-10-06T12:00:00.000Z");

test("cria atendimento como DRAFT preparado e sem início clínico", () => {
  assert.deepEqual(preparedAttendanceState(), {
    status: "DRAFT",
    currentStage: "READY",
    startedAt: null,
    endedAt: null,
  });
});

test("persistência de criação não grava ATTENDANCE_STARTED", async () => {
  const source = await readFile(new URL("./repository.ts", import.meta.url), "utf8");
  const creation = source.slice(
    source.indexOf("async createClinicalAttendance"),
    source.indexOf("async startClinicalAttendance"),
  );
  assert.match(creation, /preparedAttendanceState\(\)/);
  assert.doesNotMatch(creation, /ATTENDANCE_STARTED/);
});

test("somente início explícito transforma DRAFT em IN_PROGRESS", () => {
  assert.deepEqual(startedAttendanceState("DRAFT", occurredAt), {
    status: "IN_PROGRESS",
    currentStage: "IN_PROGRESS",
    startedAt: occurredAt,
    endedAt: null,
  });
  assert.throws(() => startedAttendanceState("IN_PROGRESS", occurredAt), /ATTENDANCE_NOT_PREPARED/);
});

test("finaliza IN_PROGRESS como COMPLETED e exige justificativa somente se vazio", () => {
  assert.deepEqual(completedAttendanceState("IN_PROGRESS", occurredAt, true), {
    status: "COMPLETED",
    currentStage: "COMPLETED",
    endedAt: occurredAt,
  });
  assert.throws(
    () => completedAttendanceState("IN_PROGRESS", occurredAt, false),
    /ATTENDANCE_EMPTY_CLOSURE_JUSTIFICATION_REQUIRED/,
  );
  assert.equal(
    completedAttendanceState("IN_PROGRESS", occurredAt, false, "Consulta encerrada sem coleta.").status,
    "COMPLETED",
  );
});

test("cancelamento seguro preserva registro e usa CANCELLED", () => {
  assert.deepEqual(cancelledPreparedAttendanceState("DRAFT", occurredAt), {
    status: "CANCELLED",
    currentStage: "CANCELLED",
    startedAt: null,
    endedAt: occurredAt,
  });
});

test("abrir ou navegar não inicia atendimento DRAFT", async () => {
  const [page, continuation, startRoute] = await Promise.all([
    readFile(new URL("../../app/(authenticated)/pacientes/[patientId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/(authenticated)/pacientes/[patientId]/continuar/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/patients/[patientId]/attendances/[attendanceId]/start/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /activeAttendance\?\.status === "IN_PROGRESS"/);
  assert.match(continuation, /attendance\.status === "DRAFT"/);
  assert.doesNotMatch(page, /startClinicalAttendance\(/);
  assert.match(startRoute, /startClinicalAttendance\(/);
});
