import assert from "node:assert/strict";
import test from "node:test";

import type { PosturalHistorySource } from "./postural-history";
import {
  buildPosturalEvolutionTimeline,
  POSTURAL_DELIVERABLE_ARCHITECTURE,
} from "./postural-history";

const assessmentData = {
  views: {
    ANTERIOR: { state: "NOT_ASSESSED" },
    POSTERIOR: { state: "NOT_ASSESSED" },
    RIGHT_LATERAL: { state: "NOT_ASSESSED" },
    LEFT_LATERAL: { state: "NOT_ASSESSED" },
  },
  identifiedChanges: "NOT_ASSESSED",
  functionalLimitations: "NOT_ASSESSED",
} as const;

function source(
  assessmentId: string,
  assessedAt: string,
  status: PosturalHistorySource["status"] = "FINALIZED",
): PosturalHistorySource {
  return {
    assessmentId,
    masterRecordId: "master-record",
    patientId: "patient",
    attendanceId: `attendance-${assessmentId}`,
    assessedAt,
    status,
    data: assessmentData,
    audit: {
      professionalUserId: "professional",
      professionalName: "Profissional",
      updatedAt: assessedAt,
      version: 1,
    },
  };
}

test("classifica avaliação inicial, intermediária e atual", () => {
  const timeline = buildPosturalEvolutionTimeline([
    source("current", "2026-07-20T10:00:00.000Z"),
    source("initial", "2026-01-10T10:00:00.000Z"),
    source("during", "2026-04-10T10:00:00.000Z"),
  ]);

  assert.equal(timeline[0].assessmentId, "initial");
  assert.equal(timeline[0].evolutionPosition.initial, true);
  assert.equal(timeline[1].evolutionPosition.intermediate, true);
  assert.equal(timeline[2].evolutionPosition.currentOrFinal, true);
});

test("uma única avaliação é inicial e atual", () => {
  const timeline = buildPosturalEvolutionTimeline([
    source("only", "2026-07-20T10:00:00.000Z"),
  ]);

  assert.equal(timeline[0].evolutionPosition.initial, true);
  assert.equal(timeline[0].evolutionPosition.currentOrFinal, true);
});

test("ignora registros anulados e preserva requisito dos entregáveis", () => {
  const timeline = buildPosturalEvolutionTimeline([
    source("valid", "2026-01-10T10:00:00.000Z"),
    source("voided", "2026-02-10T10:00:00.000Z", "VOIDED"),
  ]);

  assert.equal(timeline.length, 1);
  assert.deepEqual(
    POSTURAL_DELIVERABLE_ARCHITECTURE.comparisonModes,
    [
      "lado a lado",
      "por vista",
      "por data",
      "antes × durante × depois",
    ],
  );
});
