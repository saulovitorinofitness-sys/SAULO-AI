import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  NUTRITION_CLINICAL_FLOW_CLOSURE_STEP_IDS,
  buildNutritionClinicalFlow,
  evaluateNutritionClinicalFlowClosureEligibility,
  findNutritionClinicalFlowResumeStep,
  getNutritionClinicalFlowStepAccess,
  isVisibleNutritionClinicalFlowStep,
  nutritionClinicalFlowHref,
  nutritionClinicalFlowProgress,
  nutritionStrategyRecordFlowStatus,
  type NutritionClinicalFlowDecisionStep,
  type NutritionClinicalFlowLegacyStepStatus,
  type NutritionClinicalFlowStep,
} from "./flow";

const context = {
  patientId: "patient-1",
  attendanceId: "attendance-1",
};

function closureFlow(
  statuses: Parameters<typeof buildNutritionClinicalFlow>[1],
): readonly NutritionClinicalFlowDecisionStep[] {
  return buildNutritionClinicalFlow(context, statuses).map((step) => {
    if (step.status === "SKIPPED") {
      return {
        ...step,
        status: "SKIPPED",
        skipMetadata: {
          responsibleProfessionalUserId: "professional-1",
          decidedAt: "2026-02-10T15:00:00.000Z",
          reason: "Não realizada neste atendimento.",
        },
      };
    }

    const legacyStep: NutritionClinicalFlowStep & {
      readonly status: NutritionClinicalFlowLegacyStepStatus;
    } = { ...step, status: step.status };
    return legacyStep;
  });
}

test("adapta somente o registro oficial da Estratégia para o menu", () => {
  assert.equal(nutritionStrategyRecordFlowStatus("APPROVED"), "COMPLETED");
  assert.equal(nutritionStrategyRecordFlowStatus("DRAFT"), "IN_PROGRESS");
  assert.equal(nutritionStrategyRecordFlowStatus(undefined), "NOT_STARTED");

  const flow = buildNutritionClinicalFlow(context, {
    NUTRITION_STRATEGY: nutritionStrategyRecordFlowStatus("APPROVED"),
    MEAL_PLAN: "NOT_STARTED",
  });

  assert.deepEqual(
    getNutritionClinicalFlowStepAccess(
      flow,
      "NUTRITION_STRATEGY",
      "MEAL_PLAN",
    ),
    { canOpen: true, status: "COMPLETED" },
  );
});

test("mantém as onze etapas oficiais com Entregáveis antes da finalização", () => {
  const flow = buildNutritionClinicalFlow(context, {});

  assert.deepEqual(
    flow.filter(isVisibleNutritionClinicalFlowStep).map((step) => step.id),
    [
      "PATIENT_REGISTRATION",
      "ANAMNESIS",
      "ANTHROPOMETRY",
      "PERIMETRY",
      "BIOIMPEDANCE",
      "NUTRITION_STRATEGY",
      "MEAL_PLAN",
      "POSTURAL_ASSESSMENT",
      "PERFORMANCE",
      "DELIVERABLES",
      "FINALIZE_ATTENDANCE",
    ],
  );
});

test("mantém o atendimento explícito nas rotas nutricionais", () => {
  assert.match(
    nutritionClinicalFlowHref("NUTRITION_STRATEGY", context),
    /attendanceId=attendance-1/,
  );
  assert.match(
    nutritionClinicalFlowHref("MEAL_PLAN", context),
    /attendanceId=attendance-1/,
  );
  assert.match(
    nutritionClinicalFlowHref("DELIVERABLES", context),
    /attendanceId=attendance-1/,
  );
});

test("retoma na Anamnese imediatamente após o Cadastro", () => {
  const flow = buildNutritionClinicalFlow(context, {
    PATIENT_REGISTRATION: "COMPLETED",
  });

  assert.equal(
    findNutritionClinicalFlowResumeStep(flow, "ANAMNESIS").id,
    "ANAMNESIS",
  );
});

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

test("mantém o Plano Alimentar acessível com a Estratégia em andamento", () => {
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
    { canOpen: true, status: "NOT_STARTED" },
  );
});

test("mantém a Estratégia acessível com Bioimpedância incompleta", () => {
  const bioimpedancePending = buildNutritionClinicalFlow(context, {
    PATIENT_REGISTRATION: "COMPLETED",
    ANTHROPOMETRY: "COMPLETED",
    PERIMETRY: "COMPLETED",
    BIOIMPEDANCE: "IN_PROGRESS",
    POSTURAL_ASSESSMENT: "COMPLETED",
    ASSESSMENT_SUMMARY: "COMPLETED",
  });
  assert.deepEqual(
    getNutritionClinicalFlowStepAccess(
      bioimpedancePending,
      "NUTRITION_STRATEGY",
      "ASSESSMENT_SUMMARY",
    ),
    { canOpen: true, status: "NOT_STARTED" },
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

test("libera Entregáveis com Plano Alimentar ainda em andamento", () => {
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
    DELIVERABLES: "NOT_STARTED",
  });
  assert.deepEqual(
    getNutritionClinicalFlowStepAccess(
      pendingMealPlan,
      "DELIVERABLES",
      "MEAL_PLAN",
    ),
    { canOpen: true, status: "NOT_STARTED" },
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

test("não usa o estado bloqueado persistido como cadeado de navegação", () => {
  const flow = buildNutritionClinicalFlow(context, {
    DELIVERABLES: "BLOCKED",
  });
  assert.deepEqual(
    getNutritionClinicalFlowStepAccess(flow, "DELIVERABLES", "MEAL_PLAN"),
    { canOpen: true, status: "NOT_STARTED" },
  );
});

test("rota reutiliza a prévia e a navegação permanece responsiva", async () => {
  const [page, stepper] = await Promise.all([
    readFile(
      new URL(
        "../../app/(authenticated)/clinica/plano-alimentar/entregavel/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../components/clinical-collection/clinical-flow-stepper.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(page, /NutritionDeliverablePreview/);
  assert.doesNotMatch(page, /Conclua o Plano Alimentar antes de acessar/);
  assert.match(stepper, /overflow-x-auto/);
  assert.match(stepper, /lg:overflow-y-auto/);
});

test("libera a Finalização diretamente após o Plano Alimentar", () => {
  const flow = buildNutritionClinicalFlow(context, {
    PATIENT_REGISTRATION: "COMPLETED",
    ANAMNESIS: "COMPLETED",
    ANTHROPOMETRY: "COMPLETED",
    PERIMETRY: "COMPLETED",
    BIOIMPEDANCE: "COMPLETED",
    POSTURAL_ASSESSMENT: "COMPLETED",
    ASSESSMENT_SUMMARY: "COMPLETED",
    NUTRITION_STRATEGY: "COMPLETED",
    MEAL_PLAN: "COMPLETED",
  });

  assert.deepEqual(
    getNutritionClinicalFlowStepAccess(
      flow,
      "FINALIZE_ATTENDANCE",
      "MEAL_PLAN",
    ),
    { canOpen: true, status: "NOT_STARTED" },
  );
});

test("preserva SKIPPED na saída, no acesso e fora da retomada", () => {
  const flow = buildNutritionClinicalFlow(context, {
    PATIENT_REGISTRATION: "COMPLETED",
    ANAMNESIS: "SKIPPED",
    ANTHROPOMETRY: "NOT_STARTED",
  });

  assert.equal(flow.find((step) => step.id === "ANAMNESIS")?.status, "SKIPPED");
  assert.deepEqual(
    getNutritionClinicalFlowStepAccess(flow, "ANAMNESIS", "ANTHROPOMETRY"),
    { canOpen: true, status: "SKIPPED" },
  );
  assert.equal(findNutritionClinicalFlowResumeStep(flow, "ANAMNESIS").id, "ANTHROPOMETRY");
  assert.notEqual(
    flow.find((step) => step.id === "ANAMNESIS")?.status,
    "COMPLETED",
  );
});

test("mantém NOT_STARTED retomável e IN_PROGRESS com o comportamento atual", () => {
  const notStarted = buildNutritionClinicalFlow(context, {
    PATIENT_REGISTRATION: "COMPLETED",
    ANAMNESIS: "NOT_STARTED",
  });
  const inProgress = buildNutritionClinicalFlow(context, {
    PATIENT_REGISTRATION: "COMPLETED",
    ANAMNESIS: "IN_PROGRESS",
  });

  assert.equal(findNutritionClinicalFlowResumeStep(notStarted).id, "ANAMNESIS");
  assert.equal(findNutritionClinicalFlowResumeStep(inProgress).id, "ANAMNESIS");
  assert.deepEqual(
    getNutritionClinicalFlowStepAccess(inProgress, "ANAMNESIS", "PERIMETRY"),
    { canOpen: true, status: "IN_PROGRESS" },
  );
});

test("progresso não contabiliza SKIPPED como atividade concluída", () => {
  const skipped = buildNutritionClinicalFlow(context, {
    PATIENT_REGISTRATION: "COMPLETED",
    ANAMNESIS: "SKIPPED",
  });
  const completed = buildNutritionClinicalFlow(context, {
    PATIENT_REGISTRATION: "COMPLETED",
    ANAMNESIS: "COMPLETED",
  });

  assert.ok(
    nutritionClinicalFlowProgress(skipped) <
      nutritionClinicalFlowProgress(completed),
  );
});

test("progresso do atendimento atual ignora o cadastro permanente reutilizado", () => {
  const noCurrentClinicalRecord = buildNutritionClinicalFlow(context, {
    PATIENT_REGISTRATION: "COMPLETED",
  });
  const oneCurrentClinicalRecord = buildNutritionClinicalFlow(context, {
    PATIENT_REGISTRATION: "COMPLETED",
    ANAMNESIS: "COMPLETED",
  });

  assert.equal(nutritionClinicalFlowProgress(noCurrentClinicalRecord), 0);
  assert.ok(nutritionClinicalFlowProgress(oneCurrentClinicalRecord) > 0);
});

test("finalização aceita uma atividade clínica concluída e demais obrigatórias SKIPPED", () => {
  const required = ["PATIENT_REGISTRATION", "ANAMNESIS", "BIOIMPEDANCE"] as const;
  const eligibility = evaluateNutritionClinicalFlowClosureEligibility(
    closureFlow({
      PATIENT_REGISTRATION: "COMPLETED",
      ANAMNESIS: "COMPLETED",
      BIOIMPEDANCE: "SKIPPED",
    }),
    required,
  );

  assert.equal(eligibility.eligible, true);
  assert.deepEqual(eligibility.pendingStepIds, []);
  assert.deepEqual(eligibility.completedClinicalStepIds, ["ANAMNESIS"]);
});

test("atendimento parcial usa somente as etapas clínicas canônicas", () => {
  assert.deepEqual(NUTRITION_CLINICAL_FLOW_CLOSURE_STEP_IDS, [
    "PATIENT_REGISTRATION",
    "ANAMNESIS",
    "ANTHROPOMETRY",
    "PERIMETRY",
    "BIOIMPEDANCE",
    "POSTURAL_ASSESSMENT",
    "PERFORMANCE",
    "NUTRITION_STRATEGY",
    "MEAL_PLAN",
  ]);

  const eligibility = evaluateNutritionClinicalFlowClosureEligibility(
    closureFlow({
      PATIENT_REGISTRATION: "COMPLETED",
      ANAMNESIS: "COMPLETED",
      ANTHROPOMETRY: "COMPLETED",
      PERIMETRY: "COMPLETED",
      BIOIMPEDANCE: "SKIPPED",
      POSTURAL_ASSESSMENT: "SKIPPED",
      PERFORMANCE: "SKIPPED",
      NUTRITION_STRATEGY: "SKIPPED",
      MEAL_PLAN: "SKIPPED",
      ASSESSMENT_SUMMARY: "NOT_STARTED",
      DELIVERABLES: "NOT_STARTED",
      FINALIZE_ATTENDANCE: "NOT_STARTED",
    }),
    NUTRITION_CLINICAL_FLOW_CLOSURE_STEP_IDS,
  );

  assert.equal(eligibility.eligible, true);
  assert.deepEqual(eligibility.pendingStepIds, []);
  assert.deepEqual(eligibility.completedClinicalStepIds, [
    "ANAMNESIS",
    "ANTHROPOMETRY",
    "PERIMETRY",
  ]);
});

test("Anamnese não concluída bloqueia mesmo com outra atividade concluída", () => {
  const eligibility = evaluateNutritionClinicalFlowClosureEligibility(
    closureFlow({
      PATIENT_REGISTRATION: "COMPLETED",
      ANAMNESIS: "NOT_STARTED",
      ANTHROPOMETRY: "COMPLETED",
    }),
    NUTRITION_CLINICAL_FLOW_CLOSURE_STEP_IDS,
  );

  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.pendingStepIds.includes("ANAMNESIS"));
  assert.ok(eligibility.completedClinicalStepIds.includes("ANTHROPOMETRY"));
});

test("sem atividade clínica concluída o Cadastro não basta", () => {
  const eligibility = evaluateNutritionClinicalFlowClosureEligibility(
    closureFlow({ PATIENT_REGISTRATION: "COMPLETED" }),
    NUTRITION_CLINICAL_FLOW_CLOSURE_STEP_IDS,
  );

  assert.equal(eligibility.eligible, false);
  assert.deepEqual(eligibility.completedClinicalStepIds, []);
});

test("etapa clínica pendente bloqueia o atendimento parcial", () => {
  const eligibility = evaluateNutritionClinicalFlowClosureEligibility(
    closureFlow({
      PATIENT_REGISTRATION: "COMPLETED",
      ANAMNESIS: "COMPLETED",
      ANTHROPOMETRY: "COMPLETED",
      PERIMETRY: "COMPLETED",
      BIOIMPEDANCE: "NOT_STARTED",
      POSTURAL_ASSESSMENT: "SKIPPED",
      PERFORMANCE: "SKIPPED",
      NUTRITION_STRATEGY: "SKIPPED",
      MEAL_PLAN: "SKIPPED",
    }),
    NUTRITION_CLINICAL_FLOW_CLOSURE_STEP_IDS,
  );

  assert.equal(eligibility.eligible, false);
  assert.deepEqual(eligibility.pendingStepIds, ["BIOIMPEDANCE"]);
});

test("finalização rejeita todas as atividades clínicas SKIPPED", () => {
  const eligibility = evaluateNutritionClinicalFlowClosureEligibility(
    closureFlow({
      PATIENT_REGISTRATION: "COMPLETED",
      ANAMNESIS: "SKIPPED",
      BIOIMPEDANCE: "SKIPPED",
    }),
    ["PATIENT_REGISTRATION", "ANAMNESIS", "BIOIMPEDANCE"],
  );

  assert.equal(eligibility.eligible, false);
  assert.deepEqual(eligibility.pendingStepIds, ["ANAMNESIS"]);
  assert.deepEqual(eligibility.completedClinicalStepIds, []);
});

test("finalização rejeita etapa obrigatória pendente", () => {
  const eligibility = evaluateNutritionClinicalFlowClosureEligibility(
    closureFlow({
      PATIENT_REGISTRATION: "COMPLETED",
      ANAMNESIS: "COMPLETED",
      BIOIMPEDANCE: "NOT_STARTED",
    }),
    ["PATIENT_REGISTRATION", "ANAMNESIS", "BIOIMPEDANCE"],
  );

  assert.equal(eligibility.eligible, false);
  assert.deepEqual(eligibility.pendingStepIds, ["BIOIMPEDANCE"]);
});

test("Cadastro não conta como atividade clínica concluída", () => {
  const eligibility = evaluateNutritionClinicalFlowClosureEligibility(
    closureFlow({ PATIENT_REGISTRATION: "COMPLETED" }),
    ["PATIENT_REGISTRATION"],
  );

  assert.equal(eligibility.eligible, false);
  assert.deepEqual(eligibility.completedClinicalStepIds, []);
});

test("rota impede pular Cadastro e Anamnese e a mesma decisão permanece estável", async () => {
  const route = await readFile(
    new URL(
      "../../app/api/patients/[patientId]/attendances/[attendanceId]/clinical-flow/[step]/skip/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const statuses = {
    PATIENT_REGISTRATION: "COMPLETED",
    BIOIMPEDANCE: "SKIPPED",
  } as const;

  assert.match(
    route,
    /step === "PATIENT_REGISTRATION" \|\| step === "ANAMNESIS"/,
  );
  assert.deepEqual(
    buildNutritionClinicalFlow(context, statuses),
    buildNutritionClinicalFlow(context, statuses),
  );
});

test("persistência e recarga usam o controle do atendimento sem misturar histórico", async () => {
  const [repository, parent] = await Promise.all([
    readFile(new URL("./repository.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../../components/clinical-collection/clinical-collection-flow.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(repository, /attendancePendingCheck\.findUnique/);
  assert.match(repository, /attendanceId: context\.attendanceId/);
  assert.match(repository, /"WORKOUT_PLAN"/);
  assert.doesNotMatch(repository, /getLatestDeliveredForAttendanceMasterRecord/);
  assert.match(repository, /currentFlowStep\.status === "COMPLETED"/);
  assert.match(repository, /if \(step\.status === "SKIPPED"\)/);
  assert.match(parent, /activeFlowStep\?\.status !== "SKIPPED"/);
  assert.match(parent, /status: "SKIPPED"/);
  assert.match(parent, /activeStepHasUnsafeDraftOrContent/);
});

test("lateral e Central Clínica exibem Não realizada explicitamente", async () => {
  const [stepper, clinic] = await Promise.all([
    readFile(
      new URL(
        "../../components/clinical-collection/clinical-flow-stepper.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../../app/(authenticated)/clinica/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(stepper, /access\.status === "SKIPPED"/);
  assert.match(stepper, /Não realizada/);
  assert.match(stepper, /bg-amber-100/);
  assert.match(clinic, /status === "SKIPPED"/);
  assert.match(clinic, /Não realizada/);
});

test("finalização permite pendências e exige justificativa quando não há registro clínico", async () => {
  const [repository, route, page] = await Promise.all([
    readFile(new URL("./repository.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../../app/api/patients/[patientId]/attendances/[attendanceId]/finalize/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../../app/(authenticated)/atendimentos/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(repository, /closureEligibility/);
  assert.doesNotMatch(repository, /MEAL_PLAN_PENDING/);
  assert.doesNotMatch(repository, /\$executeRaw/);
  assert.match(route, /ATTENDANCE_EMPTY_CLOSURE_JUSTIFICATION_REQUIRED/);
  assert.doesNotMatch(route, /MEAL_PLAN_PENDING/);
  assert.match(page, /pendingSteps/);
  assert.match(page, /nutritionClinicalFlowRepository\.getFlow/);
  assert.match(route, /nutritionClinicalFlowRepository\.finalizeAttendance/);
  assert.match(repository, /NUTRITION_CLINICAL_FLOW_CLOSURE_STEP_IDS/);
  assert.match(
    repository,
    /evaluateNutritionClinicalFlowClosureEligibility\(\s*decisionSteps,\s*NUTRITION_CLINICAL_FLOW_CLOSURE_STEP_IDS/,
  );
  assert.match(repository, /completedAttendanceState/);
  assert.doesNotMatch(repository, /closureEligibility\.pendingStepIds\.length > 0/);
});
