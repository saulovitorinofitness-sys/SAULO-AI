export const NUTRITION_CLINICAL_FLOW_STEP_IDS = [
  "PATIENT_REGISTRATION",
  "ANTHROPOMETRY",
  "PERIMETRY",
  "BIOIMPEDANCE",
  "POSTURAL_ASSESSMENT",
  "ASSESSMENT_SUMMARY",
  "NUTRITION_STRATEGY",
  "MEAL_PLAN",
  "DELIVERABLES",
  "FINALIZE_ATTENDANCE",
] as const;

export type NutritionClinicalFlowStepId =
  (typeof NUTRITION_CLINICAL_FLOW_STEP_IDS)[number];
export type NutritionClinicalFlowStepStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED";

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
}

export interface NutritionClinicalFlowStep
  extends NutritionClinicalFlowStepDefinition {
  readonly status: NutritionClinicalFlowStepStatus;
  readonly href: string;
}

export type NutritionClinicalFlowOperationalStatus =
  | "COMPLETED"
  | "IN_PROGRESS"
  | "AVAILABLE"
  | "BLOCKED";

export interface NutritionClinicalFlowStepAccess {
  readonly canOpen: boolean;
  readonly status: NutritionClinicalFlowOperationalStatus;
  readonly blockedReason?: string;
}

export const nutritionClinicalFlowDefinitions: readonly NutritionClinicalFlowStepDefinition[] = [
  {
    id: "PATIENT_REGISTRATION",
    title: "Cadastro",
    order: 1,
    nextStepId: "ANTHROPOMETRY",
  },
  {
    id: "ANTHROPOMETRY",
    title: "Antropometria",
    order: 2,
    previousStepId: "PATIENT_REGISTRATION",
    nextStepId: "PERIMETRY",
  },
  {
    id: "PERIMETRY",
    title: "Perimetria",
    order: 3,
    previousStepId: "ANTHROPOMETRY",
    nextStepId: "BIOIMPEDANCE",
  },
  {
    id: "BIOIMPEDANCE",
    title: "Bioimpedância",
    order: 4,
    previousStepId: "PERIMETRY",
    nextStepId: "POSTURAL_ASSESSMENT",
  },
  {
    id: "POSTURAL_ASSESSMENT",
    title: "Avaliação Postural",
    order: 5,
    previousStepId: "BIOIMPEDANCE",
    nextStepId: "ASSESSMENT_SUMMARY",
  },
  {
    id: "ASSESSMENT_SUMMARY",
    title: "Resumo da Avaliação",
    order: 6,
    previousStepId: "POSTURAL_ASSESSMENT",
    nextStepId: "NUTRITION_STRATEGY",
  },
  {
    id: "NUTRITION_STRATEGY",
    title: "Estratégia Nutricional",
    order: 7,
    previousStepId: "ASSESSMENT_SUMMARY",
    nextStepId: "MEAL_PLAN",
  },
  {
    id: "MEAL_PLAN",
    title: "Plano Alimentar",
    order: 8,
    previousStepId: "NUTRITION_STRATEGY",
    nextStepId: "DELIVERABLES",
  },
  {
    id: "DELIVERABLES",
    title: "Entregáveis",
    order: 9,
    previousStepId: "MEAL_PLAN",
    nextStepId: "FINALIZE_ATTENDANCE",
  },
  {
    id: "FINALIZE_ATTENDANCE",
    title: "Finalizar Atendimento",
    order: 10,
    previousStepId: "DELIVERABLES",
  },
] as const;

const definitionById = new Map(
  nutritionClinicalFlowDefinitions.map((definition) => [definition.id, definition]),
);
const nonBlockingSteps = new Set<NutritionClinicalFlowStepId>([
  "BIOIMPEDANCE",
  "POSTURAL_ASSESSMENT",
]);

function blockedReason(stepId: NutritionClinicalFlowStepId) {
  switch (stepId) {
    case "MEAL_PLAN":
      return "Conclua e aprove a Estratégia Nutricional para acessar o Plano Alimentar.";
    case "DELIVERABLES":
      return "Conclua o Plano Alimentar para acessar os Entregáveis.";
    case "FINALIZE_ATTENDANCE":
      return "Conclua os Entregáveis antes de finalizar o atendimento.";
    default:
      return "Conclua as etapas anteriores para continuar.";
  }
}

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
  if (step.status === "COMPLETED") {
    return { canOpen: true, status: "COMPLETED" };
  }

  const canOpen = flow
    .slice(0, index)
    .every((previous, previousIndex) => {
      if (previous.status === "COMPLETED") return true;
      if (!nonBlockingSteps.has(previous.id)) return false;

      return flow
        .slice(previousIndex + 1, index + 1)
        .some(
          (later) =>
            later.status === "COMPLETED" || later.id === activeStepId,
        );
    });

  if (!canOpen) {
    return {
        canOpen: false,
        status: "BLOCKED",
        blockedReason: blockedReason(step.id),
    };
  }

  return step.id === activeStepId || step.status === "IN_PROGRESS"
    ? { canOpen: true, status: "IN_PROGRESS" }
    : { canOpen: true, status: "AVAILABLE" };
}

function withScenario(path: string, scenario?: string) {
  if (!scenario) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}scenario=${encodeURIComponent(scenario)}`;
}

export function nutritionClinicalFlowHref(
  stepId: NutritionClinicalFlowStepId,
  context: NutritionClinicalFlowContext,
) {
  const collectionBase = `/pacientes/${context.patientId}/atendimentos/${context.attendanceId}/coleta`;

  switch (stepId) {
    case "PATIENT_REGISTRATION":
      return withScenario(`/pacientes/${context.patientId}`, context.scenario);
    case "ANTHROPOMETRY":
      return withScenario(`${collectionBase}?step=ANTHROPOMETRY`, context.scenario);
    case "PERIMETRY":
      return withScenario(`${collectionBase}?step=PERIMETRY`, context.scenario);
    case "BIOIMPEDANCE":
      return withScenario(`${collectionBase}?step=BIOIMPEDANCE`, context.scenario);
    case "POSTURAL_ASSESSMENT":
      return withScenario(
        `${collectionBase}?step=POSTURAL_ASSESSMENT`,
        context.scenario,
      );
    case "ASSESSMENT_SUMMARY":
      return withScenario(`${collectionBase}?step=SUMMARY`, context.scenario);
    case "NUTRITION_STRATEGY":
      return withScenario(
        `/pacientes/${context.patientId}/estrategia-nutricional`,
        context.scenario,
      );
    case "MEAL_PLAN":
      return withScenario(
        `/pacientes/${context.patientId}/plano-alimentar`,
        context.scenario,
      );
    case "DELIVERABLES":
      return withScenario(
        `/clinica/plano-alimentar/entregavel?patientId=${encodeURIComponent(context.patientId)}`,
        context.scenario,
      );
    case "FINALIZE_ATTENDANCE":
      return `/atendimentos?patientId=${encodeURIComponent(context.patientId)}&attendanceId=${encodeURIComponent(context.attendanceId)}&action=finalize`;
  }
}

export function getNutritionClinicalFlowDefinition(
  stepId: NutritionClinicalFlowStepId,
) {
  const definition = definitionById.get(stepId);
  if (!definition) throw new Error(`Etapa do fluxo não configurada: ${stepId}`);
  return definition;
}

export function buildNutritionClinicalFlow(
  context: NutritionClinicalFlowContext,
  statuses: Partial<
    Readonly<
      Record<NutritionClinicalFlowStepId, NutritionClinicalFlowStepStatus>
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
    const suggested = flow.find((step) => step.id === suggestedStepId);
    if (suggested && suggested.status !== "COMPLETED") return suggested;
  }

  return (
    flow.find((step, index) => {
      if (step.status === "COMPLETED") return false;
      if (!nonBlockingSteps.has(step.id)) return true;

      return !flow
        .slice(index + 1)
        .some((laterStep) => laterStep.status !== "NOT_STARTED");
    }) ?? flow.at(-1)!
  );
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
  if (!flow.length) return 0;
  const completed = flow.filter((step) => step.status === "COMPLETED").length;
  return Math.round((completed / flow.length) * 100);
}
