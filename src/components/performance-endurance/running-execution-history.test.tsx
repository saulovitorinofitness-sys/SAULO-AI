import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  nextRunningReferenceCandidate,
  RunningExecutionHistory,
  runningExecutionAverageMetrics,
  runningReferenceFromExecution,
  type RunningExecutionHistoryItem,
} from "./running-execution-history";

const importedRun: RunningExecutionHistoryItem = {
  id: "5c8d6c29-3147-43ba-8b43-02df47be2d10",
  modality: "RUNNING",
  source: "FILE_IMPORT",
  importProvider: "APPLE_HEALTH",
  actualStartAt: "2026-10-18T10:30:00.000Z",
  executedDurationSeconds: 30 * 60,
  distanceMeters: 5_000,
};

test("histórico importado calcula 30 min/5 km sem chamar a duração de tempo em movimento", () => {
  const metrics = runningExecutionAverageMetrics(importedRun);
  assert.equal(metrics?.paceSecondsPerKilometer, 360);
  assert.equal(metrics?.speedKilometersPerHour, 10);

  const html = renderToStaticMarkup(
    <RunningExecutionHistory
      initialExecutions={[importedRun]}
      masterRecordId="7cd55b4c-4ce6-4d86-83e4-1a44836fab52"
      onUseReference={() => undefined}
    />,
  );

  assert.match(html, /18\/10\/2026/u);
  assert.match(html, /Corrida/u);
  assert.match(html, /Apple Health/u);
  assert.match(html, /30:00/u);
  assert.match(html, /5 km/u);
  assert.match(html, /6:00 min\/km/u);
  assert.match(html, /10 km\/h/u);
  assert.match(html, /não representam necessariamente tempo em movimento/u);
});

test("métrica ausente é apresentada como não disponível e impede seleção", () => {
  const withoutDistance: RunningExecutionHistoryItem = {
    ...importedRun,
    id: "7c559ecb-dba7-4e59-bd87-276bbf8e7378",
    distanceMeters: undefined,
  };
  assert.equal(runningExecutionAverageMetrics(withoutDistance), undefined);
  assert.equal(runningReferenceFromExecution(withoutDistance), undefined);

  const html = renderToStaticMarkup(
    <RunningExecutionHistory
      initialExecutions={[withoutDistance]}
      masterRecordId="7cd55b4c-4ce6-4d86-83e4-1a44836fab52"
      onUseReference={() => undefined}
    />,
  );
  assert.match(html, /Distância importada[\s\S]*Não disponível/u);
  assert.match(html, /não pode ser usada como referência/u);
  assert.match(html, /disabled=""/u);
  assert.doesNotMatch(html, />0 km</u);
});

test("seleção é reversível e a referência preserva data e origem", () => {
  const selected = nextRunningReferenceCandidate(undefined, {
    type: "SELECT",
    executionId: importedRun.id,
  });
  assert.equal(selected, importedRun.id);
  assert.equal(
    nextRunningReferenceCandidate(selected, { type: "CANCEL" }),
    undefined,
  );

  const reference = runningReferenceFromExecution(importedRun);
  assert.deepEqual(reference, {
    distanceMeters: 5_000,
    durationSeconds: 1_800,
    recordedAt: "2026-10-18T10:30:00.000Z",
    sourceExecutionId: importedRun.id,
    source: "FILE_IMPORT",
    sourceProvider: "APPLE_HEALTH",
  });
  assert.equal(
    nextRunningReferenceCandidate(importedRun.id, { type: "USE" }),
    undefined,
  );
});
