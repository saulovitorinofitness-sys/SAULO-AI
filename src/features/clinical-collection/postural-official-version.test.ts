import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

const input = {
  patientId: "patient-1",
  masterRecordId: "master-1",
  attendanceId: "attendance-1",
  entryId: "entry-1",
  versionId: "completed-1",
};

async function harness(legacy = false) {
  const source = await readFile(new URL("./repository.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const queries: Record<string, unknown>[] = [];
  let writes = 0;
  const entry = {
    id: input.entryId, masterRecordId: input.masterRecordId,
    attendanceId: input.attendanceId, status: "DRAFT", revision: 5,
    updatedAt: new Date("2026-09-12T12:00:00Z"),
    updatedBy: { id: "editor-1", fullName: "Editor posterior" },
    posturalAssessment: {
      assessedAt: new Date("2026-09-10T12:00:00Z"),
      updatedAt: new Date("2026-09-11T12:00:00Z"),
      observations: { completionStatus: "COMPLETED", notes: "Registro legado" },
      notes: "Registro legado",
    },
  };
  const versions = [
    { id: "draft-2", entityId: input.entryId, status: "DRAFT", version: 4,
      snapshot: { completionStatus: "IN_PROGRESS", notes: "Rascunho posterior" },
      createdAt: new Date("2026-09-12T12:00:00Z"),
      responsible: { id: "draft-author", fullName: "Autor do rascunho" } },
    { id: input.versionId, entityId: input.entryId, status: "COMPLETED", version: 3,
      snapshot: { completionStatus: "COMPLETED", notes: "Snapshot oficial" },
      createdAt: new Date("2026-09-10T12:00:00Z"),
      responsible: { id: "official-author", fullName: "Autor da conclusão" } },
  ];
  const forbiddenWrite = () => { writes++; throw new Error("Unexpected write"); };
  const prisma = {
    masterRecordEntry: {
      findFirst: async (query: { where: Record<string, unknown> }) => {
        queries.push(query.where);
        const where = query.where;
        const master = where.masterRecord as { patientId: string };
        return where.id === input.entryId && where.masterRecordId === input.masterRecordId &&
          where.attendanceId === input.attendanceId && master.patientId === input.patientId &&
          where.type === "ASSESSMENT" ? entry : null;
      },
      create: forbiddenWrite, update: forbiddenWrite,
    },
    recordVersion: {
      findFirst: async (query: { where: { id?: string; entityId: string; status: string; entityType: string } }) => {
        queries.push(query.where);
        if (legacy) return null;
        return versions.find((version) =>
          version.entityId === query.where.entityId &&
          version.status === query.where.status &&
          (!query.where.id || version.id === query.where.id) &&
          query.where.entityType === "ASSESSMENT_POSTURAL_ASSESSMENT",
        ) ?? null;
      },
      create: forbiddenWrite,
    },
    $transaction: forbiddenWrite,
  };
  const compiledModule = { exports: {} as { clinicalCollectionRepository: {
    getOfficialPosturalAssessment: (value: typeof input | Omit<typeof input, "versionId">) => Promise<{
      data: { notes?: string }; audit: { version: number; professionalUserId: string; professionalName: string };
    } | null>;
  } } };
  runInNewContext(compiled, {
    module: compiledModule, exports: compiledModule.exports,
    require(id: string) {
      if (id === "node:crypto") return { randomUUID: () => "unused" };
      if (id === "@/lib/database/prisma") return { prisma };
      if (id === "./field-definitions") return { bioimpedanceGroups: [], perimetryGroups: [] };
      if (id === "./postural-validation") return {
        assertValidPosturalAssessmentData: () => undefined,
        validatePosturalAssessmentData: (value: { completionStatus?: string }) =>
          ({ valid: value.completionStatus === "COMPLETED", data: value }),
      };
      if (id === "./contracts") return { shouldCreateClinicalStepVersion: () => false };
      return {};
    },
  });
  return { read: compiledModule.exports.clinicalCollectionRepository.getOfficialPosturalAssessment, queries,
    get writes() { return writes; } };
}

test("Postural lê a versão concluída indicada, não o rascunho posterior", async () => {
  const repository = await harness();
  const selected = await repository.read(input);
  assert.equal(selected?.data.notes, "Snapshot oficial");
  assert.equal(selected?.audit.version, 3);
  assert.equal(selected?.audit.professionalUserId, "official-author");
  assert.equal(repository.writes, 0);
});

test("Postural rejeita versão inexistente e vínculos de outro paciente, prontuário ou atendimento", async () => {
  const repository = await harness();
  for (const change of [
    { versionId: "missing" }, { patientId: "patient-2" },
    { masterRecordId: "master-2" }, { attendanceId: "attendance-2" },
    { entryId: "entry-2" },
  ]) assert.equal(await repository.read({ ...input, ...change }), null);
  assert.equal(repository.writes, 0);
});

test("Postural legado só aceita entrada concluída sem versão persistida", async () => {
  const legacy = await harness(true);
  const selected = await legacy.read({ patientId: input.patientId, masterRecordId: input.masterRecordId,
    attendanceId: input.attendanceId, entryId: input.entryId });
  assert.equal(selected?.data.notes, "Registro legado");
  assert.equal(selected?.audit.professionalUserId, "editor-1");
  const versioned = await harness();
  assert.equal(await versioned.read({ patientId: input.patientId, masterRecordId: input.masterRecordId,
    attendanceId: input.attendanceId, entryId: input.entryId }), null);
  assert.equal(legacy.writes + versioned.writes, 0);
});
