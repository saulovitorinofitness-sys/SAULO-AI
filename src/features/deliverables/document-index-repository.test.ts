import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import type {
  DocumentIndexFilters,
  DocumentIndexItem,
  DocumentIndexPage,
} from "./document-index-repository";

const date = (day: number) => new Date(`2026-09-${String(day).padStart(2, "0")}T12:00:00.000Z`);

function entry(
  type: "MEAL_PLAN" | "ASSESSMENT" | "WORKOUT_PLAN",
  id: string,
  options: {
    attendanceId?: string;
    masterRecordId?: string;
    attendanceMasterRecordId?: string;
    patientId?: string;
    status?: string;
    skippedKey?: string;
    hasContent?: boolean;
    day?: number;
  } = {},
) {
  const attendanceId = options.attendanceId ?? `attendance-${id}`;
  const masterRecordId = options.masterRecordId ?? `master-${id}`;
  const day = options.day ?? 10;
  const relation = { entryId: id, updatedAt: date(day), assessedAt: date(day) };
  return {
    id,
    type,
    status: options.status ?? "FINALIZED",
    revision: 2,
    masterRecordId,
    attendanceId,
    createdAt: date(day),
    updatedAt: date(day),
    updatedBy: { fullName: `Atualizador ${id}` },
    masterRecord: {
      id: masterRecordId,
      patient: {
        id: options.patientId ?? `patient-${id}`,
        fullName: `Paciente ${id}`,
        clinicalCode: `SV-${id}`,
      },
      continuity: { id: `continuity-${attendanceId}` },
    },
    attendance: {
      id: attendanceId,
      masterRecordId: options.attendanceMasterRecordId ?? masterRecordId,
      receivedAt: date(day),
      startedAt: date(day),
      pendingCheck: options.skippedKey
        ? {
            continuityId: `continuity-${attendanceId}`,
            items: [{
              status: "SKIPPED",
              continuityStep: { key: options.skippedKey, status: "PENDING" },
            }],
          }
        : null,
    },
    mealPlan: type === "MEAL_PLAN" && options.hasContent !== false ? relation : null,
    posturalAssessment: type === "ASSESSMENT" && options.hasContent !== false ? relation : null,
    workoutPlan: type === "WORKOUT_PLAN" && options.hasContent !== false ? relation : null,
  };
}

type Entry = ReturnType<typeof entry>;
type Version = {
  id?: string;
  entityId: string;
  entityType: string;
  status: string;
  version: number;
  createdAt: Date;
  responsible: { fullName: string };
};

async function harness(input: {
  entries: Entry[];
  strategies?: { id: string; masterRecordId: string; attendanceId: string; createdAt: Date }[];
  versions?: Version[];
  approvedPlanIds?: string[];
  completedPosturalIds?: string[];
  officialWorkoutIds?: string[];
  nutritionDocuments?: Record<string, unknown>[];
}) {
  const source = await readFile(new URL("./document-index-repository.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const queries: { model: string; query: Record<string, unknown> }[] = [];
  let writes = 0;
  const read = (model: string, rows: unknown[]) => async (query: Record<string, unknown>) => {
    queries.push({ model, query });
    return rows;
  };
  const forbiddenWrite = () => { writes++; throw new Error("Unexpected write"); };
  const prisma = {
    masterRecordEntry: {
      findMany: async (query: Record<string, unknown>) => {
        queries.push({ model: "masterRecordEntry", query });
        return (query.where as { type: unknown }).type === "NUTRITION_STRATEGY"
          ? input.strategies ?? []
          : input.entries;
      },
      create: forbiddenWrite,
      update: forbiddenWrite,
    },
    recordVersion: {
      findMany: read("recordVersion", (input.versions ?? []).map((version, index) => ({
        ...version,
        id: version.id ?? `version-${index}`,
      }))),
      create: forbiddenWrite,
    },
    mealPlanRecord: {
      findMany: read("mealPlanRecord", (input.approvedPlanIds ?? []).map((entryId) => ({ entryId }))),
    },
    posturalAssessmentRecord: {
      findMany: read("posturalAssessmentRecord", (input.completedPosturalIds ?? []).map((entryId) => ({ entryId }))),
    },
    workoutPlanRecord: {
      findMany: read("workoutPlanRecord", (input.officialWorkoutIds ?? []).map((entryId) => ({ entryId }))),
    },
    deliverable: {
      findMany: read("deliverable", input.nutritionDocuments ?? []),
    },
    $transaction: forbiddenWrite,
  };
  const testModule = { exports: {} as {
    documentIndexRepository: {
      list: (filters: DocumentIndexFilters) => Promise<DocumentIndexPage>;
    };
  } };
  runInNewContext(compiled, {
    module: testModule,
    exports: testModule.exports,
    require(id: string) {
      if (id === "@/lib/database/prisma") return { prisma };
      if (id === "@/features/nutrition-deliverables/persistence") return {
        NUTRITION_REPORT_KIND: "NUTRITION_REPORT",
        parseNutritionReportMetadata: (value: unknown) => value,
      };
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return {
    list: testModule.exports.documentIndexRepository.list,
    queries,
    get writes() { return writes; },
  };
}

const allTypes = ["nutrition", "postural", "performance"] as const;
const defaultFilters: DocumentIndexFilters = {
  page: 1,
  allowedTypes: allTypes,
};

test("lista somente fontes reais, com status honesto, versão e responsável persistido", async () => {
  const nutrition = entry("MEAL_PLAN", "nutrition");
  const postural = entry("ASSESSMENT", "postural");
  const performance = entry("WORKOUT_PLAN", "performance");
  const repository = await harness({
    entries: [nutrition, postural, performance],
    strategies: [{
      id: "strategy",
      masterRecordId: nutrition.masterRecordId,
      attendanceId: nutrition.attendanceId,
      createdAt: date(1),
    }],
    approvedPlanIds: [nutrition.id],
    completedPosturalIds: [postural.id],
    officialWorkoutIds: [performance.id],
    versions: [
      { id: "nutrition-version", entityId: nutrition.id, entityType: "MEAL_PLAN", status: "FINALIZED", version: 4, createdAt: date(10), responsible: { fullName: "Profissional Nutrição" } },
      { id: "postural-version", entityId: postural.id, entityType: "ASSESSMENT_POSTURAL_ASSESSMENT", status: "COMPLETED", version: 3, createdAt: date(10), responsible: { fullName: "Profissional Postural" } },
      { id: "performance-version", entityId: performance.id, entityType: "WORKOUT_PLAN", status: "FINALIZED", version: 4, createdAt: date(10), responsible: { fullName: "Profissional Performance" } },
    ],
  });
  const result = await repository.list(defaultFilters);
  const byType = new Map(result.items.map((item) => [item.type, item]));
  assert.equal(result.total, 3);
  assert.equal(byType.get("nutrition")?.status, "nutrition-ready");
  assert.equal(byType.get("nutrition")?.version, 4);
  assert.equal(byType.get("nutrition")?.versionId, "nutrition-version");
  assert.equal(byType.get("postural")?.version, 3);
  assert.equal(byType.get("postural")?.versionId, "postural-version");
  assert.equal(byType.get("postural")?.professionalName, "Profissional Postural");
  assert.equal(byType.get("performance")?.version, 4);
  assert.equal(byType.get("performance")?.versionId, "performance-version");
  assert.equal(byType.get("performance")?.professionalName, "Profissional Performance");
  assert.equal(repository.writes, 0);
  for (const { query } of repository.queries) {
    assert.doesNotMatch(JSON.stringify(query.select), /payload|content|observations|snapshot|notes/);
  }
  const jsonPredicates = repository.queries.filter(({ model }) =>
    ["mealPlanRecord", "posturalAssessmentRecord", "workoutPlanRecord"].includes(model),
  );
  assert.equal(jsonPredicates.length, 3);
  assert.ok(jsonPredicates.every(({ query }) => JSON.stringify(query.where).includes("path")));
});

test("não associa documentos a outro MasterRecord ou atendimento e exclui SKIPPED", async () => {
  const valid = entry("ASSESSMENT", "valid");
  const wrongMaster = entry("ASSESSMENT", "wrong-master", {
    attendanceMasterRecordId: "another-master",
  });
  const skipped = entry("ASSESSMENT", "skipped", {
    skippedKey: "POSTURAL_ASSESSMENT",
  });
  const noContent = entry("WORKOUT_PLAN", "no-content", { hasContent: false });
  const repository = await harness({
    entries: [valid, wrongMaster, skipped, noContent],
    completedPosturalIds: [valid.id, wrongMaster.id, skipped.id],
    officialWorkoutIds: [noContent.id],
    versions: [{ entityId: noContent.id, entityType: "WORKOUT_PLAN", status: "FINALIZED", version: 1, createdAt: date(10), responsible: { fullName: "Profissional" } }],
  });
  const result = await repository.list(defaultFilters);
  assert.deepEqual(Array.from(result.items, (item: DocumentIndexItem) => item.id), ["valid"]);
  assert.equal(repository.writes, 0);
});

test("Plano Alimentar finalizado permanece disponível sem exigir relatório ou estratégia corrente", async () => {
  const plan = entry("MEAL_PLAN", "plan");
  const repository = await harness({
    entries: [plan],
    approvedPlanIds: [plan.id],
    versions: [{
      id: "plan-version-1",
      entityId: plan.id,
      entityType: "MEAL_PLAN",
      status: "FINALIZED",
      version: 1,
      createdAt: date(10),
      responsible: { fullName: "Responsável clínico" },
    }],
    strategies: [{
      id: "strategy-other-attendance",
      masterRecordId: plan.masterRecordId,
      attendanceId: "other-attendance",
      createdAt: date(1),
    }],
  });
  assert.equal((await repository.list(defaultFilters)).total, 1);
  assert.equal(repository.writes, 0);
});

test("relatórios persistidos e Plano Alimentar finalizado permanecem acessíveis separadamente", async () => {
  const plan = entry("MEAL_PLAN", "plan-official");
  const attendance = {
    id: plan.attendanceId,
    masterRecordId: plan.masterRecordId,
    consultationType: "NUTRITION",
    receivedAt: date(9),
    startedAt: date(10),
  };
  const document = (id: string, version: number, day: number) => ({
    id,
    masterRecordId: plan.masterRecordId,
    version,
    status: "PUBLISHED",
    createdAt: date(day),
    updatedAt: date(day),
    createdBy: { fullName: "Nutricionista responsável" },
    metadata: {
      attendanceId: plan.attendanceId,
      sourceEntryId: plan.id,
      sourceVersionId: `clinical-${version}`,
      sourceVersion: 4,
      approvedAt: date(day).toISOString(),
      approvedByUserId: "user-1",
      snapshot: { attendanceId: plan.attendanceId },
    },
    masterRecord: {
      id: plan.masterRecordId,
      patient: plan.masterRecord.patient,
      attendances: [attendance],
    },
  });
  const repository = await harness({
    entries: [plan],
    approvedPlanIds: [plan.id],
    strategies: [{
      id: "strategy",
      masterRecordId: plan.masterRecordId,
      attendanceId: plan.attendanceId,
      createdAt: date(1),
    }],
    versions: [{
      entityId: plan.id,
      entityType: "MEAL_PLAN",
      status: "FINALIZED",
      version: 4,
      createdAt: date(10),
      responsible: { fullName: "Responsável clínico" },
    }],
    nutritionDocuments: [document("document-2", 2, 12), document("document-1", 1, 11)],
  });

  const result = await repository.list(defaultFilters);
  assert.equal(result.total, 3);
  assert.deepEqual(Array.from(result.items, (item) => item.version), [2, 1, 4]);
  assert.equal(result.items.filter((item) => item.status === "nutrition-approved").length, 2);
  assert.equal(result.items.filter((item) => item.status === "nutrition-ready").length, 1);
  assert.ok(result.items
    .filter((item) => item.status === "nutrition-approved")
    .every((item) => item.documentId === item.id));
  assert.equal(repository.writes, 0);
});

test("Performance exige versão oficial finalizada", async () => {
  const workout = entry("WORKOUT_PLAN", "workout");
  const repository = await harness({
    entries: [workout],
    officialWorkoutIds: [workout.id],
    versions: [{ entityId: workout.id, entityType: "WORKOUT_PLAN", status: "DRAFT", version: 2, createdAt: date(10), responsible: { fullName: "Rascunho" } }],
  });
  assert.equal((await repository.list(defaultFilters)).total, 0);
});

test("Postural depende da conclusão da própria etapa, não do status geral da entrada", async () => {
  const completed = entry("ASSESSMENT", "completed", { status: "DRAFT" });
  const incomplete = entry("ASSESSMENT", "incomplete", { status: "FINALIZED" });
  const repository = await harness({
    entries: [completed, incomplete],
    completedPosturalIds: [completed.id],
  });
  const result = await repository.list(defaultFilters);
  assert.deepEqual(Array.from(result.items, (row) => row.id), [completed.id]);
});

test("entrada postural mais recente incompleta não oculta documento válido do mesmo atendimento", async () => {
  const valid = entry("ASSESSMENT", "valid", { day: 10 });
  const incomplete = entry("ASSESSMENT", "incomplete", {
    day: 19,
    attendanceId: valid.attendanceId,
    masterRecordId: valid.masterRecordId,
    patientId: valid.masterRecord.patient.id,
  });
  const repository = await harness({
    entries: [incomplete, valid],
    completedPosturalIds: [valid.id],
    versions: [
      { entityId: incomplete.id, entityType: "ASSESSMENT_POSTURAL_ASSESSMENT", status: "DRAFT", version: 4, createdAt: date(19), responsible: { fullName: "Profissional do rascunho" } },
      { entityId: valid.id, entityType: "ASSESSMENT_POSTURAL_ASSESSMENT", status: "COMPLETED", version: 3, createdAt: date(10), responsible: { fullName: "Profissional da conclusão" } },
    ],
  });

  const result = await repository.list(defaultFilters);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, valid.id);
  assert.equal(result.items[0].masterRecordId, valid.masterRecordId);
  assert.equal(result.items[0].attendanceId, valid.attendanceId);
  assert.equal(result.items[0].version, 3);
  assert.equal(result.items[0].versionId, "version-1");
  assert.equal(result.items[0].professionalName, "Profissional da conclusão");
  assert.equal(repository.writes, 0);
});

test("Postural não atribui ao documento um rascunho posterior", async () => {
  const postural = entry("ASSESSMENT", "postural-versioned", { status: "DRAFT" });
  const repository = await harness({
    entries: [postural],
    completedPosturalIds: [postural.id],
    versions: [
      { entityId: postural.id, entityType: "ASSESSMENT_POSTURAL_ASSESSMENT", status: "DRAFT", version: 4, createdAt: date(19), responsible: { fullName: "Responsável do rascunho" } },
      { entityId: postural.id, entityType: "ASSESSMENT_POSTURAL_ASSESSMENT", status: "COMPLETED", version: 3, createdAt: date(18), responsible: { fullName: "Responsável da conclusão" } },
    ],
  });
  const result = await repository.list(defaultFilters);
  assert.equal(result.items[0].version, 3);
  assert.equal(result.items[0].versionId, "version-1");
  assert.equal(result.items[0].professionalName, "Responsável da conclusão");
  assert.equal(result.items[0].updatedAt.toISOString(), date(18).toISOString());
});

test("permissões por tipo são aplicadas antes da consulta de metadados", async () => {
  const repository = await harness({ entries: [entry("MEAL_PLAN", "nutrition")] });
  const denied = await repository.list({ ...defaultFilters, allowedTypes: [] });
  assert.equal(denied.total, 0);
  assert.equal(repository.queries.length, 0);
  await repository.list({ ...defaultFilters, allowedTypes: ["postural"] });
  const candidateQuery = repository.queries[0].query;
  assert.deepEqual(JSON.parse(JSON.stringify((candidateQuery.where as { type: unknown }).type)), {
    in: ["ASSESSMENT"],
  });
  assert.equal(repository.writes, 0);
});

test("filtros de paciente, tipo e status não escrevem", async () => {
  const postural = entry("ASSESSMENT", "postural");
  const repository = await harness({
    entries: [postural],
    versions: [{ entityId: postural.id, entityType: "ASSESSMENT_POSTURAL_ASSESSMENT", status: "COMPLETED", version: 2, createdAt: date(18), responsible: { fullName: "Profissional" } }],
  });
  const result = await repository.list({
    ...defaultFilters,
    patient: "Paciente postural",
    type: "postural",
    status: "postural-completed",
    from: date(1),
    toExclusive: date(19),
  });
  assert.equal(result.total, 1);
  const candidateWhere = repository.queries[0].query.where as {
    masterRecord: { patient: { OR: unknown[] } };
    type: { in: string[] };
  };
  assert.deepEqual(candidateWhere.type.in, ["ASSESSMENT"]);
  assert.equal(candidateWhere.masterRecord.patient.OR.length, 2);
  assert.equal(result.items[0].updatedAt.toISOString(), date(18).toISOString());
  assert.equal((await repository.list({ ...defaultFilters, from: date(19) })).total, 0);
  assert.equal(repository.writes, 0);
});

test("pagina sem repetir resultados", async () => {
  const entries = Array.from({ length: 21 }, (_, index) =>
    entry("ASSESSMENT", `postural-${index + 1}`, { day: 10 }),
  );
  const repository = await harness({
    entries,
    completedPosturalIds: entries.map((row) => row.id),
  });
  const first = await repository.list(defaultFilters);
  const second = await repository.list({ ...defaultFilters, page: 2 });
  assert.equal(first.total, 21);
  assert.equal(first.items.length, 20);
  assert.equal(second.items.length, 1);
  assert.equal(first.totalPages, 2);
  assert.ok(!first.items.some((item) => item.id === second.items[0].id));
  assert.equal(repository.writes, 0);
});
