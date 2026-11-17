import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import type { SaveClinicalStepInput } from "./contracts";

const input: SaveClinicalStepInput = {
  patientId: "patient-1",
  attendanceId: "attendance-1",
  scenario: "complete",
  step: "POSTURAL_ASSESSMENT",
  data: {
    views: {
      ANTERIOR: { state: "NOT_ASSESSED" },
      POSTERIOR: { state: "NOT_ASSESSED" },
      RIGHT_LATERAL: { state: "NOT_ASSESSED" },
      LEFT_LATERAL: { state: "NOT_ASSESSED" },
    },
    identifiedChanges: "NOT_ASSESSED",
    functionalLimitations: "NOT_ASSESSED",
  },
};

async function repositoryHarness(status: string) {
  const source = await readFile(new URL("./repository.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const writes: string[] = [];
  let attendanceQuery: Record<string, unknown> | undefined;
  const attendance = {
    id: input.attendanceId,
    masterRecordId: "master-record-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    status,
  };
  const transaction = {
    $executeRaw: async () => 1,
    attendance: {
      findFirst: async (query: Record<string, unknown>) => {
        attendanceQuery = query;
        return attendance;
      },
    },
    systemModule: { findUniqueOrThrow: async () => ({ id: "module-1" }) },
    masterRecordEntry: {
      findFirst: async () => ({ id: "entry-1" }),
      update: async () => { writes.push("entry.update"); },
    },
    posturalAssessmentRecord: {
      upsert: async () => { writes.push("postural.upsert"); },
    },
    masterRecordContinuity: {
      findUniqueOrThrow: async () => ({ id: "continuity-1" }),
      update: async () => { writes.push("continuity.update"); },
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof transaction) => Promise<void>) =>
      callback(transaction),
    // A leitura de retorno é isolada; a transação já foi concluída neste ponto.
    attendance: { findFirst: async () => null },
  };
  const compiledModule = { exports: {} as {
    ClinicalCollectionWriteError: new () => Error & { code: string };
    clinicalCollectionRepository: {
      saveStep: (value: SaveClinicalStepInput, userId: string) => Promise<unknown>;
    };
  } };
  runInNewContext(compiled, {
    module: compiledModule,
    exports: compiledModule.exports,
    require(id: string) {
      if (id === "node:crypto") return { randomUUID: () => "uuid-1" };
      if (id === "@/lib/database/prisma") return { prisma };
      if (id === "./field-definitions") return { bioimpedanceGroups: [], perimetryGroups: [] };
      if (id === "./postural-validation") return { assertValidPosturalAssessmentData: () => undefined };
      if (id === "./clinical-text-safety") return { safeClinicalText: (value: unknown) => value };
      if (id === "./contracts") return { shouldCreateClinicalStepVersion: () => false };
      if (id === "@/features/professional-responsibility/persisted-responsibility") {
        return { persistedProfessionalReference: () => undefined };
      }
      return {};
    },
  });
  return {
    ...compiledModule.exports,
    writes,
    get attendanceQuery() { return attendanceQuery; },
  };
}

for (const status of ["COMPLETED", "CANCELLED", "DRAFT"]) {
  test(`avaliação postural não grava em atendimento ${status}`, async () => {
    const harness = await repositoryHarness(status);
    await assert.rejects(
      harness.clinicalCollectionRepository.saveStep(input, "professional-1"),
      (error: unknown) => {
        assert.ok(error instanceof harness.ClinicalCollectionWriteError);
        assert.equal(error.code, "ATTENDANCE_NOT_WRITABLE");
        assert.equal(error.message, "Atendimento não está ativo para edição.");
        return true;
      },
    );
    assert.deepEqual(harness.writes, []);
    assert.deepEqual(
      JSON.parse(JSON.stringify(harness.attendanceQuery?.where)),
      {
        id: input.attendanceId,
        deletedAt: null,
        masterRecord: {
          patientId: input.patientId,
          status: "ACTIVE",
          patient: { deletedAt: null },
        },
      },
    );
  });
}

test("avaliação postural ainda grava no atendimento IN_PROGRESS correto", async () => {
  const harness = await repositoryHarness("IN_PROGRESS");
  await assert.rejects(
    harness.clinicalCollectionRepository.saveStep(input, "professional-1"),
    { message: "ASSESSMENT_NOT_FOUND" },
  );
  assert.deepEqual(harness.writes, [
    "entry.update",
    "postural.upsert",
    "continuity.update",
  ]);
});
