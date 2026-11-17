import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type {
  NutritionFollowUpEvaluation,
  NutritionFollowUpView,
} from "@/features/nutrition-follow-up/service";
import {
  initialEvaluationSelection,
  selectedEvaluations,
  sortEvaluations,
} from "./evaluation-comparison-selector";
import {
  initialPerformanceSelection,
  performanceSelectionRecords,
} from "./performance-comparison-selector";

function evaluation(
  id: string,
  date: string,
  occurredAt = `${date}T12:00:00.000Z`,
): NutritionFollowUpEvaluation {
  return {
    id,
    date,
    occurredAt,
    status: "FINALIZED",
    entryIds: [id],
    perimetryMeasurements: {},
    measurementMethods: {},
    sources: [{ modality: "Perimetria", entryId: id }],
  };
}

const evaluations = [
  evaluation("assessment-1", "2026-01-10"),
  evaluation("assessment-2", "2026-02-12"),
  evaluation("assessment-3", "2026-04-18"),
  evaluation("assessment-4", "2026-07-25"),
];

test("seleciona duas datas não consecutivas e mantém ordem cronológica", () => {
  const selected = selectedEvaluations(evaluations, ["assessment-4", "assessment-2"]);
  assert.deepEqual(selected.map((item) => item.id), ["assessment-2", "assessment-4"]);
});

test("seleciona três avaliações específicas em ordem cronológica", () => {
  const selected = selectedEvaluations(evaluations, [
    "assessment-4",
    "assessment-1",
    "assessment-3",
  ]);
  assert.deepEqual(selected.map((item) => item.id), [
    "assessment-1",
    "assessment-3",
    "assessment-4",
  ]);
});

test("retorna ao padrão de primeira e última", () => {
  assert.deepEqual(initialEvaluationSelection(evaluations), [
    "assessment-1",
    "assessment-4",
  ]);
});

test("não une avaliações da mesma data e usa horário e id como desempate", () => {
  const sameDay = [
    evaluation("later", "2026-05-03", "2026-05-03T16:00:00.000Z"),
    evaluation("earlier-b", "2026-05-03", "2026-05-03T08:00:00.000Z"),
    evaluation("earlier-a", "2026-05-03", "2026-05-03T08:00:00.000Z"),
  ];
  assert.deepEqual(sortEvaluations(sameDay).map((item) => item.id), [
    "earlier-a",
    "earlier-b",
    "later",
  ]);
});

test("serviço cria uma avaliação por MasterRecordEntry, não por data", async () => {
  const source = await readFile(
    "src/features/nutrition-follow-up/service.ts",
    "utf8",
  );
  assert.match(source, /const byEntry = new Map/);
  assert.match(source, /id: entry\.id/);
  assert.doesNotMatch(source, /const byDate = new Map/);
});

test("seleção visual não propaga alteração ao formulário clínico", async () => {
  const source = await readFile(
    "src/components/nutrition-follow-up/evaluation-comparison-selector.tsx",
    "utf8",
  );
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(source, /type="button"/);
  assert.doesNotMatch(source, /onSave|assessmentDate|measuredAt/);
});

test("Performance seleciona somente prescrições, sessões e execuções próprias", () => {
  const performance = {
    prescriptions: [{ id: "plan-1", title: "Plano A", status: "FINALIZED", occurredAt: "2026-01-10T10:00:00.000Z" }],
    scheduledSessions: [{ id: "scheduled-1", workoutPlanEntryId: "plan-1", workoutPlanVersionId: "version-1", title: "Treino B", modality: "RUNNING", scheduledStartAt: "2026-02-10T10:00:00.000Z", status: "PLANNED" }],
    executions: [{ id: "execution-1", modality: "RUNNING", source: "MANUAL", actualStartAt: "2026-03-10T10:00:00.000Z", status: "COMPLETED" }],
  } satisfies NutritionFollowUpView["performance"];
  const records = performanceSelectionRecords(performance);

  assert.deepEqual(records.map((record) => record.selectionId), [
    "prescription:plan-1",
    "scheduled:scheduled-1",
    "execution:execution-1",
  ]);
  assert.deepEqual(initialPerformanceSelection(records), [
    "prescription:plan-1",
    "execution:execution-1",
  ]);
  assert.ok(records.every((record) => !record.label.includes("Perimetria")));
  assert.ok(records.every((record) => !record.label.includes("Bioimpedância")));
});
