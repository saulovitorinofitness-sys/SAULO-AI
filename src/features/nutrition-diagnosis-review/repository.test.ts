import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

const requireModule = createRequire(import.meta.url);

async function harness() {
  const source = await readFile(new URL("./repository.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  let stored: Record<string, unknown> | null = null;
  let versions = 0;
  let audits = 0;

  const selectedEntry = () =>
    stored
      ? {
          ...stored,
          updatedBy: {
            id: "55555555-5555-4555-8555-555555555555",
            fullName: "Nutricionista",
          },
        }
      : null;
  const transaction = {
    $executeRaw: async () => undefined,
    attendance: {
      findFirst: async () => ({
        id: "22222222-2222-4222-8222-222222222222",
        masterRecordId: "33333333-3333-4333-8333-333333333333",
      }),
    },
    user: { findUnique: async () => ({ id: "55555555-5555-4555-8555-555555555555" }) },
    systemModule: { findUnique: async () => ({ id: "module-master-record" }) },
    masterRecordEntry: {
      findFirst: async () => stored,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        stored = {
          id: "66666666-6666-4666-8666-666666666666",
          masterRecordId: data.masterRecordId,
          attendanceId: data.attendanceId,
          revision: data.revision,
          payload: data.payload,
        };
        return { id: stored.id };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        stored = { ...stored, ...data };
        return { id: stored.id };
      },
    },
    recordVersion: { create: async () => { versions += 1; } },
    auditEvent: { create: async () => { audits += 1; } },
  };
  const prisma = {
    masterRecordEntry: { findFirst: async () => selectedEntry() },
    $transaction: async (work: (value: typeof transaction) => Promise<void>) =>
      work(transaction),
  };
  const testModule = {
    exports: {} as {
      nutritionDiagnosisReviewRepository: {
        get(patientId: string, attendanceId: string): Promise<null | {
          outcome: string;
          diagnoses: readonly string[];
          revision: number;
        }>;
        save(input: {
          patientId: string;
          attendanceId: string;
          professionalUserId: string;
          outcome: "NO_DIAGNOSIS_ESTABLISHED" | "DIAGNOSES_CONFIRMED";
          diagnoses: readonly string[];
        }): Promise<{
          outcome: string;
          diagnoses: readonly string[];
          revision: number;
        }>;
      };
    },
  };
  runInNewContext(compiled, {
    module: testModule,
    exports: testModule.exports,
    JSON,
    Map,
    require(id: string) {
      if (id === "@/generated/prisma/client") {
        return { Prisma: { JsonNull: null } };
      }
      if (id === "@/lib/database/prisma") return { prisma };
      return requireModule(id);
    },
  });

  return {
    repository: testModule.exports.nutritionDiagnosisReviewRepository,
    get versions() { return versions; },
    get audits() { return audits; },
  };
}

const identity = {
  patientId: "11111111-1111-4111-8111-111111111111",
  attendanceId: "22222222-2222-4222-8222-222222222222",
  professionalUserId: "55555555-5555-4555-8555-555555555555",
};

test("distingue revisao ausente, sem diagnostico e com diagnosticos ao reabrir", async () => {
  const fixture = await harness();
  assert.equal(
    await fixture.repository.get(identity.patientId, identity.attendanceId),
    null,
  );

  const withoutDiagnosis = await fixture.repository.save({
    ...identity,
    outcome: "NO_DIAGNOSIS_ESTABLISHED",
    diagnoses: [],
  });
  assert.equal(withoutDiagnosis.outcome, "NO_DIAGNOSIS_ESTABLISHED");
  assert.deepEqual([...withoutDiagnosis.diagnoses], []);
  assert.equal(fixture.versions, 1);
  assert.equal(fixture.audits, 1);

  const reopened = await fixture.repository.get(
    identity.patientId,
    identity.attendanceId,
  );
  assert.equal(reopened?.outcome, "NO_DIAGNOSIS_ESTABLISHED");

  await fixture.repository.save({
    ...identity,
    outcome: "NO_DIAGNOSIS_ESTABLISHED",
    diagnoses: [],
  });
  assert.equal(fixture.versions, 1);
  assert.equal(fixture.audits, 1);

  const confirmed = await fixture.repository.save({
    ...identity,
    outcome: "DIAGNOSES_CONFIRMED",
    diagnoses: ["Hipertensão confirmada"],
  });
  assert.equal(confirmed.outcome, "DIAGNOSES_CONFIRMED");
  assert.deepEqual([...confirmed.diagnoses], ["Hipertensão confirmada"]);
  assert.equal(confirmed.revision, 2);
  assert.equal(fixture.versions, 2);
  assert.equal(fixture.audits, 2);
});
