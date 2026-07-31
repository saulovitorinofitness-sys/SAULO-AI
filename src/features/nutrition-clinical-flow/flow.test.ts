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
    { canOpen: true, status: "NOT_STARTED" },
  );
});

test("a Estratégia concluída libera o Plano mesmo com histórico legado inconsistente", () => {
  const flow = buildNutritionClinicalFlow(context, {
    PATIENT_REGISTRATION: "COMPLETED",
    ASSESSMENT_SUMMARY: "COMPLETED",
    NUTRITION_STRATEGY: "COMPLETED",
    MEAL_PLAN: "IN_PROGRESS",
  });

  assert.deepEqual(
    getNutritionClinicalFlowStepAccess(
      flow,
      "MEAL_PLAN",
      "NUTRITION_STRATEGY",
    ),
    { canOpen: true, status: "IN_PROGRESS" },
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

test("mantém Bioimpedância obrigatória e permite Postural opcional já resumida", () => {
  const bioimpedancePending = buildNutritionClinicalFlow(context, {
    PATIENT_REGISTRATION: "COMPLETED",
    ANTHROPOMETRY: "COMPLETED",
    PERIMETRY: "COMPLETED",
    BIOIMPEDANCE: "IN_PROGRESS",
    POSTURAL_ASSESSMENT: "COMPLETED",
    ASSESSMENT_SUMMARY: "COMPLETED",
  });
  assert.equal(
    getNutritionClinicalFlowStepAccess(
      bioimpedancePending,
      "NUTRITION_STRATEGY",
      "ASSESSMENT_SUMMARY",
    ).status,
    "BLOCKED",
  );

  const optionalPostural = buildNutritionClinicalFlow(context, {
    PATIENT_REGISTRATION: "COMPLETED",
    ANTHROPOMETRY: "COMPLETED",
    PERIMETRY: "COMPLETED",
    BIOIMPEDANCE: "COMPLETED",
    POSTURAL_ASSESSMENT: "NOT_STARTED",
    ASSESSMENT_SUMMARY: "COMPLETED",
  });
  assert.deepEqual(
    getNutritionClinicalFlowStepAccess(
      optionalPostural,
      "NUTRITION_STRATEGY",
      "ASSESSMENT_SUMMARY",
    ),
    { canOpen: true, status: "NOT_STARTED" },
  );
});

test("libera Entregáveis somente após concluir o Plano Alimentar", () => {
  const baseStatuses = {
    PATIENT_REGISTRATION: "COMPLETED",
    ANTHROPOMETRY: "COMPLETED",
    PERIMETRY: "COMPLETED",
    BIOIMPEDANCE: "COMPLETED",
    POSTURAL_ASSESSMENT: "COMPLETED",
    ASSESSMENT_SUMMARY: "COMPLETED",
    NUTRITION_STRATEGY: "COMPLETED",
  } as const;
  const pendingMealPlan = buildNutritionClinicalFlow(context, {
    ...baseStatuses,
    MEAL_PLAN: "IN_PROGRESS",
    DELIVERABLES: "BLOCKED",
  });
  assert.equal(
    getNutritionClinicalFlowStepAccess(
      pendingMealPlan,
      "DELIVERABLES",
      "MEAL_PLAN",
    ).status,
    "BLOCKED",
  );

  const completedMealPlan = buildNutritionClinicalFlow(context, {
    ...baseStatuses,
    MEAL_PLAN: "COMPLETED",
    DELIVERABLES: "NOT_STARTED",
  });
  assert.deepEqual(
    getNutritionClinicalFlowStepAccess(
      completedMealPlan,
      "DELIVERABLES",
      "MEAL_PLAN",
    ),
    { canOpen: true, status: "NOT_STARTED" },
  );
});
