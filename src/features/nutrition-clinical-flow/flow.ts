export const NUTRITION_CLINICAL_FLOW_STEP_IDS = [
  "PATIENT_REGISTRATION",
  "ANAMNESIS",
  "ANTHROPOMETRY",
  "PERIMETRY",
  "BIOIMPEDANCE",
  "POSTURAL_ASSESSMENT",
  "ASSESSMENT_SUMMARY",
  "PERFORMANCE",
  "NUTRITION_STRATEGY",
  "MEAL_PLAN",
  "DELIVERABLES",
  "FINALIZE_ATTENDANCE",
] as const;

export type NutritionClinicalFlowStepId =
  (typeof NUTRITION_CLINICAL_FLOW_STEP_IDS)[number];

/**
 * COMPLETED representa trabalho clínico efetivamente realizado e salvo.
 * SKIPPED representa a decisão operacional de não realizar a etapa neste
 * atendimento e nunca substitui dados clínicos.
 */
export type NutritionClinicalFlowStepStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "SKIPPED"
  | "BLOCKED";

export type NutritionClinicalFlowLegacyStepStatus = Exclude<
  NutritionClinicalFlowStepStatus,
  "SKIPPED"
>;

export interface NutritionClinicalFlowSkippedStepMetadata {
  readonly responsibleProfessionalUserId: string;
  /** Data e hora da decisão em ISO 8601. */
  readonly decidedAt: string;
  /** Motivo curto ou categoria operacional da não realização. */
  readonly reason: string;
}

export interface NutritionClinicalFlowSkippedStepDecision {
  readonly stepId: NutritionClinicalFlowStepId;
  readonly status: "SKIPPED";
  readonly skipMetadata: NutritionClinicalFlowSkippedStepMetadata;
}

export type NutritionClinicalFlowClosureDecisionStatus =
  | "COMPLETED"
  | "SKIPPED";

export interface NutritionClinicalFlowClosurePolicy {
  readonly requiredStepIds: readonly NutritionClinicalFlowStepId[];
  readonly satisfiedStatuses: readonly NutritionClinicalFlowClosureDecisionStatus[];
  readonly minimumCompletedClinicalSteps: 1;
  readonly excludedClinicalStepIds: readonly ["PATIENT_REGISTRATION"];
}

export interface NutritionClinicalFlowClosureEligibility {
  readonly eligible: boolean;
  readonly pendingStepIds: readonly NutritionClinicalFlowStepId[];
  readonly completedClinicalStepIds: readonly NutritionClinicalFlowStepId[];
}

export const NUTRITION_CLINICAL_FLOW_CLOSURE_POLICY = {
  satisfiedStatuses: ["COMPLETED", "SKIPPED"],
  minimumCompletedClinicalSteps: 1,
  excludedClinicalStepIds: ["PATIENT_REGISTRATION"],
} as const satisfies Omit<NutritionClinicalFlowClosurePolicy, "requiredStepIds">;

type NutritionClinicalFlowClosureStepId = Exclude<
  NutritionClinicalFlowStepId,
  "ASSESSMENT_SUMMARY" | "DELIVERABLES" | "FINALIZE_ATTENDANCE"
>;

const clinicalActivityStepIds = [
  "ANAMNESIS",
  "ANTHROPOMETRY",
  "PERIMETRY",
  "BIOIMPEDANCE",
  "POSTURAL_ASSESSMENT",
  "PERFORMANCE",
  "NUTRITION_STRATEGY",
  "MEAL_PLAN",
] as const satisfies readonly Exclude<
  NutritionClinicalFlowClosureStepId,
  "PATIENT_REGISTRATION"
>[];

export const NUTRITION_CLINICAL_FLOW_CLOSURE_STEP_IDS = [
  "PATIENT_REGISTRATION",
  ...clinicalActivityStepIds,
] as const satisfies readonly NutritionClinicalFlowClosureStepId[];

const clinicalActivityStepIdSet = new Set<NutritionClinicalFlowStepId>(
  clinicalActivityStepIds,
);

const mandatoryCompletedStepIds = new Set<NutritionClinicalFlowStepId>([
  "PATIENT_REGISTRATION",
  "ANAMNESIS",
]);

export interface NutritionClinicalFlowContext {
  readonly patientId: string;
  readonly attendanceId: string;
  readonly scenario?: string;
}

export interface NutritionClinicalFlowStepDefinition {
  readonly id: NutritionClinicalFlowStepId;
  readonly title: string;
  readonly order: number;
  readonly previousStepId?: NutritionClinicalFlowStepId;
  readonly nextStepId?: NutritionClinicalFlowStepId;
  readonly visibleInAttendanceFlow?: boolean;
}

export interface NutritionClinicalFlowStep
  extends NutritionClinicalFlowStepDefinition {
  readonly status: NutritionClinicalFlowStepStatus;
  readonly href: string;
}

export interface NutritionClinicalFlowSkippedStep
  extends NutritionClinicalFlowStepDefinition {
  readonly status: "SKIPPED";
  readonly href: string;
  readonly skipMetadata: NutritionClinicalFlowSkippedStepMetadata;
}

export type NutritionClinicalFlowDecisionStep =
  | (NutritionClinicalFlowStep & {
      readonly status: NutritionClinicalFlowLegacyStepStatus;
    })
  | NutritionClinicalFlowSkippedStep;

export type NutritionClinicalFlowOperationalStatus =
  NutritionClinicalFlowStepStatus;

export function nutritionStrategyRecordFlowStatus(
  status: "APPROVED" | "DRAFT" | undefined,
): NutritionClinicalFlowStepStatus {
  if (status === "APPROVED") return "COMPLETED";
  if (status === "DRAFT") return "IN_PROGRESS";
  return "NOT_STARTED";
}

export interface NutritionClinicalFlowStepAccess {
  readonly canOpen: boolean;
  readonly status: NutritionClinicalFlowOperationalStatus;
  readonly blockedReason?: string;
}

export const nutritionClinicalFlowDefinitions: readonly NutritionClinicalFlowStepDefinition[] =
  [
    {
      id: "PATIENT_REGISTRATION",
      title: "Cadastro",
      order: 1,
      nextStepId: "ANAMNESIS",
    },
    {
      id: "ANAMNESIS",
      title: "Anamnese Clínica",
      order: 2,
      previousStepId: "PATIENT_REGISTRATION",
      nextStepId: "ANTHROPOMETRY",
    },
    {
      id: "ANTHROPOMETRY",
      title: "Antropometria",
      order: 3,
      previousStepId: "ANAMNESIS",
      nextStepId: "PERIMETRY",
    },
    {
      id: "PERIMETRY",
      title: "Perimetria",
      order: 4,
      previousStepId: "ANTHROPOMETRY",
      nextStepId: "BIOIMPEDANCE",
    },
    {
      id: "BIOIMPEDANCE",
      title: "Bioimpedância",
      order: 5,
      previousStepId: "PERIMETRY",
      nextStepId: "NUTRITION_STRATEGY",
    },
    {
      id: "ASSESSMENT_SUMMARY",
      title: "Resumo da Avaliação",
      order: 0,
      previousStepId: "BIOIMPEDANCE",
      nextStepId: "NUTRITION_STRATEGY",
      visibleInAttendanceFlow: false,
    },
    {
      id: "NUTRITION_STRATEGY",
      title: "Estratégia Nutricional",
      order: 6,
      previousStepId: "BIOIMPEDANCE",
      nextStepId: "MEAL_PLAN",
    },
    {
      id: "MEAL_PLAN",
      title: "Plano Alimentar",
      order: 7,
      previousStepId: "NUTRITION_STRATEGY",
      nextStepId: "POSTURAL_ASSESSMENT",
    },
    {
      id: "POSTURAL_ASSESSMENT",
      title: "Avaliação Postural",
      order: 8,
      previousStepId: "MEAL_PLAN",
      nextStepId: "PERFORMANCE",
    },
    {
      id: "PERFORMANCE",
      title: "Performance",
      order: 9,
      previousStepId: "POSTURAL_ASSESSMENT",
      nextStepId: "DELIVERABLES",
    },
    {
      id: "DELIVERABLES",
      title: "Entregáveis",
      order: 10,
      previousStepId: "PERFORMANCE",
      nextStepId: "FINALIZE_ATTENDANCE",
    },
    {
      id: "FINALIZE_ATTENDANCE",
      title: "Finalizar Atendimento",
      order: 11,
      previousStepId: "DELIVERABLES",
    },
  ] as const;

const definitionById = new Map(
  nutritionClinicalFlowDefinitions.map((definition) => [
    definition.id,
    definition,
  ]),
);

export function isVisibleNutritionClinicalFlowStep(
  step: Pick<NutritionClinicalFlowStepDefinition, "visibleInAttendanceFlow">,
) {
  return step.visibleInAttendanceFlow !== false;
}

const nonBlockingSteps = new Set<NutritionClinicalFlowStepId>([
  "POSTURAL_ASSESSMENT",
  "PERFORMANCE",
]);

export function getNutritionClinicalFlowStepAccess(
  flow: readonly NutritionClinicalFlowStep[],
  stepId: NutritionClinicalFlowStepId,
  activeStepId: NutritionClinicalFlowStepId,
): NutritionClinicalFlowStepAccess {
  const index = flow.findIndex((step) => step.id === stepId);
  const step = flow[index];

  if (!step) {
    return {
      canOpen: false,
      status: "BLOCKED",
      blockedReason: "Etapa não localizada no fluxo clínico.",
    };
  }

  if (step.id === "DELIVERABLES") {
    return {
      canOpen: true,
      status: "NOT_STARTED",
    };
  }

  if (step.status === "COMPLETED" || step.status === "SKIPPED") {
    return {
      canOpen: true,
      status: step.status,
    };
  }

  return step.id === activeStepId || step.status === "IN_PROGRESS"
    ? {
        canOpen: true,
        status: "IN_PROGRESS",
      }
    : {
        canOpen: true,
        status: "NOT_STARTED",
      };
}

export function nutritionClinicalFlowHref(
  stepId: NutritionClinicalFlowStepId,
  context: NutritionClinicalFlowContext,
) {
  const collectionBase =
    `/pacientes/${context.patientId}` +
    `/atendimentos/${context.attendanceId}/coleta`;

  switch (stepId) {
    case "PATIENT_REGISTRATION":
      return `/pacientes/${context.patientId}`;

    case "ANAMNESIS":
      return `/pacientes/${context.patientId}/anamnese?attendanceId=${encodeURIComponent(context.attendanceId)}`;

    case "ANTHROPOMETRY":
      return `${collectionBase}?step=ANTHROPOMETRY`;

    case "PERIMETRY":
      return `${collectionBase}?step=PERIMETRY`;

    case "BIOIMPEDANCE":
      return `${collectionBase}?step=BIOIMPEDANCE`;

    case "POSTURAL_ASSESSMENT":
      return `${collectionBase}?step=POSTURAL_ASSESSMENT`;

    case "ASSESSMENT_SUMMARY":
      return `${collectionBase}?step=SUMMARY`;

    case "PERFORMANCE":
      return `/performance-endurance?patientId=${encodeURIComponent(
        context.patientId,
      )}&attendanceId=${encodeURIComponent(context.attendanceId)}`;

    case "NUTRITION_STRATEGY":
      return `/pacientes/${context.patientId}/estrategia-nutricional?attendanceId=${encodeURIComponent(context.attendanceId)}`;

    case "MEAL_PLAN":
      return `/pacientes/${context.patientId}/plano-alimentar?attendanceId=${encodeURIComponent(context.attendanceId)}`;

    case "DELIVERABLES":
      return `/clinica/plano-alimentar/entregavel?patientId=${encodeURIComponent(
        context.patientId,
      )}&attendanceId=${encodeURIComponent(context.attendanceId)}`;

    case "FINALIZE_ATTENDANCE":
      return (
        `/atendimentos?patientId=${encodeURIComponent(context.patientId)}` +
        `&attendanceId=${encodeURIComponent(context.attendanceId)}` +
        `&action=finalize`
      );
  }
}

export function getNutritionClinicalFlowDefinition(
  stepId: NutritionClinicalFlowStepId,
) {
  const definition = definitionById.get(stepId);

  if (!definition) {
    throw new Error(`Etapa do fluxo não configurada: ${stepId}`);
  }

  return definition;
}

export function buildNutritionClinicalFlow(
  context: NutritionClinicalFlowContext,
  statuses: Partial<
    Readonly<
      Record<
        NutritionClinicalFlowStepId,
        NutritionClinicalFlowStepStatus
      >
    >
  >,
): readonly NutritionClinicalFlowStep[] {
  return nutritionClinicalFlowDefinitions.map((definition) => ({
    ...definition,
    status: statuses[definition.id] ?? "NOT_STARTED",
    href: nutritionClinicalFlowHref(definition.id, context),
  }));
}

export function findNutritionClinicalFlowResumeStep(
  flow: readonly NutritionClinicalFlowStep[],
  suggestedStepId?: NutritionClinicalFlowStepId,
): NutritionClinicalFlowStep {
  if (suggestedStepId) {
    const suggested = flow.find(
      (step) => step.id === suggestedStepId,
    );

    if (
      suggested &&
      isVisibleNutritionClinicalFlowStep(suggested) &&
      suggested.status !== "COMPLETED" &&
      suggested.status !== "SKIPPED"
    ) {
      return suggested;
    }
  }

  const visibleFlow = flow.filter(isVisibleNutritionClinicalFlowStep);
  const resumableStep = visibleFlow.find((step, index) => {
    if (step.status === "COMPLETED" || step.status === "SKIPPED") {
      return false;
    }
    if (!nonBlockingSteps.has(step.id)) return true;

    return !visibleFlow
      .slice(index + 1)
      .some(
        (laterStep) =>
          laterStep.status !== "NOT_STARTED",
      );
  });

  if (resumableStep) return resumableStep;

  const lastResolvedStep = [...visibleFlow]
    .reverse()
    .find((step) => step.status !== "SKIPPED");

  if (lastResolvedStep) return lastResolvedStep;

  throw new Error("Fluxo clínico sem etapa válida para retomada.");
}

export function evaluateNutritionClinicalFlowClosureEligibility(
  flow: readonly NutritionClinicalFlowDecisionStep[],
  requiredStepIds: readonly NutritionClinicalFlowStepId[],
): NutritionClinicalFlowClosureEligibility {
  const stepById = new Map(flow.map((step) => [step.id, step]));
  const pendingStepIds = requiredStepIds.filter((stepId) => {
    const step = stepById.get(stepId);

    if (mandatoryCompletedStepIds.has(stepId)) {
      return step?.status !== "COMPLETED";
    }

    if (step?.status === "COMPLETED") return false;

    return step?.status !== "SKIPPED" || !step.skipMetadata;
  });
  const completedClinicalStepIds = flow
    .filter(
      (step) =>
        step.status === "COMPLETED" &&
        clinicalActivityStepIdSet.has(step.id),
    )
    .map((step) => step.id);

  return {
    eligible:
      pendingStepIds.length === 0 && completedClinicalStepIds.length >= 1,
    pendingStepIds,
    completedClinicalStepIds,
  };
}

export const clinicalCollectionStepByFlowStep = {
  ANTHROPOMETRY: "ANTHROPOMETRY",
  PERIMETRY: "PERIMETRY",
  BIOIMPEDANCE: "BIOIMPEDANCE",
  POSTURAL_ASSESSMENT: "POSTURAL_ASSESSMENT",
  ASSESSMENT_SUMMARY: "SUMMARY",
} as const;

export const flowStepByClinicalCollectionStep = {
  ANTHROPOMETRY: "ANTHROPOMETRY",
  PERIMETRY: "PERIMETRY",
  BIOIMPEDANCE: "BIOIMPEDANCE",
  POSTURAL_ASSESSMENT: "POSTURAL_ASSESSMENT",
  SUMMARY: "ASSESSMENT_SUMMARY",
} as const;

export function nutritionClinicalFlowProgress(
  flow: readonly NutritionClinicalFlowStep[],
) {
  const currentAttendanceClinicalFlow = flow.filter(
    (step) =>
      isVisibleNutritionClinicalFlowStep(step) &&
      step.id !== "PATIENT_REGISTRATION",
  );
  if (!currentAttendanceClinicalFlow.length) return 0;

  const completed = currentAttendanceClinicalFlow.filter(
    (step) => step.status === "COMPLETED",
  ).length;

  return Math.round(
    (completed / currentAttendanceClinicalFlow.length) * 100,
  );
}
