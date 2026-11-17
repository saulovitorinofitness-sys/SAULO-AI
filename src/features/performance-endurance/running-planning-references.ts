import type { EnduranceAthleteReferenceData } from "./endurance-workout-contracts";
import type { WorkoutPhysicalAssessmentContext } from "./workout-contracts";
import type { PersistedWorkoutExecution } from "../performance-monitoring/repository";

export type RunningPlanningReferenceKind =
  | "EXECUTION"
  | "PHYSICAL_ASSESSMENT"
  | "MANUAL_REFERENCE";

export interface RunningPlanningReference {
  readonly id: string;
  readonly kind: RunningPlanningReferenceKind;
  readonly recordedAt?: string;
  readonly title: string;
  readonly origin: string;
  readonly modality: "RUNNING";
  readonly environment?: string;
  readonly durationSeconds?: number;
  readonly distanceMeters?: number;
  readonly averagePaceSecondsPerKilometer?: number;
  readonly averageSpeedKilometersPerHour?: number;
  readonly weeklyVolumeDurationSeconds?: number;
  readonly weeklyVolumeDistanceMeters?: number;
  readonly currentContinuousDistanceMeters?: number;
  readonly longestRecentDistanceMeters?: number;
  readonly recentHistory?: string;
  readonly comfortableContinuousDurationSeconds?: number;
  readonly recentReturn?: boolean;
  readonly explicitRestrictions?: readonly string[];
  readonly historicalFacts: readonly string[];
  readonly limitations: readonly string[];
  readonly planningInfluence: string;
  readonly planningUse?: "DECISION" | "CONTEXT_ONLY";
  readonly influencedDecisions?: readonly string[];
  readonly selectable: boolean;
  readonly selectedByDefault: boolean;
}

export interface RunningPlanningReferenceSet {
  readonly masterRecordId: string;
  readonly patientId: string;
  readonly references: readonly RunningPlanningReference[];
  readonly selectedReferenceIds: readonly string[];
  readonly generatedAt: string;
}

const RUNNING_TERMS = /\b(corrida|correr|aerob|cardiorresp|taf|cooper|pista|esteira)\b/iu;
const MAX_REFERENCE_AGE_DAYS = 365;

function positive(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function ageInDays(recordedAt: string | undefined, now: Date) {
  if (!recordedAt) return undefined;
  const timestamp = new Date(recordedAt).getTime();
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.floor((now.getTime() - timestamp) / 86_400_000);
}

function isOld(recordedAt: string | undefined, now: Date) {
  const age = ageInDays(recordedAt, now);
  return age !== undefined && age > MAX_REFERENCE_AGE_DAYS;
}

function calculatedAverages(durationSeconds: number, distanceMeters: number) {
  return {
    averagePaceSecondsPerKilometer: durationSeconds / (distanceMeters / 1_000),
    averageSpeedKilometersPerHour:
      (distanceMeters / 1_000) / (durationSeconds / 3_600),
  };
}

function executionOrigin(execution: PersistedWorkoutExecution) {
  if (execution.importProvider === "APPLE_HEALTH") return "Apple Health";
  if (execution.importProvider) return execution.importProvider;
  if (execution.source === "FILE_IMPORT") return "Arquivo importado";
  if (execution.source === "DEVICE") return "Relógio/dispositivo";
  return "Registro manual de execução";
}

function executionReference(
  execution: PersistedWorkoutExecution,
  now: Date,
): RunningPlanningReference {
  const completeMetrics =
    positive(execution.executedDurationSeconds) &&
    positive(execution.distanceMeters);
  const completed = execution.status === "COMPLETED";
  const old = isOld(execution.actualStartAt, now);
  const limitations: string[] = [
    "Ritmo e velocidade são médias calculadas sobre a duração importada; não representam necessariamente tempo em movimento.",
    "Execução comum: não classificada como teste máximo nem melhor marca.",
    "Ambiente não informado pela importação atual.",
  ];
  if (!completed) limitations.push("Execução não concluída.");
  if (!completeMetrics) {
    limitations.push("Duração e distância válidas são necessárias para cálculo de ritmo e velocidade.");
  }
  if (old) limitations.push("Registro com mais de 365 dias; não usado automaticamente no planejamento atual.");

  const averages = completeMetrics
    ? calculatedAverages(
        execution.executedDurationSeconds,
        execution.distanceMeters,
      )
    : {};
  const selectable = completed && completeMetrics && !old;

  return {
    id: `execution:${execution.id}`,
    kind: "EXECUTION",
    recordedAt: execution.actualStartAt,
    title: "Execução de Corrida",
    origin: executionOrigin(execution),
    modality: "RUNNING",
    durationSeconds: positive(execution.executedDurationSeconds)
      ? execution.executedDurationSeconds
      : undefined,
    distanceMeters: positive(execution.distanceMeters)
      ? execution.distanceMeters
      : undefined,
    ...averages,
    historicalFacts: ["Duração e distância registradas na execução."],
    limitations,
    planningInfluence:
      "Contextualiza duração, distância e médias calculadas de uma sessão concluída; uma execução isolada não define a duração das sessões, intensidade, zona ou ritmo obrigatório.",
    planningUse: "CONTEXT_ONLY",
    influencedDecisions: [
      "Contexto histórico da execução; nenhuma prescrição numérica foi derivada.",
    ],
    selectable,
    selectedByDefault: false,
  };
}

function relevantAssessment(assessment: WorkoutPhysicalAssessmentContext) {
  return RUNNING_TERMS.test(
    [
      assessment.assessmentName,
      assessment.evaluatedCapacity,
      assessment.resultSummary,
      assessment.professionalInterpretation,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function assessmentReference(
  assessment: WorkoutPhysicalAssessmentContext,
  now: Date,
): RunningPlanningReference {
  const relevant = relevantAssessment(assessment);
  const old = isOld(assessment.performedAt, now);
  const selectable = relevant && !old;
  return {
    id: `assessment:${assessment.assessmentId}`,
    kind: "PHYSICAL_ASSESSMENT",
    recordedAt: assessment.performedAt,
    title: assessment.assessmentName,
    origin: "Avaliação física do prontuário",
    modality: "RUNNING",
    historicalFacts: [
      `Capacidade avaliada: ${assessment.evaluatedCapacity}`,
      `Resultado registrado: ${assessment.resultSummary}`,
      ...(assessment.professionalInterpretation
        ? [`Interpretação profissional: ${assessment.professionalInterpretation}`]
        : []),
    ],
    limitations: [
      "Avaliação textual: não fornece duração, distância, ritmo ou velocidade estruturados para cálculo.",
      ...(relevant ? [] : ["Conteúdo sem relação explícita com Corrida."]),
      ...(old ? ["Avaliação com mais de 365 dias; não usada automaticamente."] : []),
    ],
    planningInfluence:
      "Fornece contexto qualitativo para revisão profissional; não cria zonas nem metas numéricas.",
    planningUse: "CONTEXT_ONLY",
    influencedDecisions: [
      "Contexto qualitativo para revisão; nenhuma prescrição numérica foi derivada.",
    ],
    selectable,
    selectedByDefault: selectable,
  };
}

function manualReference(
  reference: EnduranceAthleteReferenceData,
  now: Date,
): RunningPlanningReference | undefined {
  const performance = reference.recentPerformance;
  const hasPerformance =
    performance &&
    positive(performance.durationSeconds) &&
    positive(performance.distanceMeters);
  const hasContext = Boolean(
    positive(reference.comfortableContinuousDurationSeconds) ||
      reference.recentHistory?.trim() ||
      reference.currentWeeklyVolume ||
      positive(reference.currentContinuousDistanceMeters) ||
      positive(reference.longestRecentDistanceMeters),
  );
  if (!hasPerformance && !hasContext) return undefined;

  const recordedAt = performance?.recordedAt ?? reference.updatedAt;
  const old = isOld(recordedAt, now);
  const averages = hasPerformance
    ? calculatedAverages(performance.durationSeconds, performance.distanceMeters)
    : {};
  const historicalFacts = [
    ...(positive(reference.comfortableContinuousDurationSeconds)
      ? [`Tempo contínuo confortável informado: ${Math.round(reference.comfortableContinuousDurationSeconds / 60)} min`]
      : []),
    ...(reference.recentHistory?.trim()
      ? [`Histórico informado: ${reference.recentHistory.trim()}`]
      : []),
    ...(reference.currentWeeklyVolume?.unit === "TIME"
      ? [`Volume semanal informado: ${Math.round(reference.currentWeeklyVolume.durationSeconds / 60)} min`]
      : reference.currentWeeklyVolume?.unit === "DISTANCE"
        ? [`Volume semanal informado: ${(reference.currentWeeklyVolume.distanceMeters / 1_000).toFixed(2)} km`]
        : []),
    ...(positive(reference.currentContinuousDistanceMeters)
      ? [`Distância contínua atual informada: ${(reference.currentContinuousDistanceMeters / 1_000).toFixed(2)} km`]
      : []),
    ...(positive(reference.longestRecentDistanceMeters)
      ? [`Maior distância recente informada: ${(reference.longestRecentDistanceMeters / 1_000).toFixed(2)} km`]
      : []),
  ];
  const selectable = !old;
  return {
    id: `manual:${performance?.sourceExecutionId ?? recordedAt ?? "current"}`,
    kind: "MANUAL_REFERENCE",
    recordedAt,
    title: "Referência atual registrada",
    origin: performance?.source ?? "Registro manual da Corrida",
    modality: "RUNNING",
    durationSeconds: hasPerformance ? performance.durationSeconds : undefined,
    distanceMeters: hasPerformance ? performance.distanceMeters : undefined,
    comfortableContinuousDurationSeconds: positive(reference.comfortableContinuousDurationSeconds)
      ? reference.comfortableContinuousDurationSeconds
      : undefined,
    weeklyVolumeDurationSeconds:
      reference.currentWeeklyVolume?.unit === "TIME"
        ? reference.currentWeeklyVolume.durationSeconds
        : undefined,
    weeklyVolumeDistanceMeters:
      reference.currentWeeklyVolume?.unit === "DISTANCE"
        ? reference.currentWeeklyVolume.distanceMeters
        : undefined,
    currentContinuousDistanceMeters: positive(reference.currentContinuousDistanceMeters)
      ? reference.currentContinuousDistanceMeters
      : undefined,
    longestRecentDistanceMeters: positive(reference.longestRecentDistanceMeters)
      ? reference.longestRecentDistanceMeters
      : undefined,
    recentHistory: reference.recentHistory?.trim() || undefined,
    ...averages,
    historicalFacts,
    limitations: [
      "Dados declarados ou selecionados pelo profissional; não classificados como teste máximo ou melhor marca.",
      ...(hasPerformance
        ? ["Ritmo e velocidade são médias calculadas sobre a duração registrada."]
        : ["Sem duração e distância combinadas para cálculo de ritmo e velocidade."]),
      ...(old ? ["Referência com mais de 365 dias; não usada automaticamente."] : []),
    ],
    planningInfluence:
      reference.currentWeeklyVolume?.unit === "TIME"
        ? "O volume semanal em tempo pode limitar a proposta, mas não cria duração-base; somente tempo contínuo confortável estruturado pode orientar um bloco contínuo."
        : "Contextualiza histórico e capacidade; distância isolada não cria duração nem intensidade.",
    planningUse: "CONTEXT_ONLY",
    influencedDecisions: ["Influência efetiva será determinada somente após confrontar esta referência com a decisão proposta."],
    selectable,
    selectedByDefault: selectable,
  };
}

export function buildRunningPlanningReferenceSet(input: {
  readonly masterRecordId: string;
  readonly patientId: string;
  readonly executions: readonly PersistedWorkoutExecution[];
  readonly assessments: readonly WorkoutPhysicalAssessmentContext[];
  readonly manualReferenceData?: EnduranceAthleteReferenceData;
  readonly now?: Date;
}): RunningPlanningReferenceSet {
  const now = input.now ?? new Date();
  const executions = input.executions
    .filter((execution) => execution.modality === "RUNNING")
    .map((execution) => executionReference(execution, now));
  const assessments = input.assessments.map((assessment) =>
    assessmentReference(assessment, now),
  );
  const manual = input.manualReferenceData
    ? manualReference(input.manualReferenceData, now)
    : undefined;
  const firstSelectableExecutionId = executions.find(
    (reference) => reference.selectable,
  )?.id;
  const manualDuplicatesExecution = Boolean(
    input.manualReferenceData?.recentPerformance?.sourceExecutionId &&
      executions.some(
        (reference) =>
          reference.id ===
          `execution:${input.manualReferenceData?.recentPerformance?.sourceExecutionId}`,
      ),
  );
  const references = [
    ...executions.map((reference) => ({
      ...reference,
      selectedByDefault: reference.id === firstSelectableExecutionId,
    })),
    ...assessments,
    ...(manual
      ? [{
          ...manual,
          selectedByDefault:
            manual.selectedByDefault && !manualDuplicatesExecution,
        }]
      : []),
  ];

  return {
    masterRecordId: input.masterRecordId,
    patientId: input.patientId,
    references,
    selectedReferenceIds: references
      .filter((reference) => reference.selectedByDefault)
      .map((reference) => reference.id),
    generatedAt: now.toISOString(),
  };
}

export function selectedRunningPlanningReferences(
  referenceSet: RunningPlanningReferenceSet,
  selectedIds: readonly string[],
) {
  const selected = new Set(selectedIds);
  return referenceSet.references.filter(
    (reference) => reference.selectable && selected.has(reference.id),
  );
}

function sameReferenceContent(
  left: RunningPlanningReference,
  right: RunningPlanningReference,
) {
  return left.id === right.id &&
    left.recordedAt === right.recordedAt &&
    left.durationSeconds === right.durationSeconds &&
    left.distanceMeters === right.distanceMeters &&
    left.comfortableContinuousDurationSeconds === right.comfortableContinuousDurationSeconds &&
    JSON.stringify(left.historicalFacts) === JSON.stringify(right.historicalFacts);
}

/**
 * Reconciles the confirmed editor state with the server response without
 * pretending that an unsaved manual reference is already persisted.
 */
export function withLocalRunningManualReference(input: {
  readonly referenceSet: RunningPlanningReferenceSet;
  readonly manualReferenceData?: EnduranceAthleteReferenceData;
  readonly now?: Date;
}): RunningPlanningReferenceSet {
  if (!input.manualReferenceData) return input.referenceSet;
  const local = manualReference(input.manualReferenceData, input.now ?? new Date());
  if (!local) return input.referenceSet;
  const persisted = input.referenceSet.references.find(
    (reference) =>
      reference.kind === "MANUAL_REFERENCE" &&
      sameReferenceContent(reference, local),
  );
  if (persisted) return input.referenceSet;

  const serverManualIds = new Set(
    input.referenceSet.references
      .filter((reference) => reference.kind === "MANUAL_REFERENCE")
      .map((reference) => reference.id),
  );
  const localReference: RunningPlanningReference = {
    ...local,
    origin: `${local.origin} · estado local ainda não salvo`,
    limitations: [
      ...local.limitations,
      "Referência confirmada no editor atual; a persistência no servidor ainda não foi verificada.",
    ],
    selectedByDefault: local.selectable,
  };
  const selectedReferenceIds = input.referenceSet.selectedReferenceIds.filter(
    (id) => !serverManualIds.has(id),
  );
  if (
    localReference.selectable &&
    !selectedReferenceIds.includes(localReference.id)
  ) {
    selectedReferenceIds.push(localReference.id);
  }

  return {
    ...input.referenceSet,
    references: [
      ...input.referenceSet.references.filter(
        (reference) => reference.kind !== "MANUAL_REFERENCE",
      ),
      localReference,
    ],
    selectedReferenceIds,
  };
}
