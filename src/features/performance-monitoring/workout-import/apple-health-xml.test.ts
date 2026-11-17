import assert from "node:assert/strict";
import test from "node:test";

import type {
  ParsedWorkoutRecord,
  WorkoutImportStore,
} from "./contracts";
import {
  importSelectedAppleHealthWorkouts,
  previewAppleHealthWorkouts,
} from "./service";

const fictitiousXml = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="pt_BR">
  <Record type="HKQuantityTypeIdentifierHeartRate" value="150" unit="count/min" />
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30" durationUnit="min" totalDistance="5" totalDistanceUnit="km" startDate="2026-10-18 07:30:00 -0300" endDate="2026-10-18 08:00:00 -0300">
    <MetadataEntry key="HKExternalUUID" value="FICTITIOUS-RUN-001" />
  </Workout>
  <ActivitySummary dateComponents="2026-10-18" activeEnergyBurned="450" />
</HealthData>`;

class InMemoryWorkoutStore implements WorkoutImportStore {
  readonly records = new Map<string, ParsedWorkoutRecord>();
  calls = 0;

  async importWorkouts(input: Parameters<WorkoutImportStore["importWorkouts"]>[0]) {
    this.calls += 1;
    const importedIds: string[] = [];
    const duplicateIds: string[] = [];
    for (const workout of input.workouts) {
      const key = `${input.masterRecordId}:${workout.provider}:${workout.externalIdentifier}`;
      if (this.records.has(key)) duplicateIds.push(workout.id);
      else {
        this.records.set(key, workout);
        importedIds.push(workout.id);
      }
    }
    return { importedIds, duplicateIds };
  }
}

test("a prévia lê somente o treino e preserva modalidade, data, duração e distância", () => {
  const preview = previewAppleHealthWorkouts(fictitiousXml);
  assert.equal(preview.length, 1);
  assert.deepEqual(
    {
      modality: preview[0].modality,
      startedAt: preview[0].startedAt,
      durationSeconds: preview[0].durationSeconds,
      distanceMeters: preview[0].distanceMeters,
    },
    {
      modality: "RUNNING",
      startedAt: "2026-10-18T10:30:00.000Z",
      durationSeconds: 1_800,
      distanceMeters: 5_000,
    },
  );
});

test("cancelar depois da prévia não grava treino", () => {
  const store = new InMemoryWorkoutStore();
  const preview = previewAppleHealthWorkouts(fictitiousXml);
  assert.equal(preview.length, 1);
  assert.equal(store.calls, 0);
  assert.equal(store.records.size, 0);
});

test("reimportar o mesmo XML não duplica o treino", async () => {
  const store = new InMemoryWorkoutStore();
  const [workout] = previewAppleHealthWorkouts(fictitiousXml);
  const input = {
    xml: fictitiousXml,
    selectedIds: [workout.id],
    masterRecordId: "master-record-fictitious",
    importedByUserId: "user-fictitious",
  };

  const first = await importSelectedAppleHealthWorkouts(input, store);
  const second = await importSelectedAppleHealthWorkouts(input, store);

  assert.deepEqual(first, { importedIds: [workout.id], duplicateIds: [] });
  assert.deepEqual(second, { importedIds: [], duplicateIds: [workout.id] });
  assert.equal(store.records.size, 1);
  assert.deepEqual([...store.records.values()][0], workout);
});
