import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import type { NutritionDeliverableDraft } from "./contracts";

const patientId = "11111111-1111-4111-8111-111111111111";
const attendanceId = "22222222-2222-4222-8222-222222222222";
const entryId = "33333333-3333-4333-8333-333333333333";
const sourceVersionId = "44444444-4444-4444-8444-444444444444";
const userId = "55555555-5555-4555-8555-555555555555";

const draft = {
  deliverableId: "nutrition-deliverable:attendance:draft",
  patientId,
  attendanceId,
  responsibleProfessional: "Nutricionista",
  generatedAt: "2026-10-24T12:00:00.000Z",
  status: "DRAFT",
  cover: {
    patientName: "Paciente Teste",
    documentTitle: "Relatório Nutricional Personalizado",
  },
  clinicalDiagnosis: {
    content: "Diagnóstico revisado.",
    reviewOutcome: "DIAGNOSES_CONFIRMED",
    state: "GENERATED",
  },
  includeClinicalDiagnosis: true,
  nutritionStrategy: { strategyId: "strategy-1" },
  mealPlan: { planId: entryId },
  optionalSectionOrder: [],
} as unknown as NutritionDeliverableDraft;

async function harness() {
  const source = await readFile(new URL("./persistence.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let stored: Record<string, unknown> | null = null;
  let creates = 0;
  let clinicalWrites = 0;
  const sourceSnapshot = { status: "APPROVED" };
  const prisma = {
    masterRecordEntry: {
      findFirst: async () => ({ id: entryId, masterRecordId: "master-1" }),
      update: async () => { clinicalWrites++; },
    },
    recordVersion: {
      findFirst: async () => ({
        id: sourceVersionId,
        version: 4,
        snapshot: sourceSnapshot,
      }),
      create: async () => { clinicalWrites++; },
    },
    deliverable: {
      findFirst: async () => stored,
    },
    $transaction: async (work: (transaction: unknown) => Promise<unknown>) => work({
      systemModule: {
        findUnique: async () => ({ id: "module-deliverables" }),
      },
      deliverable: {
        findFirst: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          creates++;
          stored = {
            id: "document-1",
            masterRecordId: "master-1",
            version: data.version,
            status: data.status,
            metadata: data.metadata,
            createdBy: { id: userId, fullName: "Nutricionista" },
          };
          return stored;
        },
      },
    }),
  };
  const testModule = { exports: {} as {
    nutritionDeliverablePersistence: {
      saveOfficial(input: Record<string, unknown>): Promise<{ id: string; version: number; snapshot: NutritionDeliverableDraft }>;
      getOfficial(input: Record<string, unknown>): Promise<{ snapshot: NutritionDeliverableDraft } | null>;
    };
  } };
  runInNewContext(compiled, {
    module: testModule,
    exports: testModule.exports,
    Date,
    JSON,
    require(id: string) {
      if (id === "@/lib/database/prisma") return { prisma };
      if (id === "@/features/meal-plan/record") {
        return { parseStoredMealPlanPayload: (value: unknown) => value };
      }
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return {
    repository: testModule.exports.nutritionDeliverablePersistence,
    get creates() { return creates; },
    get clinicalWrites() { return clinicalWrites; },
  };
}

test("salvamento oficial é idempotente e não altera a versão clínica", async () => {
  const fixture = await harness();
  const input = { patientId, attendanceId, professionalUserId: userId, draft };
  const first = await fixture.repository.saveOfficial(input);
  const repeated = await fixture.repository.saveOfficial(input);
  const reopened = await fixture.repository.getOfficial({
    patientId,
    attendanceId,
    deliverableId: first.id,
  });

  assert.equal(first.id, "document-1");
  assert.equal(first.version, 1);
  assert.equal(first.snapshot.status, "APPROVED");
  assert.equal(first.snapshot.clinicalDiagnosis.state, "GENERATED");
  assert.equal(repeated.id, first.id);
  assert.equal(reopened?.snapshot.deliverableId, first.snapshot.deliverableId);
  assert.equal(reopened?.snapshot.mealPlan?.planId, entryId);
  assert.deepEqual(reopened?.snapshot, first.snapshot);
  assert.equal(fixture.creates, 1);
  assert.equal(fixture.clinicalWrites, 0);
});

test("ausência de diagnóstico permite omitir a seção sem criar revisão clínica", async () => {
  const fixture = await harness();
  const noDiagnosisDraft = {
    ...draft,
    includeClinicalDiagnosis: false,
    clinicalDiagnosis: {
      content: "",
      sourceReferences: [],
      state: "GENERATED" as const,
    },
  };

  const result = await fixture.repository.saveOfficial({
    patientId,
    attendanceId,
    professionalUserId: userId,
    draft: noDiagnosisDraft,
  });

  assert.equal(result.snapshot.clinicalDiagnosis.content, "");
  assert.equal(result.snapshot.clinicalDiagnosis.reviewOutcome, undefined);
  assert.equal(result.snapshot.clinicalDiagnosis.state, "GENERATED");
  assert.equal(result.snapshot.includeClinicalDiagnosis, false);
  assert.equal(fixture.creates, 1);
  assert.equal(fixture.clinicalWrites, 0);
});

test("divergência de paciente ou atendimento é informada antes da persistência", async () => {
  const fixture = await harness();

  await assert.rejects(
    fixture.repository.saveOfficial({
      patientId,
      attendanceId,
      professionalUserId: userId,
      draft: { ...draft, patientId: "outro-paciente" },
    }),
    /NUTRITION_DELIVERABLE_CONTEXT_MISMATCH/,
  );
  assert.equal(fixture.creates, 0);
  assert.equal(fixture.clinicalWrites, 0);
});
