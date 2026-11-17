import assert from "node:assert/strict";
import test from "node:test";

import type { PosturalAssessmentData, PosturalViewKey } from "./contracts";
import { validatePosturalAssessmentData } from "./postural-validation";

function emptyAssessment(): PosturalAssessmentData {
  const emptyView = () => ({ state: "NOT_ASSESSED" as const });
  return {
    views: {
      ANTERIOR: emptyView(),
      POSTERIOR: emptyView(),
      RIGHT_LATERAL: emptyView(),
      LEFT_LATERAL: emptyView(),
    },
    identifiedChanges: "NOT_ASSESSED",
    functionalLimitations: "NOT_ASSESSED",
    completionStatus: "IN_PROGRESS",
  };
}

const image = {
  dataUrl: "data:image/png;base64,YQ==",
  fileName: "vista.png",
  mimeType: "image/png" as const,
  sizeBytes: 1,
  uploadedAt: "2026-07-31T12:00:00.000Z",
};

test("aceita avaliação vazia sem inventar dados clínicos", () => {
  assert.equal(validatePosturalAssessmentData(emptyAssessment()).valid, true);
});

test("aceita imagem válida em cada uma das quatro vistas existentes", () => {
  for (const viewKey of [
    "ANTERIOR",
    "POSTERIOR",
    "RIGHT_LATERAL",
    "LEFT_LATERAL",
  ] as const satisfies readonly PosturalViewKey[]) {
    const data = emptyAssessment();
    const candidate = {
      ...data,
      views: {
        ...data.views,
        [viewKey]: { ...data.views[viewKey], image },
      },
    };
    assert.equal(validatePosturalAssessmentData(candidate).valid, true);
  }
});

test("rejeita imagem cujo MIME não corresponde ao Data URL", () => {
  const data = emptyAssessment();
  const result = validatePosturalAssessmentData({
    ...data,
    views: {
      ...data.views,
      ANTERIOR: {
        ...data.views.ANTERIOR,
        image: { ...image, mimeType: "image/jpeg" },
      },
    },
  });

  assert.equal(result.valid, false);
  assert.match(result.valid ? "" : result.message, /imagem da vista anterior/i);
});

test("rejeita achado que não pertence à vista enviada", () => {
  const data = emptyAssessment();
  const result = validatePosturalAssessmentData({
    ...data,
    views: {
      ...data.views,
      POSTERIOR: {
        state: "FINDING_RECORDED",
        segments: {
          face: { selectedOption: "Sem alteração aparente" },
        },
      },
    },
  });

  assert.equal(result.valid, false);
  assert.match(result.valid ? "" : result.message, /vista posterior/i);
});

test("rejeita campos clínicos desconhecidos", () => {
  const result = validatePosturalAssessmentData({
    ...emptyAssessment(),
    automaticDiagnosis: "Escoliose",
  });

  assert.equal(result.valid, false);
  assert.match(result.valid ? "" : result.message, /inválidos/i);
});

test("rejeita conclusão não textual", () => {
  const result = validatePosturalAssessmentData({
    ...emptyAssessment(),
    evaluatorConclusion: 123,
  });

  assert.equal(result.valid, false);
  assert.match(result.valid ? "" : result.message, /conclusão/i);
});
