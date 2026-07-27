import assert from "node:assert/strict";
import test from "node:test";

import type { PosturalAssessmentData } from "./contracts";
import { generatePosturalTechnicalSummary } from "./postural-summary";

function emptyAssessment(): PosturalAssessmentData {
  return {
    views: {
      ANTERIOR: { state: "NOT_ASSESSED" },
      POSTERIOR: { state: "NOT_ASSESSED" },
      RIGHT_LATERAL: { state: "NOT_ASSESSED" },
      LEFT_LATERAL: { state: "NOT_ASSESSED" },
    },
    identifiedChanges: "NOT_ASSESSED",
    functionalLimitations: "NOT_ASSESSED",
  };
}

test("gera somente achados e observações realmente registrados", () => {
  const data = emptyAssessment();
  const result = generatePosturalTechnicalSummary(
    {
      ...data,
      views: {
        ...data.views,
        ANTERIOR: {
          state: "FINDING_RECORDED",
          segments: {
            shoulders: {
              selectedOption: "Ombro direito elevado",
              grade: "DISCREET",
              relevance: "MODERATE",
              investigationSuggestions: ["Mobilidade"],
            },
            knees: {
              grade: "ACCENTUATED",
            },
          },
        },
        RIGHT_LATERAL: {
          state: "NOT_ASSESSED",
          observation: "Cabeça observada à frente do eixo corporal",
        },
      },
    },
    {
      assessedAt: "2026-07-26T12:00:00.000Z",
      evaluatorName: "Saulo Xavier Vitorino",
    },
  );

  assert.match(result.content ?? "", /Vista Anterior/);
  assert.match(result.content ?? "", /Ombros: ombro direito elevado/);
  assert.match(result.content ?? "", /grau discreto/);
  assert.match(result.content ?? "", /Sugere investigar: Mobilidade/);
  assert.doesNotMatch(result.content ?? "", /Joelhos/);
  assert.match(result.content ?? "", /Vista Lateral Direita/);
  assert.doesNotMatch(result.content ?? "", /Vista Posterior/);
});

test("não gera conteúdo quando nenhum achado ou observação existe", () => {
  const result = generatePosturalTechnicalSummary(emptyAssessment());

  assert.equal(result.content, undefined);
  assert.equal(result.findingCount, 0);
  assert.deepEqual(result.includedViews, []);
});

test("mantém linguagem automática observacional e segura", () => {
  const data = emptyAssessment();
  const result = generatePosturalTechnicalSummary({
    ...data,
    views: {
      ...data.views,
      POSTERIOR: {
        state: "FINDING_RECORDED",
        segments: {
          scapulae: {
            selectedOption: "Assimetria aparente",
            observation: "Diferença observada entre as bordas mediais",
          },
        },
      },
    },
  });
  const automaticText = result.content?.toLocaleLowerCase("pt-BR") ?? "";

  for (const forbiddenTerm of [
    "diagnóstico",
    "confirma",
    "possui deformidade",
    "patologia",
    "lesão confirmada",
    "tratamento",
    "prognóstico clínico",
  ]) {
    assert.equal(automaticText.includes(forbiddenTerm), false);
  }
});
