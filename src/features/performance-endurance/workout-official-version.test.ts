import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

const input = {
  patientId: "patient-1", masterRecordId: "master-1",
  attendanceId: "attendance-1", entryId: "plan-1", versionId: "official-2",
};

async function harness() {
  const source = await readFile(new URL("./workout-repository.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const queries: Record<string, unknown>[] = [];
  const attendanceQueries: Record<string, unknown>[] = [];
  const getCalls: (string | undefined)[] = [];
  let writes = 0;
  const forbiddenWrite = () => { writes++; throw new Error("Unexpected write"); };
  const versions = [
    { id: "official-3", version: 3, status: "FINALIZED", entityId: input.entryId,
      snapshot: { status: "FINALIZED", marker: "posterior" },
      createdAt: new Date("2026-09-13T12:00:00Z"), responsible: { id: "author-3", fullName: "Autor posterior" } },
    { id: input.versionId, version: 2, status: "FINALIZED", entityId: input.entryId,
      snapshot: { status: "FINALIZED", marker: "selecionada" },
      createdAt: new Date("2026-09-12T12:00:00Z"), responsible: { id: "author-2", fullName: "Autor selecionado" } },
  ];
  const prisma = {
    attendance: {
      findFirst: async (query: { select: Record<string, unknown> }) => {
        attendanceQueries.push(query);
        throw new Error("STOP_AFTER_ATTENDANCE_QUERY");
      },
    },
    masterRecordEntry: {
      findFirst: async (query: { where: Record<string, unknown> }) => {
        queries.push(query.where);
        const where = query.where;
        const master = where.masterRecord as { patientId: string };
        return where.id === input.entryId && where.attendanceId === input.attendanceId &&
          (where.masterRecordId === undefined || where.masterRecordId === input.masterRecordId) &&
          master.patientId === input.patientId && where.type === "WORKOUT_PLAN"
          ? { status: "FINALIZED", revision: 3, updatedAt: new Date("2026-09-13T12:00:00Z"),
              workoutPlan: { content: { status: "FINALIZED" } } } : null;
      },
      create: forbiddenWrite, update: forbiddenWrite,
    },
    recordVersion: {
      findFirst: async (query: { where: Record<string, unknown> }) => {
        queries.push(query.where);
        const where = query.where;
        return versions.find((version) =>
          version.entityId === where.entityId && version.status === where.status &&
          (!where.id || version.id === where.id) && where.entityType === "WORKOUT_PLAN",
        ) ?? null;
      },
      create: forbiddenWrite,
    },
    $transaction: forbiddenWrite,
  };
  const compiledModule = { exports: {} as {
    performanceWorkoutRepository: { get: (...args: (string | undefined)[]) => Promise<Record<string, unknown>> };
    getLatestOfficialWorkoutPlan: (value: Partial<typeof input> & Pick<typeof input, "patientId" | "attendanceId">) => Promise<{
      draft: { marker: string }; version: number; responsibleProfessionalId: string;
      responsibleProfessional: string; entryId: string;
    } | null>;
  } };
  runInNewContext(compiled, {
    module: compiledModule, exports: compiledModule.exports,
    require(id: string) {
      if (id === "@/lib/database/prisma") return { prisma };
      if (id === "./workout-record") return {
        parseStoredWorkoutPlanPayload: (payload: unknown) => payload,
        emptyWorkoutPlanDraft: () => ({}),
      };
      if (id === "@/features/clinical-collection/repository") return {
        clinicalCollectionRepository: { getCollection: async () => ({}) },
      };
      if (id === "./exercise-catalog-repository") return {};
      return {};
    },
  });
  const rawGet = compiledModule.exports.performanceWorkoutRepository.get;
  compiledModule.exports.performanceWorkoutRepository.get = async (...args) => {
    getCalls.push(args[3]);
    return {
      patient: { id: input.patientId, name: "Paciente", code: "SV-01" },
      masterRecordId: input.masterRecordId, attendanceId: input.attendanceId,
      entryId: args[3] ?? input.entryId,
      status: "FINALIZED", draft: { status: "FINALIZED" }, version: 3,
      responsibleProfessionalId: "author-3", responsibleProfessional: "Autor posterior",
    };
  };
  return { read: compiledModule.exports.getLatestOfficialWorkoutPlan, rawGet, getCalls, queries,
    attendanceQueries,
    get writes() { return writes; } };
}

test("Performance abre a versão finalizada solicitada e preserva seus metadados", async () => {
  const repository = await harness();
  const selected = await repository.read(input);
  assert.equal(selected?.entryId, input.entryId);
  assert.equal(selected?.draft.marker, "selecionada");
  assert.equal(selected?.version, 2);
  assert.equal(selected?.responsibleProfessionalId, "author-2");
  assert.equal(selected?.responsibleProfessional, "Autor selecionado");
  assert.equal(repository.getCalls[0], input.entryId);
  assert.equal(repository.writes, 0);
});

test("leitor base de Performance filtra a entrada específica antes de escolher um plano", async () => {
  const repository = await harness();
  await assert.rejects(
    repository.rawGet(input.patientId, input.attendanceId, undefined, input.entryId),
    /STOP_AFTER_ATTENDANCE_QUERY/,
  );
  const query = repository.attendanceQueries[0] as { select: {
    masterRecord: { select: { entries: { where: { id: string } } } };
  } };
  assert.equal(query.select.masterRecord.select.entries.where.id, input.entryId);
  assert.equal(repository.writes, 0);
});

test("Performance rejeita versão inexistente, tipo, paciente, prontuário e atendimento incompatíveis", async () => {
  const repository = await harness();
  for (const change of [
    { versionId: "missing" }, { patientId: "patient-2" },
    { masterRecordId: "master-2" }, { attendanceId: "attendance-2" },
    { entryId: "plan-2" },
  ]) assert.equal(await repository.read({ ...input, ...change }), null);
  assert.equal(repository.writes, 0);
});

test("link contextual sem seletor mantém a escolha automática oficial", async () => {
  const repository = await harness();
  const selected = await repository.read({ patientId: input.patientId, attendanceId: input.attendanceId });
  assert.equal(selected?.draft.marker, "posterior");
  assert.equal(repository.getCalls[0], undefined);
  assert.equal(repository.writes, 0);
});

test("plano finalizado expõe visualizar, imprimir e baixar sem salvar novamente", async () => {
  const source = await readFile(
    new URL("../../components/performance-endurance/performance-workout-workspace.tsx", import.meta.url),
    "utf8",
  );
  const finalizedActions = source.slice(
    source.indexOf("{finalized ? ("),
    source.indexOf(") : (", source.indexOf("{finalized ? (")),
  );
  assert.match(finalizedActions, /officialDocumentHref[\s\S]*Visualizar/);
  assert.match(finalizedActions, /officialPrintHref[\s\S]*Imprimir/);
  assert.match(finalizedActions, /officialPdfHref[\s\S]*Salvar em PDF/);
  assert.doesNotMatch(finalizedActions, /fetch\(|save\(/);
});
