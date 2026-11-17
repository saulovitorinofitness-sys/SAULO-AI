import assert from "node:assert/strict";
import test from "node:test";

import type { PersistedWorkoutExecution } from "../performance-monitoring/repository";
import {
  buildRunningPlanningReferenceSet,
  withLocalRunningManualReference,
} from "./running-planning-references";

function execution(
  id: string,
  changes: Partial<PersistedWorkoutExecution> = {},
): PersistedWorkoutExecution {
  return {
    id,
    masterRecordId: "master-a",
    modality: "RUNNING",
    source: "FILE_IMPORT",
    actualStartAt: "2026-11-01T10:00:00.000Z",
    actualEndAt: "2026-11-01T10:30:00.000Z",
    executedDurationSeconds: 1_800,
    status: "COMPLETED",
    importProvider: "APPLE_HEALTH",
    distanceMeters: 5_000,
    createdAt: "2026-11-01T10:31:00.000Z",
    updatedAt: "2026-11-01T10:31:00.000Z",
    ...changes,
  };
}

test("execução fictícia de 30 min e 5 km produz médias calculadas sem classificá-la como teste", () => {
  const set = buildRunningPlanningReferenceSet({
    masterRecordId: "master-a",
    patientId: "patient-a",
    executions: [execution("run-a")],
    assessments: [],
    now: new Date("2026-11-13T12:00:00.000Z"),
  });
  const reference = set.references[0];

  assert.equal(reference.averagePaceSecondsPerKilometer, 360);
  assert.equal(reference.averageSpeedKilometersPerHour, 10);
  assert.equal(reference.selectedByDefault, true);
  assert.match(reference.limitations.join(" "), /não classificada como teste máximo nem melhor marca/u);
});

test("registros fictícios incompletos, antigos e de outra modalidade não alimentam o planejamento", () => {
  const set = buildRunningPlanningReferenceSet({
    masterRecordId: "master-a",
    patientId: "patient-a",
    executions: [
      execution("missing-distance", { distanceMeters: undefined }),
      execution("old", { actualStartAt: "2024-01-01T10:00:00.000Z" }),
      execution("strength", { modality: "STRENGTH" }),
    ],
    assessments: [],
    now: new Date("2026-11-13T12:00:00.000Z"),
  });

  assert.equal(set.references.length, 2);
  assert.ok(set.references.every((reference) => !reference.selectable));
  assert.deepEqual(set.selectedReferenceIds, []);
});

test("sem relógio, avaliação de Corrida e referência manual reais continuam disponíveis", () => {
  const set = buildRunningPlanningReferenceSet({
    masterRecordId: "master-a",
    patientId: "patient-a",
    executions: [],
    assessments: [{
      assessmentId: "assessment-a",
      assessmentName: "Avaliação cardiorrespiratória fictícia",
      performedAt: "2026-10-20T12:00:00.000Z",
      evaluatedCapacity: "Corrida contínua",
      resultSummary: "Concluiu o protocolo submáximo registrado.",
      sourceRecordId: "entry-a",
    }],
    manualReferenceData: {
      recentHistory: "Registro manual fictício de duas sessões semanais.",
      currentWeeklyVolume: { unit: "TIME", durationSeconds: 3_600 },
      updatedAt: "2026-11-10T12:00:00.000Z",
    },
    now: new Date("2026-11-13T12:00:00.000Z"),
  });

  assert.deepEqual(
    set.references.map((reference) => reference.kind),
    ["PHYSICAL_ASSESSMENT", "MANUAL_REFERENCE"],
  );
  assert.equal(set.selectedReferenceIds.length, 2);
  assert.ok(set.references.every((reference) => reference.averagePaceSecondsPerKilometer === undefined));
});

test("fixtures de pacientes diferentes permanecem isoladas pelo MasterRecord informado", () => {
  const patientA = buildRunningPlanningReferenceSet({
    masterRecordId: "master-a",
    patientId: "patient-a",
    executions: [execution("run-a")],
    assessments: [],
    now: new Date("2026-11-13T12:00:00.000Z"),
  });
  const patientB = buildRunningPlanningReferenceSet({
    masterRecordId: "master-b",
    patientId: "patient-b",
    executions: [execution("run-b", { masterRecordId: "master-b" })],
    assessments: [],
    now: new Date("2026-11-13T12:00:00.000Z"),
  });

  assert.equal(patientA.patientId, "patient-a");
  assert.deepEqual(patientA.references.map((reference) => reference.id), ["execution:run-a"]);
  assert.equal(patientB.masterRecordId, "master-b");
  assert.deepEqual(patientB.references.map((reference) => reference.id), ["execution:run-b"]);
});

test("referência manual confirmada localmente entra em Dados usados antes de persistir", () => {
  const now = new Date("2026-11-13T12:00:00.000Z");
  const serverSet = buildRunningPlanningReferenceSet({
    masterRecordId: "master-fictional-local",
    patientId: "patient-fictional-local",
    executions: [],
    assessments: [],
    now,
  });
  const local = withLocalRunningManualReference({
    referenceSet: serverSet,
    manualReferenceData: {
      recentHistory: "Histórico fictício recém-confirmado no editor.",
      currentWeeklyVolume: { unit: "TIME", durationSeconds: 120 * 60 },
      currentContinuousDistanceMeters: 5_000,
      updatedAt: "2026-11-13T11:50:00.000Z",
    },
    now,
  });

  assert.equal(local.references.length, 1);
  assert.equal(local.references[0]?.kind, "MANUAL_REFERENCE");
  assert.match(local.references[0]?.origin ?? "", /estado local ainda não salvo/u);
  assert.match(local.references[0]?.limitations.join(" ") ?? "", /persistência no servidor ainda não foi verificada/u);
  assert.deepEqual(local.selectedReferenceIds, [local.references[0]?.id]);
});

test("referência manual idêntica já persistida preserva a origem do servidor", () => {
  const now = new Date("2026-11-13T12:00:00.000Z");
  const manualReferenceData = {
    recentHistory: "Histórico fictício já persistido.",
    currentWeeklyVolume: { unit: "TIME" as const, durationSeconds: 90 * 60 },
    currentContinuousDistanceMeters: 4_000,
    updatedAt: "2026-11-10T12:00:00.000Z",
  };
  const persisted = buildRunningPlanningReferenceSet({
    masterRecordId: "master-fictional-persisted",
    patientId: "patient-fictional-persisted",
    executions: [],
    assessments: [],
    manualReferenceData,
    now,
  });
  const reconciled = withLocalRunningManualReference({
    referenceSet: persisted,
    manualReferenceData,
    now,
  });

  assert.equal(reconciled, persisted);
  assert.doesNotMatch(reconciled.references[0]?.origin ?? "", /ainda não salvo/u);
});
