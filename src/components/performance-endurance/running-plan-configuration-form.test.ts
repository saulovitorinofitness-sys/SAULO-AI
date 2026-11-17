import assert from "node:assert/strict";
import test from "node:test";

import { runningPlanConfigurationSchema } from "@/features/performance-endurance/endurance-workout-schemas";

import {
  normalizeRunningPlanConfiguration,
  runningConfigurationWithExecutionReference,
  type RunningPlanConfiguration,
} from "./running-plan-configuration-form";

function visuallySelectedButEmptyConfiguration(): RunningPlanConfiguration {
  return {
    modality: "RUNNING",
    primaryObjective: "Condicionamento fictício",
    currentLevel: "Iniciante",
    startDate: "2026-11-10",
    cycleDurationWeeks: 4,
    weeklyFrequency: 3,
    availableWeekdays: ["MONDAY", "WEDNESDAY", "SATURDAY"],
    environment: "" as RunningPlanConfiguration["environment"],
    primaryUnit: "" as RunningPlanConfiguration["primaryUnit"],
    primaryIntensityMethod:
      "" as RunningPlanConfiguration["primaryIntensityMethod"],
  };
}

test("normaliza as primeiras opções visíveis sem exigir nova seleção", () => {
  const normalized = normalizeRunningPlanConfiguration(
    visuallySelectedButEmptyConfiguration(),
  );

  assert.equal(normalized.environment, "ROAD");
  assert.equal(normalized.primaryUnit, "TIME");
  assert.equal(normalized.primaryIntensityMethod, "RPE");
});

test("preserva seleções explícitas diferentes das opções iniciais", () => {
  const normalized = normalizeRunningPlanConfiguration({
    ...visuallySelectedButEmptyConfiguration(),
    environment: "TRACK",
    primaryUnit: "DISTANCE",
    primaryIntensityMethod: "HEART_RATE",
  });

  assert.equal(normalized.environment, "TRACK");
  assert.equal(normalized.primaryUnit, "DISTANCE");
  assert.equal(normalized.primaryIntensityMethod, "HEART_RATE");
});

test("plano antigo sem frequência de Corrida permanece sem frequência própria", () => {
  const normalized = normalizeRunningPlanConfiguration({
    ...visuallySelectedButEmptyConfiguration(),
    weeklyFrequency: undefined,
  });

  assert.equal(normalized.weeklyFrequency, undefined);
});

test("preserva meta de TAF separada do desempenho registrado", () => {
  const normalized = normalizeRunningPlanConfiguration({
    ...visuallySelectedButEmptyConfiguration(),
    primaryObjective: "Preparação para TAF",
    testGoal: {
      requiredDistanceMeters: 2_400,
      targetDurationSeconds: 12 * 60,
      testDate: "2027-01-15",
    },
    athleteReferenceData: undefined,
  });

  assert.deepEqual(normalized.testGoal, {
    requiredDistanceMeters: 2_400,
    targetDurationSeconds: 12 * 60,
    testDate: "2027-01-15",
  });
  assert.equal(normalized.athleteReferenceData?.recentPerformance, undefined);
});

test("usa execução como referência sem alterar a meta futura de TAF", () => {
  const configuration: RunningPlanConfiguration = {
    ...visuallySelectedButEmptyConfiguration(),
    primaryObjective: "Preparação para TAF",
    testGoal: {
      requiredDistanceMeters: 2_400,
      targetDurationSeconds: 12 * 60,
      testDate: "2027-01-15",
    },
  };

  const updated = runningConfigurationWithExecutionReference(configuration, {
    distanceMeters: 5_000,
    durationSeconds: 30 * 60,
    recordedAt: "2026-10-18T10:30:00.000Z",
    sourceExecutionId: "5c8d6c29-3147-43ba-8b43-02df47be2d10",
    source: "FILE_IMPORT",
    sourceProvider: "APPLE_HEALTH",
  });

  assert.deepEqual(updated.testGoal, configuration.testGoal);
  assert.deepEqual(updated.athleteReferenceData?.recentPerformance, {
    distanceMeters: 5_000,
    durationSeconds: 1_800,
    recordedAt: "2026-10-18T10:30:00.000Z",
    sourceExecutionId: "5c8d6c29-3147-43ba-8b43-02df47be2d10",
    source: "FILE_IMPORT",
    sourceProvider: "APPLE_HEALTH",
  });
  assert.equal(runningPlanConfigurationSchema.safeParse(updated).success, true);
});
