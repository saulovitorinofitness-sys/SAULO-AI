import type {
  EnduranceIntensityTarget,
  EnduranceSessionBlock,
  EnduranceSessionStage,
  EnduranceStageCompletion,
  RunningEnvironment,
  StructuredEnduranceSession,
} from "./endurance-workout-contracts";
import {
  createRunningSessionFromTemplate,
  runningPrescriptionTotals,
  weekdayFromIsoDate,
  type EditableRunningSessionProposal,
  type RunningPlanningDecisionBasis,
  type RunningProposalApplicationMode,
} from "./running-session-editor";
import type {
  WorkoutPlanEnduranceModality,
  WorkoutPlanEnduranceWeek,
  WorkoutWeekday,
} from "./workout-contracts";
import type { RunningPlanningReference } from "./running-planning-references";

export type RunningExperience = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export type RunningCurrentPractice =
  | "NO_CURRENT_RUNNING"
  | "IRREGULAR"
  | "REGULAR";

export type RunningReturnContext =
  | "UNKNOWN"
  | "PAUSE_WITHOUT_INJURY"
  | "INJURY_REHABILITATION";

export const ASSISTED_RUNNING_ENGINE = {
  kind: "DETERMINISTIC_RULES",
  usesArtificialIntelligence: false,
  description: "Regras fixas organizam fatos e decisões profissionais; não há chamada a modelo de IA.",
} as const;

export type AssistedRunningSessionFormat =
  | "CONTINUOUS"
  | "WALK_RUN"
  | "INTERVAL";

export type AssistedRunningPrescribedDose = Exclude<
  EnduranceStageCompletion,
  { readonly type: "OPEN_MANUAL" }
>;

export interface AssistedRunningDayStrategy {
  readonly weekday: WorkoutWeekday;
  readonly format: AssistedRunningSessionFormat;
  readonly sessionObjective: string;
  readonly warmUp?: AssistedRunningPrescribedDose;
  readonly warmUpInstruction?: string;
  readonly work: AssistedRunningPrescribedDose;
  readonly repetitions?: number;
  readonly recovery?: AssistedRunningPrescribedDose;
  readonly coolDown?: AssistedRunningPrescribedDose;
  readonly coolDownInstruction?: string;
  readonly workIntensity: EnduranceIntensityTarget;
  readonly recoveryIntensity?: EnduranceIntensityTarget;
  readonly rationale?: string;
}

export type AssistedRunningKnownOrUnknown<T> = T | "UNKNOWN";

export interface AssistedRunningSharedStrategy {
  readonly format?: AssistedRunningKnownOrUnknown<AssistedRunningSessionFormat>;
  readonly work?: AssistedRunningPrescribedDose;
  readonly repetitions?: number;
  readonly recovery?: AssistedRunningPrescribedDose;
  readonly workIntensity?: EnduranceIntensityTarget;
  readonly intensityUnknown?: boolean;
  readonly warmUp?: AssistedRunningPrescribedDose;
  readonly coolDown?: AssistedRunningPrescribedDose;
}

export interface AssistedRunningQuestion {
  readonly id: "CURRENT_PRACTICE" | "CONTINUOUS_CAPACITY" | "RETURN_CONTEXT" | "REHABILITATION_INDICATION" | "FORMAT" | "WORK" | "REPETITIONS" | "RECOVERY" | "INTENSITY" | "SAFETY_REVIEW";
  readonly question: string;
  readonly reason: string;
  readonly allowsUnknown: true;
}

export interface AssistedRunningProfessionalStrategy {
  readonly comfortableContinuousDurationSeconds?: number;
  readonly currentPractice?: RunningCurrentPractice;
  readonly sessionObjective?: string;
  readonly recentReturn?: boolean;
  readonly returnContext?: RunningReturnContext;
  readonly rehabilitationProtocolIndicated?: boolean;
  readonly explicitRestrictions?: readonly string[];
  readonly rationale?: string;
  readonly safetyContextReviewed?: boolean;
  /** One professional decision reused on the selected days; avoids a full form per day. */
  readonly sharedStrategy?: AssistedRunningSharedStrategy;
  /** Dose prescribed by the professional. Current capacity is never copied here. */
  readonly sessions?: readonly AssistedRunningDayStrategy[];
  /** Optional explicit changes for a specific week; no progression is inferred. */
  readonly weekSessions?: Readonly<Record<string, readonly AssistedRunningDayStrategy[]>>;
}

const weekdayLabel: Readonly<Record<WorkoutWeekday, string>> = {
  MONDAY: "segunda-feira",
  TUESDAY: "terça-feira",
  WEDNESDAY: "quarta-feira",
  THURSDAY: "quinta-feira",
  FRIDAY: "sexta-feira",
  SATURDAY: "sábado",
  SUNDAY: "domingo",
};

export interface AssistedRunningWeekInput {
  readonly running: WorkoutPlanEnduranceModality<"RUNNING">;
  readonly targetWeekId: string;
  readonly objective: string;
  readonly runningWeeklyFrequency: number;
  readonly experience: RunningExperience;
  readonly availableWeekdays: readonly WorkoutWeekday[];
  readonly sessionDurationMinutes: number;
  readonly selectedReferences?: readonly RunningPlanningReference[];
  readonly professionalStrategy?: AssistedRunningProfessionalStrategy;
  readonly idFactory?: () => string;
}

export type AssistedRunningPeriodInput = Omit<
  AssistedRunningWeekInput,
  "targetWeekId"
>;

export interface RunningAvailabilityStatus {
  readonly diverges: boolean;
  readonly availableDayCount: number;
  readonly plannedFrequency: number;
  readonly message?: string;
}

const weekdayOffset: Readonly<Record<WorkoutWeekday, number>> = {
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
  SATURDAY: 5,
  SUNDAY: 6,
};

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function dateAtWeekday(weekStart: string, weekday: WorkoutWeekday) {
  const date = new Date(`${weekStart}T12:00:00Z`);
  const startWeekday = weekdayFromIsoDate(weekStart);
  const startOffset = startWeekday ? weekdayOffset[startWeekday] : 0;
  const offsetWithinPlanWeek =
    (weekdayOffset[weekday] - startOffset + 7) % 7;
  date.setUTCDate(date.getUTCDate() + offsetWithinPlanWeek);
  return date.toISOString().slice(0, 10);
}

function isoDateAfterDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(startDate: string, endDate: string) {
  return Math.round(
    (new Date(`${endDate}T12:00:00Z`).getTime() -
      new Date(`${startDate}T12:00:00Z`).getTime()) /
      86_400_000,
  );
}

function runningPeriodEndDate(
  running: WorkoutPlanEnduranceModality<"RUNNING">,
) {
  return isoDateAfterDays(
    running.configuration.startDate,
    running.configuration.cycleDurationWeeks * 7 - 1,
  );
}

function periodWeeks(
  running: WorkoutPlanEnduranceModality<"RUNNING">,
  idFactory: () => string,
): readonly WorkoutPlanEnduranceWeek<"RUNNING">[] {
  const periodStart = running.configuration.startDate;
  const periodEnd = runningPeriodEndDate(running);
  const result: WorkoutPlanEnduranceWeek<"RUNNING">[] = [];
  let startDate = periodStart;

  while (startDate <= periodEnd) {
    const weekday = weekdayFromIsoDate(startDate) ?? "MONDAY";
    const daysUntilSunday = 6 - weekdayOffset[weekday];
    const endDate = [isoDateAfterDays(startDate, daysUntilSunday), periodEnd]
      .sort()[0];
    result.push({
      id: idFactory(),
      weekNumber: result.length + 1,
      startDate,
      endDate,
      phase: "A definir",
      objective: "A definir",
      weeklyGuidance: "A definir",
      sessions: [],
    });
    startDate = isoDateAfterDays(endDate, 1);
  }
  return result;
}

function prescribedStage(
  stage: EnduranceSessionStage,
  completion: AssistedRunningPrescribedDose,
  intensityTarget: EnduranceIntensityTarget,
  instruction: string,
): EnduranceSessionStage {
  return { ...stage, completion, intensityTarget, studentInstruction: instruction };
}

function intensityInstruction(target: EnduranceIntensityTarget) {
  if (target.type === "FREE_GUIDANCE") return target.guidance;
  if (target.type === "NONE") return "Intensidade a revisar pelo profissional.";
  if (target.target.valueType === "SINGLE") {
    const value = target.target.value;
    if (target.type === "RPE") return `RPE ${value}.`;
    if (target.type === "HEART_RATE") return `${value} bpm.`;
    if (target.type === "PACE") return `Alvo estruturado de ${Math.round(value)} s/km.`;
    if (target.type === "POWER") return `${value} W.`;
    return `${value} passos/min.`;
  }
  const { minimum, maximum } = target.target;
  if (target.type === "RPE") return `RPE ${minimum} a ${maximum}.`;
  if (target.type === "HEART_RATE") return `${minimum} a ${maximum} bpm.`;
  if (target.type === "PACE") return `${Math.round(minimum)} a ${Math.round(maximum)} s/km.`;
  if (target.type === "POWER") return `${minimum} a ${maximum} W.`;
  return `${minimum} a ${maximum} passos/min.`;
}

function primaryIntensityMethod(target: EnduranceIntensityTarget) {
  if (target.type === "PACE" && target.preferredDisplay === "SPEED") return "SPEED" as const;
  return target.type;
}

function stageFromTemplate(base: StructuredEnduranceSession, type: EnduranceSessionStage["type"]) {
  for (const block of base.blocks) {
    const stages = block.blockType === "STAGE" ? [block.stage] : block.stages;
    const found = stages.find((stage) => stage.type === type);
    if (found) return found;
  }
  throw new Error(`RUNNING_TEMPLATE_${type}_STAGE_REQUIRED`);
}

function buildSession(input: {
  readonly scheduledDate: string;
  readonly weekday: WorkoutWeekday;
  readonly environment: Extract<RunningEnvironment, "ROAD" | "TRACK" | "TREADMILL">;
  readonly strategy: AssistedRunningDayStrategy;
  readonly idFactory: () => string;
}): StructuredEnduranceSession & { readonly modality: "RUNNING" } {
  const base = createRunningSessionFromTemplate({
    templateId: input.strategy.format === "INTERVAL" ? "INTERVAL" : "EASY_RUN",
    scheduledDate: input.scheduledDate,
    weekday: input.weekday,
    environment: input.environment,
    id: input.idFactory,
  });
  const warmUp = stageFromTemplate(base, "WARM_UP");
  const work = stageFromTemplate(base, "WORK");
  const recovery = stageFromTemplate(base, "RECOVERY");
  const coolDown = stageFromTemplate(base, "COOL_DOWN");
  const blocks: EnduranceSessionBlock[] = [];
  if (input.strategy.warmUp) {
    const warmUpInstruction = input.strategy.warmUpInstruction?.trim() ||
      "Aquecimento conforme decisão profissional.";
    blocks.push({ blockType: "STAGE", id: input.idFactory(), order: blocks.length + 1, stage: prescribedStage(
      warmUp, input.strategy.warmUp,
      { type: "FREE_GUIDANCE", guidance: warmUpInstruction },
      input.strategy.warmUpInstruction?.trim() || "Realize o aquecimento prescrito antes do trabalho principal.",
    ) });
  }
  const workStage = prescribedStage(
    work,
    input.strategy.work,
    input.strategy.workIntensity,
    intensityInstruction(input.strategy.workIntensity),
  );
  if (input.strategy.format === "CONTINUOUS") {
    blocks.push({ blockType: "STAGE", id: input.idFactory(), order: blocks.length + 1, stage: workStage });
  } else {
    const recoveryIntensity = input.strategy.recoveryIntensity ?? {
      type: "FREE_GUIDANCE" as const,
      guidance: input.strategy.format === "WALK_RUN"
        ? "Caminhe durante a recuperação prescrita."
        : "Recupere conforme a orientação profissional.",
    };
    blocks.push({
      blockType: "REPEAT",
      id: input.idFactory(),
      order: blocks.length + 1,
      repetitions: input.strategy.repetitions!,
      includeRecoveryAfterLast: false,
      stages: [
        workStage,
        prescribedStage(recovery, input.strategy.recovery!, recoveryIntensity, intensityInstruction(recoveryIntensity)),
      ],
    });
  }
  if (input.strategy.coolDown) {
    const coolDownInstruction = input.strategy.coolDownInstruction?.trim() ||
      "Volta à calma conforme decisão profissional.";
    blocks.push({ blockType: "STAGE", id: input.idFactory(), order: blocks.length + 1, stage: prescribedStage(
      coolDown, input.strategy.coolDown,
      { type: "FREE_GUIDANCE", guidance: coolDownInstruction },
      input.strategy.coolDownInstruction?.trim() || "Realize a volta à calma prescrita após o trabalho principal.",
    ) });
  }
  const draft: StructuredEnduranceSession & { readonly modality: "RUNNING" } = {
    ...base,
    title: input.strategy.format === "CONTINUOUS"
      ? "Corrida contínua"
      : input.strategy.format === "WALK_RUN"
        ? "Alternância caminhada/corrida"
        : "Intervalado definido pelo profissional",
    sessionType: input.strategy.format,
    objective: input.strategy.sessionObjective.trim(),
    primaryUnit: input.strategy.work.type,
    primaryIntensityMethod: primaryIntensityMethod(input.strategy.workIntensity),
    professionalGuidance: input.strategy.rationale?.trim() ||
      "Dose, intensidade e recuperação definidas explicitamente pelo profissional.",
    blocks,
  };
  const totals = runningPrescriptionTotals(draft);
  return {
    ...draft,
    estimatedDurationSeconds: totals.durationCompleteness === "PRESCRIBED" ? totals.durationSeconds : undefined,
    estimatedDistanceMeters: totals.distanceCompleteness === "PRESCRIBED" ? totals.distanceMeters : undefined,
  };
}

function validateGenerationInput(input: AssistedRunningPeriodInput) {
  if (!input.objective.trim()) throw new Error("RUNNING_OBJECTIVE_REQUIRED");
  if (!Number.isInteger(input.runningWeeklyFrequency) || input.runningWeeklyFrequency < 1 || input.runningWeeklyFrequency > 7) {
    throw new Error("RUNNING_FREQUENCY_REQUIRED");
  }
  if (!Number.isFinite(input.sessionDurationMinutes) || input.sessionDurationMinutes < 15) {
    throw new Error("RUNNING_SESSION_DURATION_REQUIRED");
  }
}

function fallbackConfigurationReference(
  running: WorkoutPlanEnduranceModality<"RUNNING">,
): RunningPlanningReference | undefined {
  const reference = running.configuration.athleteReferenceData;
  if (!reference) return undefined;
  const timeVolume = reference.currentWeeklyVolume?.unit === "TIME"
    ? reference.currentWeeklyVolume.durationSeconds
    : undefined;
  const distanceVolume = reference.currentWeeklyVolume?.unit === "DISTANCE"
    ? reference.currentWeeklyVolume.distanceMeters
    : undefined;
  return {
    id: `manual:${reference.updatedAt ?? "current-configuration"}`,
    kind: "MANUAL_REFERENCE",
    recordedAt: reference.updatedAt,
    title: "Referência atual registrada",
    origin: reference.updatedAt
      ? "Configuração persistida da Corrida"
      : "Configuração local da Corrida",
    modality: "RUNNING",
    comfortableContinuousDurationSeconds: reference.comfortableContinuousDurationSeconds,
    weeklyVolumeDurationSeconds: timeVolume,
    weeklyVolumeDistanceMeters: distanceVolume,
    currentContinuousDistanceMeters: reference.currentContinuousDistanceMeters,
    longestRecentDistanceMeters: reference.longestRecentDistanceMeters,
    recentHistory: reference.recentHistory?.trim() || undefined,
    historicalFacts: [
      ...(reference.recentHistory?.trim() ? [`Histórico informado: ${reference.recentHistory.trim()}`] : []),
      ...(timeVolume ? [`Volume semanal informado: ${Math.round(timeVolume / 60)} min`] : []),
      ...(distanceVolume ? [`Volume semanal informado: ${(distanceVolume / 1_000).toFixed(2)} km`] : []),
    ],
    limitations: ["Dados declarados pelo profissional; não classificados como teste máximo ou melhor marca."],
    planningInfluence: timeVolume
      ? "O volume semanal em tempo funciona somente como teto; não cria duração-base."
      : "Contextualiza a revisão sem criar ritmo, zona ou duração.",
    planningUse: "CONTEXT_ONLY",
    influencedDecisions: ["A influência efetiva será registrada após a geração."],
    selectable: true,
    selectedByDefault: true,
  };
}

function effectivePlanningReferences(input: AssistedRunningPeriodInput) {
  const fallback = fallbackConfigurationReference(input.running);
  const strategyCapacity = input.professionalStrategy?.comfortableContinuousDurationSeconds;
  const localCapacity: RunningPlanningReference | undefined =
    typeof strategyCapacity === "number" && strategyCapacity > 0
      ? {
          id: "professional-panel:current-capacity",
          kind: "MANUAL_REFERENCE",
          title: "Capacidade atual informada no painel",
          origin: "Painel da proposta assistida",
          modality: "RUNNING",
          comfortableContinuousDurationSeconds: strategyCapacity,
          historicalFacts: [`Tempo contínuo confortável atual informado: ${Math.round(strategyCapacity / 60)} min.`],
          limitations: ["Capacidade atual contextual; não é dose prescrita e não foi copiada para as sessões."],
          planningInfluence: "Exibido para revisão da dose profissional, sem preencher blocos automaticamente.",
          planningUse: "CONTEXT_ONLY",
          influencedDecisions: ["Não alterou objetivo, blocos, duração, intensidade ou recuperação."],
          selectable: true,
          selectedByDefault: true,
        }
      : undefined;
  if (input.selectedReferences !== undefined) {
    const references = [...input.selectedReferences];
    if (
      references.length > 0 &&
      fallback &&
      !references.some((reference) => reference.kind === "MANUAL_REFERENCE")
    ) {
      references.push(fallback);
    }
    if (localCapacity && !references.some((reference) =>
      reference.comfortableContinuousDurationSeconds === strategyCapacity,
    )) references.push(localCapacity);
    return references;
  }
  return [fallback, localCapacity].filter((reference): reference is RunningPlanningReference => Boolean(reference));
}

function timeVolumeFromReferences(
  selectedReferences: readonly RunningPlanningReference[],
) {
  const values = selectedReferences.flatMap((reference) =>
    typeof reference.weeklyVolumeDurationSeconds === "number" &&
    reference.weeklyVolumeDurationSeconds > 0
      ? [reference.weeklyVolumeDurationSeconds]
      : [],
  );
  return values.length ? Math.min(...values) : undefined;
}

function distanceVolumeFromReferences(
  selectedReferences: readonly RunningPlanningReference[],
) {
  const values = selectedReferences.flatMap((reference) =>
    typeof reference.weeklyVolumeDistanceMeters === "number" &&
    reference.weeklyVolumeDistanceMeters > 0
      ? [reference.weeklyVolumeDistanceMeters]
      : [],
  );
  return values.length ? Math.min(...values) : undefined;
}

function safetyContext(input: AssistedRunningPeriodInput) {
  const references = effectivePlanningReferences(input);
  const recentReturn = Boolean(
    input.professionalStrategy?.recentReturn || references.some((reference) => reference.recentReturn),
  );
  const restrictions = [
    ...(input.professionalStrategy?.explicitRestrictions ?? []),
    ...references.flatMap((reference) => reference.explicitRestrictions ?? []),
  ].filter((value) => value.trim());
  return {
    recentReturn,
    restrictions,
    reviewed: Boolean(input.professionalStrategy?.safetyContextReviewed),
  };
}

function individualReferenceReview(
  objective: string,
  weeklyFrequency: number,
  selectedReferences: readonly RunningPlanningReference[],
) {
  const timeVolume = timeVolumeFromReferences(selectedReferences);
  const selectedExecution = selectedReferences.find((reference) =>
    reference.kind === "EXECUTION" &&
    typeof reference.durationSeconds === "number" &&
    reference.durationSeconds > 0,
  );
  const hasDistanceNeedingConversion = selectedReferences.some((reference) =>
    Boolean(
      reference.distanceMeters ||
      reference.weeklyVolumeDistanceMeters ||
      reference.currentContinuousDistanceMeters ||
      reference.longestRecentDistanceMeters
    ) && !reference.durationSeconds && !reference.comfortableContinuousDurationSeconds,
  );
  const reviewNotes = selectedReferences.length
    ? ["As referências selecionadas fundamentaram somente as decisões compatíveis com seus dados estruturados; não foi inferida classificação fisiológica."]
    : ["Nenhuma referência de desempenho estava disponível; a ausência de relógio não impediu a geração e nenhuma métrica histórica foi inventada."];
  if (hasDistanceNeedingConversion) {
    reviewNotes.push(
      "A distância sem tempo correspondente permaneceu contextual e não foi convertida em duração, ritmo ou velocidade.",
    );
  }
  if (timeVolume) {
    reviewNotes.push(
      `O volume semanal informado de ${Math.round(timeVolume / 60)} min e o tempo disponível permaneceram apenas como tetos; a proposta não precisa consumi-los integralmente.`,
    );
  } else {
    reviewNotes.push(
      "Sem volume semanal em tempo, nenhuma duração foi inferida pelo rótulo de experiência; o tempo disponível permaneceu apenas como teto.",
    );
  }
  if (selectedExecution) {
    reviewNotes.push(
      `A execução comum de ${Math.round(selectedExecution.durationSeconds! / 60)} min foi considerada como fato histórico e limitação de contexto; uma única execução não foi repetida como duração obrigatória das sessões.`,
    );
  }
  reviewNotes.push(
    "Revisar duração, blocos e intensidade individual antes de aplicar.",
  );
  if (/\b(taf|prova|teste)\b/u.test(normalized(objective))) {
    reviewNotes.push("O resultado desejado foi tratado como meta futura e não foi usado como desempenho atual.");
  }
  return reviewNotes;
}

function professionalStrategiesForWeek(
  input: AssistedRunningPeriodInput,
  weekStart?: string,
): readonly AssistedRunningDayStrategy[] {
  const detailed = weekStart && input.professionalStrategy?.weekSessions?.[weekStart]
    ? input.professionalStrategy.weekSessions[weekStart]
    : input.professionalStrategy?.sessions ?? [];
  if (detailed.length) return detailed;
  const shared = input.professionalStrategy?.sharedStrategy;
  if (
    !shared || !shared.format || shared.format === "UNKNOWN" ||
    !validDose(shared.work) || !shared.workIntensity || shared.intensityUnknown
  ) return [];
  return prescribedWeekdays(input).map((weekday) => ({
    weekday,
    format: shared.format as AssistedRunningSessionFormat,
    sessionObjective: shared.format === "CONTINUOUS"
      ? "Realizar a corrida contínua definida para esta sessão."
      : shared.format === "WALK_RUN"
        ? "Realizar a alternância entre caminhada e corrida definida para esta sessão."
        : "Realizar o intervalado definido pelo profissional para esta sessão.",
    warmUp: shared.warmUp,
    work: shared.work!,
    repetitions: shared.repetitions,
    recovery: shared.recovery,
    coolDown: shared.coolDown,
    workIntensity: shared.workIntensity!,
    rationale: "Estrutura comum informada pelo profissional e conferida com os fatos e tetos disponíveis.",
  }));
}

export interface AssistedRunningModelSelection {
  readonly id: "REGULAR_CONTINUOUS" | "BEGINNER_WALK_RUN" | "RETURN_GENERAL_WALK_RUN" | "RETURN_REHABILITATION";
  readonly name: string;
  readonly criteria: readonly string[];
  readonly factsUsed: readonly string[];
  readonly technicalSource: string;
  readonly limitations: readonly string[];
}

interface SuggestedRunningModel extends AssistedRunningModelSelection {
  readonly strategy: Omit<AssistedRunningDayStrategy, "weekday">;
}

const NHS_COUCH_TO_5K_SOURCE =
  "NHS Better Health, Couch to 5K, semana 1 (https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/couch-to-5k-running-plan/)";
const HARRIS_HAYES_RETURN_SOURCE =
  "Harris-Hayes et al., BMJ Open Sport & Exercise Medicine 2020, material suplementar, nível 1 (doi:10.1136/bmjsem-2019-000707)";

function comfortableContinuousCeiling(references: readonly RunningPlanningReference[]) {
  const values = references
    .map((reference) => reference.comfortableContinuousDurationSeconds)
    .filter((value): value is number => typeof value === "number" && value > 0);
  return values.length ? Math.min(...values) : undefined;
}

function regularContinuousModel(
  input: AssistedRunningPeriodInput,
  references: readonly RunningPlanningReference[],
  capacitySeconds: number,
): SuggestedRunningModel {
  const weeklyTimeCeiling = timeVolumeFromReferences(references);
  const candidates = [
    input.sessionDurationMinutes * 60,
    capacitySeconds,
    ...(weeklyTimeCeiling ? [weeklyTimeCeiling / input.runningWeeklyFrequency] : []),
  ];
  const workDurationSeconds = Math.max(60, Math.floor(Math.min(...candidates) / 60) * 60);
  return {
    id: "REGULAR_CONTINUOUS",
    name: "Corrida contínua compatível com a prática atual",
    criteria: [
      "Prática atual explicitamente informada como regular.",
      "Capacidade contínua confortável registrada em tempo.",
      "Ausência de retorno recente sinalizado.",
      "Duração limitada pela disponibilidade, capacidade informada e, quando disponível, volume semanal em tempo dividido pela frequência.",
    ],
    factsUsed: [
      `Capacidade contínua confortável informada: ${Math.round(capacitySeconds / 60)} min.`,
      `Disponibilidade máxima por sessão: ${input.sessionDurationMinutes} min.`,
      ...(weeklyTimeCeiling
        ? [`Volume semanal atual informado: ${Math.round(weeklyTimeCeiling / 60)} min para ${input.runningWeeklyFrequency} sessão(ões).`]
        : ["Volume semanal em tempo não informado; não foi estimado."]),
    ],
    technicalSource: "Sem limiar externo: distribui somente fatos atuais informados e respeita seus tetos; a meta futura não é tratada como desempenho.",
    limitations: [
      "A duração é um parâmetro sugerido, não uma execução histórica.",
      "A repetição entre dias é intencional porque não há dado que sustente sessões diferentes.",
    ],
    strategy: {
      format: "CONTINUOUS",
      sessionObjective: "Realizar uma proposta contínua compatível com a prática atual registrada.",
      work: { type: "TIME", durationSeconds: workDurationSeconds },
      workIntensity: {
        type: "FREE_GUIDANCE",
        guidance: "Esforço confortável conforme a capacidade informada, a confirmar pelo profissional.",
      },
      rationale: "Modelo contínuo selecionado porque prática regular e capacidade contínua confortável foram informadas; a duração sugerida respeita somente os tetos disponíveis.",
    },
  };
}

function beginnerWalkRunModel(
  input: AssistedRunningPeriodInput,
  references: readonly RunningPlanningReference[] = [],
): SuggestedRunningModel {
  const weeklyTimeCeiling = timeVolumeFromReferences(references);
  const modelDurationSeconds = 28.5 * 60;
  const useNhsModel =
    input.sessionDurationMinutes * 60 >= modelDurationSeconds &&
    (!weeklyTimeCeiling || weeklyTimeCeiling / input.runningWeeklyFrequency >= modelDurationSeconds);
  return {
    id: "BEGINNER_WALK_RUN",
    name: "Entrada com alternância caminhada/corrida",
    criteria: [
      "Capacidade para corrida contínua não estabelecida ou prática atual não regular.",
      "O formato contínuo não é presumido a partir de experiência, objetivo ou disponibilidade.",
      "O modelo publicado precisa caber no teto por sessão e, quando informado, no volume semanal em tempo dividido pela frequência.",
    ],
    factsUsed: [
      `Experiência registrada: ${input.experience}.`,
      `Prática atual informada: ${input.professionalStrategy?.currentPractice ?? "não informada"}.`,
      `Disponibilidade máxima por sessão: ${input.sessionDurationMinutes} min.`,
      ...(weeklyTimeCeiling
        ? [`Volume semanal atual informado: ${Math.round(weeklyTimeCeiling / 60)} min para ${input.runningWeeklyFrequency} sessão(ões).`]
        : ["Volume semanal em tempo não informado; não foi estimado."]),
      "Capacidade contínua confortável: não estabelecida para selecionar corrida contínua.",
      ...(useNhsModel
        ? ["Estrutura NHS: oito trabalhos de corrida e sete recuperações entre eles; total de 28 min 30 s incluindo caminhada inicial e final."]
        : []),
    ],
    technicalSource: useNhsModel ? NHS_COUCH_TO_5K_SOURCE : HARRIS_HAYES_RETURN_SOURCE,
    limitations: [
      "É um modelo externo de entrada, não uma individualização comprovada pelo desempenho do aluno.",
      "A aptidão e a tolerância para iniciar corrida precisam de revisão profissional antes da aplicação.",
      "O espaçamento e a recuperação entre os dias disponíveis precisam de revisão; o gerador não move os dias cadastrados.",
    ],
    strategy: useNhsModel
      ? {
          format: "WALK_RUN",
          sessionObjective: "Experimentar uma alternância inicial de caminhada e corrida para revisão.",
          warmUp: { type: "TIME", durationSeconds: 5 * 60 },
          warmUpInstruction: "Caminhar por 5 minutos.",
          work: { type: "TIME", durationSeconds: 60 },
          repetitions: 8,
          recovery: { type: "TIME", durationSeconds: 90 },
          coolDown: { type: "TIME", durationSeconds: 5 * 60 },
          coolDownInstruction: "Caminhar por 5 minutos.",
          workIntensity: { type: "FREE_GUIDANCE", guidance: "Corrida em ritmo próprio e confortável; interromper se algo não estiver bem." },
          recoveryIntensity: { type: "FREE_GUIDANCE", guidance: "Caminhada durante a recuperação prevista pelo modelo." },
          rationale: "Modelo NHS Couch to 5K, semana 1: oito trabalhos de corrida de 1 min e sete recuperações de caminhada de 1 min 30 s entre eles, com 5 min de caminhada inicial e 5 min de caminhada final; total de 28 min 30 s.",
        }
      : {
          format: "WALK_RUN",
          sessionObjective: "Experimentar o menor nível publicado de alternância para revisão.",
          work: { type: "TIME", durationSeconds: 15 },
          repetitions: 4,
          recovery: { type: "TIME", durationSeconds: 45 },
          coolDown: { type: "TIME", durationSeconds: 45 },
          workIntensity: { type: "FREE_GUIDANCE", guidance: "Corrida leve e controlada; interromper se algo não estiver bem." },
          recoveryIntensity: { type: "FREE_GUIDANCE", guidance: "Caminhada durante a recuperação prevista pelo modelo." },
          rationale: "Modelo publicado de reentrada, nível 1: 15 s de corrida e 45 s de caminhada por 4 ciclos; a última caminhada é representada como volta à calma.",
        },
  };
}

function rehabilitationReturnModel(input: AssistedRunningPeriodInput): SuggestedRunningModel {
  const base = beginnerWalkRunModel({ ...input, sessionDurationMinutes: Math.min(input.sessionDurationMinutes, 15) });
  return {
    ...base,
    id: "RETURN_REHABILITATION",
    name: "Reentrada associada a lesão/reabilitação",
    criteria: [
      "Retorno recente explicitamente sinalizado.",
      "Contexto explicitamente classificado como lesão/reabilitação.",
      "Uso do protocolo de reabilitação explicitamente indicado pelo profissional.",
      "O histórico anterior não autoriza retomar automaticamente corrida contínua, volume ou intensidade.",
      "Selecionado o primeiro nível do exemplo publicado; não há progressão automática.",
    ],
    factsUsed: [
      "Retorno recente: informado.",
      `Disponibilidade máxima por sessão: ${input.sessionDurationMinutes} min.`,
      "Capacidade anterior, quando existente, mantida como contexto e não copiada como dose de retorno.",
    ],
    technicalSource: HARRIS_HAYES_RETURN_SOURCE,
    limitations: [
      "O motivo e a duração da interrupção não estão estruturados; o modelo exige revisão profissional.",
      "O protocolo publicado é referência de reentrada e não substitui avaliação clínica ou liberação quando necessária.",
      "O espaçamento e a recuperação entre os dias disponíveis precisam de revisão; o gerador não move os dias cadastrados.",
    ],
  };
}

function generalReturnModel(
  input: AssistedRunningPeriodInput,
  references: readonly RunningPlanningReference[],
): SuggestedRunningModel {
  const base = beginnerWalkRunModel(input, references);
  if (base.technicalSource === HARRIS_HAYES_RETURN_SOURCE) {
    throw new Error("RUNNING_GENERAL_RETURN_MODEL_EXCEEDS_AVAILABILITY");
  }
  const context = input.professionalStrategy?.returnContext ?? "UNKNOWN";
  return {
    ...base,
    id: "RETURN_GENERAL_WALK_RUN",
    name: "Retomada geral após pausa",
    criteria: [
      "Retorno recente explicitamente sinalizado.",
      context === "PAUSE_WITHOUT_INJURY"
        ? "Pausa explicitamente informada como não associada a lesão."
        : "Motivo da interrupção desconhecido; nenhuma lesão foi presumida.",
      "Ausência de indicação profissional explícita para protocolo de reabilitação.",
      "Selecionado modelo geral de entrada, sem progressão automática.",
    ],
    factsUsed: [
      "Retorno recente: informado.",
      `Contexto do retorno: ${context === "PAUSE_WITHOUT_INJURY" ? "pausa sem lesão" : "desconhecido"}.`,
      `Disponibilidade máxima por sessão: ${input.sessionDurationMinutes} min.`,
      "Histórico anterior mantido como contexto; não foi copiado como dose de retorno.",
    ],
    limitations: [
      ...(context === "UNKNOWN"
        ? ["O motivo da interrupção não foi informado; a proposta não presume lesão e exige revisão profissional."]
        : ["A duração e os efeitos da pausa não estão estruturados; a proposta exige revisão profissional."]),
      "O modelo NHS é uma referência geral de entrada, não um protocolo de reabilitação nem individualização comprovada.",
      "O espaçamento e a recuperação entre os dias disponíveis precisam de revisão; o gerador não move os dias cadastrados.",
    ],
  };
}

function suggestedModel(
  input: AssistedRunningPeriodInput,
  references: readonly RunningPlanningReference[],
): SuggestedRunningModel {
  if (safetyContext(input).recentReturn) {
    const rehabilitationExplicitlyIndicated =
      input.professionalStrategy?.returnContext === "INJURY_REHABILITATION" &&
      input.professionalStrategy.rehabilitationProtocolIndicated === true;
    return rehabilitationExplicitlyIndicated
      ? rehabilitationReturnModel(input)
      : generalReturnModel(input, references);
  }
  const capacitySeconds = comfortableContinuousCeiling(references);
  if (input.professionalStrategy?.currentPractice === "REGULAR" && capacitySeconds) {
    return regularContinuousModel(input, references, capacitySeconds);
  }
  return beginnerWalkRunModel(input, references);
}

export function assistedRunningSuggestedModel(
  input: AssistedRunningPeriodInput,
): AssistedRunningModelSelection {
  const model = suggestedModel(input, effectivePlanningReferences(input));
  return {
    id: model.id,
    name: model.name,
    criteria: model.criteria,
    factsUsed: model.factsUsed,
    technicalSource: model.technicalSource,
    limitations: model.limitations,
  };
}

function suggestedStrategiesForWeek(
  input: AssistedRunningPeriodInput,
  references: readonly RunningPlanningReference[],
): readonly AssistedRunningDayStrategy[] {
  const model = suggestedModel(input, references);
  return prescribedWeekdays(input).map((weekday) => ({
    weekday,
    ...model.strategy,
  }));
}

function strategiesForWeek(
  input: AssistedRunningPeriodInput,
  weekStart?: string,
) {
  const professional = professionalStrategiesForWeek(input, weekStart);
  return professional.length
    ? professional
    : suggestedStrategiesForWeek(input, effectivePlanningReferences(input));
}

function usesSuggestedStrategy(
  input: AssistedRunningPeriodInput,
  weekStart?: string,
) {
  return professionalStrategiesForWeek(input, weekStart).length === 0;
}

function validDose(dose: AssistedRunningPrescribedDose | undefined) {
  return dose?.type === "TIME"
    ? Number.isFinite(dose.durationSeconds) && dose.durationSeconds > 0
    : dose?.type === "DISTANCE" && Number.isFinite(dose.distanceMeters) && dose.distanceMeters > 0;
}

function strategyIssues(strategy: AssistedRunningDayStrategy | undefined, weekday: WorkoutWeekday) {
  const issues: string[] = [];
  if (!strategy) return [`Como será o treino de ${weekdayLabel[weekday]}`];
  if (!strategy.sessionObjective.trim()) issues.push(`Finalidade da sessão de ${weekday}`);
  if (!validDose(strategy.work)) issues.push(`Dose de trabalho de ${weekday}`);
  if (strategy.workIntensity.type === "NONE") issues.push(`Intensidade de ${weekday}`);
  if (strategy.format !== "CONTINUOUS") {
    if (!Number.isInteger(strategy.repetitions) || (strategy.repetitions ?? 0) < 1) {
      issues.push(`Repetições de ${weekday}`);
    }
    if (!validDose(strategy.recovery)) issues.push(`Recuperação de ${weekday}`);
  }
  if (strategy.warmUp && !validDose(strategy.warmUp)) issues.push(`Aquecimento de ${weekday}`);
  if (strategy.coolDown && !validDose(strategy.coolDown)) issues.push(`Volta à calma de ${weekday}`);
  return issues;
}

function prescribedWeekdays(input: AssistedRunningPeriodInput) {
  return [...new Set(input.availableWeekdays)].slice(0, input.runningWeeklyFrequency);
}

function generationConflicts(
  input: AssistedRunningPeriodInput,
  sessions: readonly StructuredEnduranceSession[],
  references: readonly RunningPlanningReference[],
) {
  const conflicts: string[] = [];
  const availability = runningAvailabilityStatus(input.runningWeeklyFrequency, input.availableWeekdays);
  if (availability.message) conflicts.push(availability.message);
  for (const session of sessions) {
    const totals = runningPrescriptionTotals(session);
    if (
      totals.durationCompleteness === "PRESCRIBED" &&
      totals.durationSeconds !== undefined &&
      totals.durationSeconds > input.sessionDurationMinutes * 60
    ) {
      conflicts.push(
        `${session.scheduledDate}: prescrição de ${Math.round(totals.durationSeconds / 60)} min excede o teto de ${input.sessionDurationMinutes} min; não foi ajustada.`,
      );
    }
  }
  const timeCeiling = timeVolumeFromReferences(references);
  const distanceCeiling = distanceVolumeFromReferences(references);
  const totals = sessions.map(runningPrescriptionTotals);
  if (timeCeiling && totals.every((total) => total.durationCompleteness === "PRESCRIBED")) {
    const prescribed = totals.reduce((sum, total) => sum + (total.durationSeconds ?? 0), 0);
    if (prescribed > timeCeiling) {
      conflicts.push(`Volume semanal prescrito de ${Math.round(prescribed / 60)} min excede o teto informado de ${Math.round(timeCeiling / 60)} min; não foi redistribuído.`);
    }
  }
  if (distanceCeiling && totals.every((total) => total.distanceCompleteness === "PRESCRIBED")) {
    const prescribed = totals.reduce((sum, total) => sum + (total.distanceMeters ?? 0), 0);
    if (prescribed > distanceCeiling) {
      conflicts.push(`Volume semanal prescrito de ${(prescribed / 1_000).toFixed(2)} km excede o teto informado de ${(distanceCeiling / 1_000).toFixed(2)} km; não foi redistribuído.`);
    }
  }
  return conflicts;
}

function proposalReferences(
  input: AssistedRunningPeriodInput,
  references: readonly RunningPlanningReference[],
  conflicts: readonly string[],
) {
  const model = usesSuggestedStrategy(input)
    ? suggestedModel(input, references)
    : undefined;
  return references.map((reference) => {
    const decisions: string[] = [];
    if (
      model?.id === "REGULAR_CONTINUOUS" &&
      (reference.comfortableContinuousDurationSeconds || reference.weeklyVolumeDurationSeconds)
    ) {
      decisions.push(
        "Fundamentou a elegibilidade do modelo contínuo e/ou limitou sua duração sugerida; não foi convertido em intensidade.",
      );
    }
    if (model?.id.startsWith("RETURN_") && reference.recentReturn) {
      decisions.push("O retorno recente selecionou um modelo de retomada compatível com o contexto informado; a execução anterior não foi copiada como dose.");
    }
    if (
      (reference.weeklyVolumeDurationSeconds || reference.weeklyVolumeDistanceMeters) &&
      conflicts.some((conflict) => conflict.includes("Volume semanal prescrito"))
    ) {
      decisions.push("Foi comparado com a dose explícita e apontou conflito de volume; a prescrição não foi alterada.");
    }
    return {
      ...reference,
      planningUse: decisions.length ? "DECISION" as const : "CONTEXT_ONLY" as const,
      influencedDecisions: decisions.length
        ? decisions
        : [reference.weeklyVolumeDurationSeconds || reference.weeklyVolumeDistanceMeters
            ? "Foi conferido como teto e não alterou objetivo, blocos, duração, intensidade ou recuperação desta proposta."
            : "Exibido como contexto; não alterou objetivo, blocos, duração, intensidade ou recuperação desta proposta."],
      planningInfluence: decisions.length
        ? decisions.join(" ")
        : "Contexto disponível, sem alteração efetiva da proposta.",
    };
  });
}

function missingDecisionInformation(input: AssistedRunningPeriodInput) {
  const safety = safetyContext(input);
  const hasDetailed = Boolean(input.professionalStrategy?.sessions?.length);
  const shared = input.professionalStrategy?.sharedStrategy;
  const missing = hasDetailed
    ? prescribedWeekdays(input).flatMap((weekday) =>
        strategyIssues(professionalStrategiesForWeek(input).find((strategy) => strategy.weekday === weekday), weekday),
      )
    : [
        ...(!shared?.format || shared.format === "UNKNOWN" ? ["Como organizar os treinos"] : []),
        ...(!validDose(shared?.work) ? ["Quantidade de trabalho por treino"] : []),
        ...(shared?.format && shared.format !== "UNKNOWN" && shared.format !== "CONTINUOUS" &&
          (!Number.isInteger(shared.repetitions) || (shared.repetitions ?? 0) < 1)
          ? ["Quantidade de repetições"] : []),
        ...(shared?.format && shared.format !== "UNKNOWN" && shared.format !== "CONTINUOUS" && !validDose(shared.recovery)
          ? ["Recuperação entre repetições"] : []),
        ...(!shared?.workIntensity || shared.intensityUnknown || shared.workIntensity.type === "NONE"
          ? ["Intensidade do trabalho"] : []),
      ];
  if (safety.recentReturn && !safety.reviewed) missing.push("Estratégia revisada para o retorno recente");
  if (safety.restrictions.length && !safety.reviewed) missing.push("Estratégia revisada para as restrições registradas");
  return missing;
}

export function assistedRunningMinimumInformation(
  input: AssistedRunningPeriodInput,
) {
  void input;
  return [] as readonly string[];
}

function proposalReviewLimitations(
  input: AssistedRunningPeriodInput,
  references: readonly RunningPlanningReference[],
  suggestedStrategy: boolean,
) {
  const limitations: string[] = [];
  if (suggestedStrategy) {
    const model = suggestedModel(input, references);
    limitations.push(
      `Modelo sugerido: ${model.name}. Formato, duração e orientação de intensidade são sugestões e precisam de revisão profissional.`,
      ...model.limitations,
    );
  }
  if (suggestedStrategy && !references.some((reference) =>
    reference.kind === "EXECUTION" || reference.kind === "PHYSICAL_ASSESSMENT"
  )) {
    limitations.push(
      "Não há referência de desempenho selecionada; nenhuma métrica histórica foi criada e a proposta precisa de revisão profissional.",
    );
  }
  const safety = safetyContext(input);
  if (safety.recentReturn && !safety.reviewed) {
    limitations.push("O retorno recente ainda precisa de revisão profissional.");
  }
  if (safety.restrictions.length && !safety.reviewed) {
    limitations.push("As restrições registradas ainda precisam de revisão profissional.");
  }
  return limitations;
}

export function assistedRunningQuestions(
  input: AssistedRunningPeriodInput,
): readonly AssistedRunningQuestion[] {
  if (input.professionalStrategy?.sessions?.length) {
    return missingDecisionInformation(input).map((missing, index) => ({
      id: index === 0 ? "WORK" : "INTENSITY",
      question: missing,
      reason: "O formulário detalhado foi iniciado, mas esta decisão ainda não está completa.",
      allowsUnknown: true,
    }));
  }
  const shared = input.professionalStrategy?.sharedStrategy;
  const sharedStarted = Boolean(
    shared?.format || shared?.work || shared?.workIntensity ||
    shared?.repetitions || shared?.recovery,
  );
  if (!sharedStarted) {
    const questions: AssistedRunningQuestion[] = [];
    const safety = safetyContext(input);
    if (!safety.recentReturn && !input.professionalStrategy?.currentPractice) questions.push({
      id: "CURRENT_PRACTICE",
      question: "Qual é a prática atual de Corrida do aluno?",
      reason: "É a única informação que pode mudar a escolha entre um modelo de entrada e um modelo contínuo; experiência declarada não substitui prática atual.",
      allowsUnknown: true,
    });
    if (
      !safety.recentReturn &&
      input.professionalStrategy?.currentPractice === "REGULAR" &&
      !comfortableContinuousCeiling(effectivePlanningReferences(input))
    ) questions.push({
      id: "CONTINUOUS_CAPACITY",
      question: "Há um tempo contínuo confortável atual conhecido?",
      reason: "Sem essa capacidade, prática regular isolada não autoriza sugerir duração contínua.",
      allowsUnknown: true,
    });
    if (
      safety.recentReturn &&
      (!input.professionalStrategy?.returnContext || input.professionalStrategy.returnContext === "UNKNOWN")
    ) questions.push({
      id: "RETURN_CONTEXT",
      question: "A interrupção ocorreu sem lesão ou está associada a lesão/reabilitação?",
      reason: "Motivo desconhecido não autoriza presumir lesão nem selecionar um protocolo de reabilitação.",
      allowsUnknown: true,
    });
    if (
      safety.recentReturn &&
      input.professionalStrategy?.returnContext === "INJURY_REHABILITATION" &&
      !input.professionalStrategy.rehabilitationProtocolIndicated
    ) questions.push({
      id: "REHABILITATION_INDICATION",
      question: "O profissional indicou explicitamente o protocolo de reabilitação para esta proposta?",
      reason: "Contexto de lesão isolado não seleciona automaticamente o protocolo Harris-Hayes.",
      allowsUnknown: true,
    });
    if ((safety.recentReturn || safety.restrictions.length) && !safety.reviewed) questions.push({
      id: "SAFETY_REVIEW",
      question: "Você revisou o retorno recente e as restrições para esta proposta?",
      reason: "O retorno seleciona um modelo de reentrada, mas ainda exige revisão profissional.",
      allowsUnknown: true,
    });
    return questions;
  }
  const questions: AssistedRunningQuestion[] = [];
  if (!shared?.format || shared.format === "UNKNOWN") questions.push({
    id: "FORMAT",
    question: "Como você quer organizar estes treinos?",
    reason: "Os fatos atuais não determinam sozinhos corrida contínua, caminhada/corrida ou intervalado.",
    allowsUnknown: true,
  });
  if (!validDose(shared?.work)) questions.push({
    id: "WORK",
    question: "Quanto trabalho deseja prescrever em cada treino?",
    reason: "Capacidade atual, execução anterior e tempo disponível não são automaticamente a duração prescrita.",
    allowsUnknown: true,
  });
  if (shared?.format && shared.format !== "UNKNOWN" && shared.format !== "CONTINUOUS") {
    if (!Number.isInteger(shared.repetitions) || (shared.repetitions ?? 0) < 1) questions.push({
      id: "REPETITIONS",
      question: "Quantas repetições deseja usar?",
      reason: "O sistema não inventa a quantidade de repetições.",
      allowsUnknown: true,
    });
    if (!validDose(shared.recovery)) questions.push({
      id: "RECOVERY",
      question: "Qual será a recuperação entre as repetições?",
      reason: "A recuperação depende de decisão profissional e ocorrerá somente entre repetições.",
      allowsUnknown: true,
    });
  }
  if (!shared?.workIntensity || shared.intensityUnknown || shared.workIntensity.type === "NONE") questions.push({
    id: "INTENSITY",
    question: "Como deve ser o esforço durante o trabalho?",
    reason: "Ritmo médio comum, distância e histórico não são convertidos em intensidade ou zona.",
    allowsUnknown: true,
  });
  const safety = safetyContext(input);
  if ((safety.recentReturn || safety.restrictions.length) && !safety.reviewed) questions.push({
    id: "SAFETY_REVIEW",
    question: "Você revisou o retorno recente e as restrições para esta proposta?",
    reason: "Esses fatos precisam ser considerados, mas não autorizam redução ou progressão automática.",
    allowsUnknown: true,
  });
  return questions;
}

function planningDecisionBasis(input: AssistedRunningPeriodInput): readonly RunningPlanningDecisionBasis[] {
  const strategies = strategiesForWeek(input);
  const references = effectivePlanningReferences(input);
  const suggested = usesSuggestedStrategy(input);
  const model = suggested ? suggestedModel(input, references) : undefined;
  const formats = [...new Set(strategies.map((strategy) => strategy.format))].join(", ") || "pendentes";
  const timeVolume = timeVolumeFromReferences(references);
  const distanceVolume = distanceVolumeFromReferences(references);
  return [
    {
      decision: "OBJECTIVE",
      label: "Objetivo",
      source: "Objetivo principal da Corrida",
      origin: "Configuração do plano",
      evidence: input.objective,
      influence: /\b(taf|prova|teste)\b/u.test(normalized(input.objective))
        ? "Mantido como meta futura para orientar a estratégia; não foi tratado como desempenho atual."
        : "Define a direção da estratégia sem criar métrica de desempenho.",
      contextualOnly: false,
    },
    {
      decision: "SESSION_STRUCTURE",
      label: "Estrutura dos blocos",
      source: suggested ? "Proposta determinística para revisão" : "Estratégia profissional por dia",
      origin: suggested ? model!.technicalSource : "Painel da proposta assistida",
      evidence: suggested
        ? `Modelo ${model!.name}; formato sugerido e editável: ${formats}. Critérios: ${model!.criteria.join(" ")} Fatos: ${model!.factsUsed.join(" ")}`
        : `Formatos explicitamente escolhidos: ${formats}.`,
      influence: suggested
        ? "Selecionou um modelo elegível sem tratar objetivo futuro, disponibilidade ou capacidade desconhecida como prova de corrida contínua."
        : "Construiu aquecimento, trabalho, repetições, recuperação entre repetições e volta à calma exatamente como prescritos.",
      contextualOnly: false,
    },
    {
      decision: "DURATION",
      label: "Duração e volume",
      source: suggested ? "Duração sugerida e tetos registrados" : "Dose profissional e tetos registrados",
      origin: suggested ? "Configuração da Corrida e referências compatíveis" : "Painel da proposta assistida e configuração da Corrida",
      evidence: `${input.sessionDurationMinutes} min por sessão${timeVolume ? `; ${Math.round(timeVolume / 60)} min por semana` : ""}${distanceVolume ? `; ${(distanceVolume / 1_000).toFixed(2)} km por semana` : ""}.`,
      influence: suggested
        ? "Usou a dose publicada do modelo de entrada/reentrada ou, no modelo contínuo regular, somente a menor capacidade e os tetos informados; não copiou execução comum nem criou progressão."
        : "Calculou os totais e apontou conflitos; não reduziu, aumentou nem redistribuiu a dose.",
      contextualOnly: false,
    },
    {
      decision: "INTENSITY",
      label: "Intensidade",
      source: suggested ? "Orientação qualitativa sugerida" : "Alvo escolhido pelo profissional",
      origin: suggested ? "Motor determinístico da proposta" : "Painel da proposta assistida",
      evidence: "Alvo qualitativo ou estruturado já suportado; nenhuma média comum foi convertida em zona ou teste.",
      influence: suggested
        ? "Criou somente uma orientação qualitativa marcada como proposta; não inventou pace, FC, VO₂ ou zona."
        : "Aplicou o alvo informado em cada bloco de trabalho.",
      contextualOnly: false,
    },
    {
      decision: "RECOVERY",
      label: "Recuperação",
      source: suggested ? "Proposta determinística para revisão" : "Estratégia profissional por dia",
      origin: suggested ? "Motor determinístico da proposta" : "Painel da proposta assistida",
      evidence: "Recuperação só existe nas estratégias de alternância ou intervalado em que foi explicitamente preenchida.",
      influence: suggested
        ? model?.strategy.format === "WALK_RUN"
          ? "Incluiu caminhada entre as repetições exatamente como no modelo técnico selecionado; não acrescentou progressão."
          : "Não sugeriu recuperação porque o modelo elegível é contínuo."
        : "Incluiu recuperação somente entre repetições; não acrescentou recuperação após a última.",
      contextualOnly: !strategies.some((strategy) => strategy.format !== "CONTINUOUS"),
    },
  ];
}

function weekStrategy(suggested: boolean, sessionObjective: string) {
  return {
    phase: suggested ? "Proposta assistida para revisão" : "Estratégia profissional definida",
    objective: sessionObjective,
    guidance: suggested
      ? "Revise formato, duração, orientação e blocos antes de aplicar; não há progressão automática."
      : "Mantenha a estratégia sem progressão automática; qualquer ajuste depende de nova decisão profissional.",
  };
}

function scheduledDaysWithinWeek(input: {
  readonly startDate: string;
  readonly endDate: string;
  readonly availableWeekdays: readonly WorkoutWeekday[];
  readonly frequency: number;
}) {
  const allowed = new Set(input.availableWeekdays);
  return Array.from(
    { length: daysBetween(input.startDate, input.endDate) + 1 },
    (_, index) => isoDateAfterDays(input.startDate, index),
  ).flatMap((scheduledDate) => {
    const weekday = weekdayFromIsoDate(scheduledDate);
    return weekday && allowed.has(weekday)
      ? [{ scheduledDate, weekday }]
      : [];
  }).slice(0, input.frequency);
}

export function runningAvailabilityStatus(
  plannedFrequency: number,
  availableWeekdays: readonly WorkoutWeekday[],
): RunningAvailabilityStatus {
  const availableDayCount = new Set(availableWeekdays).size;
  const diverges = availableDayCount < plannedFrequency;
  return {
    diverges,
    availableDayCount,
    plannedFrequency,
    message: diverges
      ? `A Corrida prevê ${plannedFrequency} sessões, mas há ${availableDayCount} dia(s) disponível(is). Revise antes de gerar.`
      : undefined,
  };
}

export function generateAssistedRunningWeek(
  input: AssistedRunningWeekInput,
): EditableRunningSessionProposal {
  const week = input.running.weeks.find((candidate) => candidate.id === input.targetWeekId);
  if (!week) throw new Error("RUNNING_WEEK_NOT_FOUND");
  validateGenerationInput(input);

  const idFactory = input.idFactory ?? (() => crypto.randomUUID());
  const selectedReferences = effectivePlanningReferences(input);
  const suggestedStrategy = usesSuggestedStrategy(input, week.startDate);
  const environment = input.running.configuration.environment === "TRACK" || input.running.configuration.environment === "TREADMILL"
    ? input.running.configuration.environment
    : "ROAD";
  const scheduledDays = [...new Set(input.availableWeekdays)]
    .map((weekday) => ({
      scheduledDate: dateAtWeekday(week.startDate, weekday),
      weekday,
    }))
    .sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate))
    .slice(0, input.runningWeeklyFrequency);
  const strategies = strategiesForWeek(input, week.startDate);
  const sessions = scheduledDays.map(({ scheduledDate, weekday }) =>
    buildSession({
      scheduledDate,
      weekday,
      environment,
      strategy: strategies.find((strategy) => strategy.weekday === weekday)!,
      idFactory,
    }),
  );
  const conflicts = generationConflicts(input, sessions, selectedReferences);
  const reviewLimitations = proposalReviewLimitations(
    input,
    selectedReferences,
    suggestedStrategy,
  );
  const reviewRequirements = [...reviewLimitations, ...conflicts];
  const sessionObjective = strategies.map((strategy) => strategy.sessionObjective.trim()).join(" · ");
  const strategy = weekStrategy(suggestedStrategy, sessionObjective);
  const reviewNotes = individualReferenceReview(
    input.objective,
    input.runningWeeklyFrequency,
    selectedReferences,
  );
  if (reviewRequirements.length) {
    reviewNotes.unshift(`Limitações a revisar: ${reviewRequirements.join(" ")}`);
  }

  return {
    id: idFactory(),
    source: "ASSISTED_SUGGESTION",
    scope: "WEEK",
    period: { startDate: week.startDate, endDate: week.endDate },
    strategySnapshot: {
      objective: input.objective.trim(),
      weeklyFrequency: input.runningWeeklyFrequency,
    },
    readiness: {
      status: reviewRequirements.length ? "REVIEW_REQUIRED" : "READY",
      missingInformation: reviewRequirements,
      reviewConfirmed: false,
    },
    reviewNotes,
    dataUsed: proposalReferences(input, selectedReferences, conflicts),
    decisionBasis: planningDecisionBasis(input),
    weeks: [{
      ...week,
      phase: strategy.phase,
      objective: strategy.objective,
      weeklyGuidance: strategy.guidance,
      plannedSessionCount: sessions.length,
      sessions,
    }],
  };
}

export function generateAssistedRunningPeriod(
  input: AssistedRunningPeriodInput,
): EditableRunningSessionProposal {
  validateGenerationInput(input);
  const idFactory = input.idFactory ?? (() => crypto.randomUUID());
  const selectedReferences = effectivePlanningReferences(input);
  const environment = input.running.configuration.environment === "TRACK" || input.running.configuration.environment === "TREADMILL"
    ? input.running.configuration.environment
    : "ROAD";
  const emptyWeeks = periodWeeks(input.running, idFactory);
  const allConflicts: string[] = [];
  let hasSuggestedStrategy = false;
  const weeks = emptyWeeks.map((week) => {
    const weekUsesSuggestedStrategy = usesSuggestedStrategy(input, week.startDate);
    hasSuggestedStrategy ||= weekUsesSuggestedStrategy;
    const strategies = strategiesForWeek(input, week.startDate);
    const sessionObjective = strategies.map((strategy) => strategy.sessionObjective.trim()).join(" · ");
    const strategy = weekStrategy(weekUsesSuggestedStrategy, sessionObjective);
    const scheduledDays = scheduledDaysWithinWeek({
      startDate: week.startDate,
      endDate: week.endDate,
      availableWeekdays: input.availableWeekdays,
      frequency: input.runningWeeklyFrequency,
    });
    const sessions = scheduledDays.map(({ scheduledDate, weekday }) => {
      return buildSession({
        scheduledDate,
        weekday,
        environment,
        strategy: strategies.find((strategy) => strategy.weekday === weekday)!,
        idFactory,
      });
    });
    allConflicts.push(...generationConflicts(input, sessions, selectedReferences).map(
      (conflict) => `${week.startDate}: ${conflict}`,
    ));
    return {
      ...week,
      phase: strategy.phase,
      objective: strategy.objective,
      weeklyGuidance: strategy.guidance,
      plannedSessionCount: sessions.length,
      sessions,
    };
  });
  const periodConflicts = [...new Set(allConflicts)];
  const reviewLimitations = proposalReviewLimitations(
    input,
    selectedReferences,
    hasSuggestedStrategy,
  );
  const reviewRequirements = [...reviewLimitations, ...periodConflicts];
  const reviewNotes = individualReferenceReview(
    input.objective,
    input.runningWeeklyFrequency,
    selectedReferences,
  );
  reviewNotes.unshift(
    "Planejamento repetiu as estratégias por dia sem progressão, redução, aumento ou redistribuição automática.",
  );
  if (reviewRequirements.length) {
    reviewNotes.unshift(`Limitações a revisar: ${reviewRequirements.join(" ")}`);
  }
  return {
    id: idFactory(),
    source: "ASSISTED_SUGGESTION",
    scope: "PERIOD",
    period: {
      startDate: input.running.configuration.startDate,
      endDate: runningPeriodEndDate(input.running),
    },
    strategySnapshot: {
      objective: input.objective.trim(),
      weeklyFrequency: input.runningWeeklyFrequency,
    },
    readiness: {
      status: reviewRequirements.length ? "REVIEW_REQUIRED" : "READY",
      missingInformation: reviewRequirements,
      reviewConfirmed: false,
    },
    reviewNotes,
    dataUsed: proposalReferences(input, selectedReferences, periodConflicts),
    decisionBasis: planningDecisionBasis(input),
    weeks,
  };
}

export function applyRunningProposal(
  running: WorkoutPlanEnduranceModality<"RUNNING">,
  proposal: EditableRunningSessionProposal,
  mode: RunningProposalApplicationMode,
): WorkoutPlanEnduranceModality<"RUNNING"> {
  if (
    proposal.readiness.status === "REVIEW_REQUIRED" &&
    !proposal.readiness.reviewConfirmed
  ) {
    throw new Error("RUNNING_PROPOSAL_REVIEW_REQUIRED");
  }
  const inPeriod = (scheduledDate: string) =>
    scheduledDate >= proposal.period.startDate &&
    scheduledDate <= proposal.period.endDate;
  const existingSessions = running.weeks.flatMap((week) => week.sessions);
  const proposedWeeks = proposal.weeks.map((week) => {
    const existingInWeek = mode === "APPEND"
      ? existingSessions.filter(
          (session) =>
            inPeriod(session.scheduledDate) &&
            session.scheduledDate >= week.startDate &&
            session.scheduledDate <= week.endDate,
        )
      : [];
    const existingIds = new Set(existingInWeek.map((session) => session.id));
    return {
      ...week,
      sessions: [
        ...existingInWeek,
        ...week.sessions.filter((session) => !existingIds.has(session.id)),
      ],
    };
  });
  const preservedWeeks = running.weeks.flatMap((week) => {
    const sessions = week.sessions.filter((session) => !inPeriod(session.scheduledDate));
    const weekOutsidePeriod =
      week.endDate < proposal.period.startDate ||
      week.startDate > proposal.period.endDate;
    if (weekOutsidePeriod) return [week];
    return sessions.length ? [{ ...week, sessions }] : [];
  });
  const weeks = [...preservedWeeks, ...proposedWeeks]
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
  return { ...running, weeks };
}

export function runningProposalResultingCount(
  running: WorkoutPlanEnduranceModality<"RUNNING">,
  proposal: EditableRunningSessionProposal,
  mode: RunningProposalApplicationMode,
) {
  const existing = mode === "APPEND"
    ? running.weeks.flatMap((week) => week.sessions).filter(
        (session) =>
          session.scheduledDate >= proposal.period.startDate &&
          session.scheduledDate <= proposal.period.endDate,
      )
    : [];
  const ids = new Set(existing.map((session) => session.id));
  for (const session of proposal.weeks.flatMap((week) => week.sessions)) {
    ids.add(session.id);
  }
  return ids.size;
}
