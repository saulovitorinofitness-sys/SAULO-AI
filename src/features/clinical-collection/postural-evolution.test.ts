import assert from "node:assert/strict";
import test from "node:test";

import type { PosturalAssessmentData } from "./contracts";
import {
  calculatePosturalEvolutionIndicators,
  comparePosturalFindings,
  generatePosturalEvolutionSummary,
} from "./postural-evolution";
import { buildPosturalEvolutionTimeline } from "./postural-history";

function assessment(
  shoulder?: {
    option: string;
    grade?: "DISCREET" | "MODERATE" | "ACCENTUATED";
  },
): PosturalAssessmentData {
  return {
    views: {
      ANTERIOR: {
        state: "FINDING_RECORDED",
        segments: shoulder
          ? {
              shoulders: {
                selectedOption: shoulder.option,
                grade: shoulder.grade,
              },
            }
          : undefined,
      },
      POSTERIOR: { state: "NOT_ASSESSED" },
      RIGHT_LATERAL: { state: "NOT_ASSESSED" },
      LEFT_LATERAL: { state: "NOT_ASSESSED" },
    },
    identifiedChanges: "NOT_ASSESSED",
    functionalLimitations: "NOT_ASSESSED",
  };
}

test("compara somente segmentos efetivamente registrados", () => {
  const comparison = comparePosturalFindings(
    assessment({
      option: "Ombro direito elevado",
      grade: "MODERATE",
    }),
    assessment({
      option: "Ombro direito elevado",
      grade: "DISCREET",
    }),
  );

  assert.equal(comparison.length, 1);
  assert.equal(comparison[0]?.segmentKey, "shoulders");
  assert.equal(comparison[0]?.situation, "IMPROVED");
  assert.equal(
    comparison[0]?.suggestedClassification,
    "PARTIAL_PROGRESS",
  );
});

test("achado sem alteração aparente é contabilizado como resolvido", () => {
  const comparison = comparePosturalFindings(
    assessment({ option: "Ombro direito elevado" }),
    assessment({ option: "Sem alteração aparente" }),
  );
  assert.equal(comparison[0]?.situation, "RESOLVED");
  assert.equal(
    comparison[0]?.suggestedClassification,
    "PROGRESS",
  );
});

test("resumo evolutivo permanece observacional", () => {
  const comparisons = comparePosturalFindings(
    assessment({ option: "Ombro direito elevado" }),
    assessment({ option: "Sem alteração aparente" }),
  );
  const summary = generatePosturalEvolutionSummary(
    comparisons,
    {},
    {
      previousAssessedAt: "2026-01-01T10:00:00.000Z",
      currentAssessedAt: "2026-02-01T10:00:00.000Z",
    },
  );

  assert.match(summary ?? "", /observacional/i);
  assert.match(summary ?? "", /01\/01\/2026/);
  assert.match(summary ?? "", /01\/02\/2026/);
  assert.doesNotMatch(summary ?? "", /diagnóstico|confirma|patologia/i);
});

test("classifica segmento ausente em uma avaliação como não informado", () => {
  const comparison = comparePosturalFindings(
    assessment(),
    assessment({ option: "Ombro direito elevado" }),
  );

  assert.equal(comparison.length, 1);
  assert.equal(comparison[0]?.situation, "NOT_INFORMED");
  assert.equal(
    comparison[0]?.suggestedClassification,
    "NOT_INFORMED",
  );
});

test("indicadores usam a primeira e a última avaliação preservadas", () => {
  const history = buildPosturalEvolutionTimeline([
    {
      assessmentId: "first",
      masterRecordId: "master",
      patientId: "patient",
      assessedAt: "2026-01-01T10:00:00.000Z",
      status: "FINALIZED",
      data: assessment({ option: "Ombro direito elevado" }),
      audit: {
        professionalUserId: "user",
        professionalName: "Avaliador",
        updatedAt: "2026-01-01T10:00:00.000Z",
        version: 1,
      },
    },
    {
      assessmentId: "latest",
      masterRecordId: "master",
      patientId: "patient",
      assessedAt: "2026-02-01T10:00:00.000Z",
      status: "FINALIZED",
      data: assessment({ option: "Sem alteração aparente" }),
      audit: {
        professionalUserId: "user",
        professionalName: "Avaliador",
        updatedAt: "2026-02-01T10:00:00.000Z",
        version: 1,
      },
    },
  ]);
  const indicators = calculatePosturalEvolutionIndicators(history);

  assert.equal(indicators.assessmentCount, 2);
  assert.equal(indicators.activeFindings, 0);
  assert.equal(indicators.resolvedFindings, 1);
  assert.equal(indicators.newFindings, 0);
});
