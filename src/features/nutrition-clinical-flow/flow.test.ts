import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNutritionClinicalFlow,
  getNutritionClinicalFlowStepAccess,
} from "./flow";

const context = {
  patientId: "patient-1",
  attendanceId: "attendance-1",
};

test("libera navegação direta quando a etapa anterior foi concluída", () => {
  const flow = buildNutritionClinicalFlow(context, {
    PATIENT_REGISTRATION: "COMPLETED",
    ANTHROPOMETRY: "COMPLETED",
    PERIMETRY: "COMPLETED",
    BIOIMPEDANCE: "COMPLETED",
    POSTURAL_ASSESSMENT: "COMPLETED",
    ASSESSMENT_SUMMARY: "COMPLETED",
    NUTRITION_STRATEGY: "COMPLETED",
  });

  assert.deepEqual(
    getNutritionClinicalFlowStepAccess(
      flow,
      "MEAL_PLAN",
      "NUTRITION_STRATEGY",
    ),
    { canOpen: true, status: "AVAILABLE" },
  );
});

test("explica o bloqueio do Plano Alimentar", () => {
  const flow = buildNutritionClinicalFlow(context, {
    PATIENT_REGISTRATION: "COMPLETED",
    ANTHROPOMETRY: "COMPLETED",
    PERIMETRY: "COMPLETED",
    ASSESSMENT_SUMMARY: "COMPLETED",
    NUTRITION_STRATEGY: "IN_PROGRESS",
  });

  assert.deepEqual(
    getNutritionClinicalFlowStepAccess(
      flow,
      "MEAL_PLAN",
      "NUTRITION_STRATEGY",
    ),
    {
      canOpen: false,
      status: "BLOCKED",
      blockedReason:
        "Conclua e aprove a Estratégia Nutricional para acessar o Plano Alimentar.",
    },
  );
});
