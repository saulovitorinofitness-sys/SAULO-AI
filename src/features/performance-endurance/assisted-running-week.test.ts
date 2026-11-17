import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PerformanceDeliverablePreview } from "@/components/deliverables/performance-deliverable-preview";
import type { PersistedWorkoutExecution } from "../performance-monitoring/repository";

import {
  applyRunningProposal,
  assistedRunningQuestions,
  assistedRunningSuggestedModel,
  generateAssistedRunningPeriod as generateAssistedRunningPeriodProduction,
  generateAssistedRunningWeek as generateAssistedRunningWeekProduction,
  runningAvailabilityStatus,
  type AssistedRunningPeriodInput,
  type AssistedRunningWeekInput,
} from "./assisted-running-week";
import {
  createRunningSessionFromTemplate,
  runningProposalPreview,
  runningPrescriptionTotals,
  selectRunningPreview,
} from "./running-session-editor";
import {
  emptyWorkoutPlanDraft,
  parseWorkoutPlanDraft,
  workoutPlanDraftSchema,
} from "./workout-record";
import type { WorkoutPlanEnduranceModality } from "./workout-contracts";
import type { RunningPlanningReference } from "./running-planning-references";
import {
  buildRunningPlanningReferenceSet,
  selectedRunningPlanningReferences,
  withLocalRunningManualReference,
} from "./running-planning-references";

function ids(prefix = "ficticio") {
  let current = 0;
  return () => `${prefix}-${++current}`;
}

function explicitContinuousStrategies(input: AssistedRunningPeriodInput) {
  const capacity = input.professionalStrategy?.comfortableContinuousDurationSeconds ??
    input.running.configuration.athleteReferenceData?.comfortableContinuousDurationSeconds;
  if (!capacity) return input.professionalStrategy;
  const weeklyTime = input.running.configuration.athleteReferenceData?.currentWeeklyVolume?.unit === "TIME"
    ? input.running.configuration.athleteReferenceData.currentWeeklyVolume.durationSeconds
    : Number.POSITIVE_INFINITY;
  const durationSeconds = Math.min(
    capacity,
    input.sessionDurationMinutes * 60,
    weeklyTime / input.runningWeeklyFrequency,
  );
  return {
    ...input.professionalStrategy,
    sessions: [...new Set(input.availableWeekdays)].slice(0, input.runningWeeklyFrequency).map((weekday) => ({
      weekday,
      format: "CONTINUOUS" as const,
      sessionObjective: input.professionalStrategy?.sessionObjective ?? "Finalidade fictícia definida pelo profissional.",
      work: { type: "TIME" as const, durationSeconds },
      workIntensity: { type: "FREE_GUIDANCE" as const, guidance: "Esforço confortável explicitamente prescrito na fixture." },
    })),
  };
}

function generateAssistedRunningWeek(input: AssistedRunningWeekInput) {
  return generateAssistedRunningWeekProduction({
    ...input,
    professionalStrategy: explicitContinuousStrategies(input),
  });
}

function generateAssistedRunningPeriod(input: AssistedRunningPeriodInput) {
  return generateAssistedRunningPeriodProduction({
    ...input,
    professionalStrategy: explicitContinuousStrategies(input),
  });
}

function proposalSessions(
  proposal: ReturnType<typeof generateAssistedRunningWeek>,
) {
  return proposal.weeks.flatMap((week) => week.sessions);
}

function running(
  environment: "ROAD" | "TREADMILL" = "ROAD",
): WorkoutPlanEnduranceModality<"RUNNING"> {
  return {
    configuration: {
      modality: "RUNNING",
      primaryObjective: "Dados fictícios",
      currentLevel: "A revisar",
      startDate: "2026-11-09",
      cycleDurationWeeks: 2,
      weeklyFrequency: 3,
      availableWeekdays: ["MONDAY", "WEDNESDAY", "SATURDAY"],
      environment,
      primaryUnit: "TIME",
      primaryIntensityMethod: "RPE",
    },
    weeks: [
      {
        id: "10000000-0000-4000-8000-000000000001",
        weekNumber: 1,
        startDate: "2026-11-09",
        endDate: "2026-11-15",
        phase: "Adaptação",
        objective: "Semana fictícia",
        weeklyGuidance: "Dados fictícios.",
        sessions: [],
      },
      {
        id: "10000000-0000-4000-8000-000000000002",
        weekNumber: 2,
        startDate: "2026-11-16",
        endDate: "2026-11-22",
        phase: "Adaptação",
        objective: "Semana preservada",
        weeklyGuidance: "Dados fictícios.",
        sessions: [],
      },
    ],
  };
}

function runningReadyForPeriod(input?: {
  readonly startDate?: string;
  readonly cycleDurationWeeks?: number;
  readonly sessionLimitMinutes?: number;
}) {
  const base = running();
  return {
    ...base,
    configuration: {
      ...base.configuration,
      startDate: input?.startDate ?? "2026-11-02",
      cycleDurationWeeks: input?.cycleDurationWeeks ?? 4,
      weeklyFrequency: 3,
      availableWeekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"] as const,
      athleteReferenceData: {
        recentHistory: "Histórico fictício: três semanas regulares, sem intercorrências registradas.",
        currentWeeklyVolume: { unit: "TIME" as const, durationSeconds: 90 * 60 },
        comfortableContinuousDurationSeconds: 30 * 60,
        currentContinuousDistanceMeters: 5_000,
      },
    },
  } satisfies WorkoutPlanEnduranceModality<"RUNNING">;
}

function executionReference(
  id: string,
  durationSeconds: number,
): RunningPlanningReference {
  return {
    id,
    kind: "EXECUTION",
    recordedAt: "2026-11-01T10:00:00.000Z",
    title: "Execução fictícia de Corrida",
    origin: "Apple Health",
    modality: "RUNNING",
    durationSeconds,
    distanceMeters: 5_000,
    averagePaceSecondsPerKilometer: durationSeconds / 5,
    averageSpeedKilometersPerHour: 5 / (durationSeconds / 3_600),
    historicalFacts: ["Duração e distância fictícias."],
    limitations: ["Execução comum; não é teste máximo."],
    planningInfluence: "Estima somente a duração inicial.",
    selectable: true,
    selectedByDefault: true,
  };
}

function fictitiousImportedRun(): PersistedWorkoutExecution {
  return {
    id: "execution-fictional-30min-5km",
    masterRecordId: "master-demonstration-fictional",
    modality: "RUNNING",
    source: "FILE_IMPORT",
    actualStartAt: "2026-11-01T10:00:00.000Z",
    actualEndAt: "2026-11-01T10:30:00.000Z",
    executedDurationSeconds: 30 * 60,
    status: "COMPLETED",
    importProvider: "APPLE_HEALTH",
    distanceMeters: 5_000,
    createdAt: "2026-11-01T10:31:00.000Z",
    updatedAt: "2026-11-01T10:31:00.000Z",
  };
}

test("validação isolada compara referências manuais, execução comum e ausência de referências até a prévia", () => {
  const manualBase = runningReadyForPeriod();
  const manualRunning: WorkoutPlanEnduranceModality<"RUNNING"> = {
    ...manualBase,
    configuration: {
      ...manualBase.configuration,
      primaryObjective: "Preparação para TAF",
      testGoal: {
        requiredDistanceMeters: 2_400,
        targetDurationSeconds: 12 * 60,
        testDate: "2027-01-15",
      },
      athleteReferenceData: {
        ...manualBase.configuration.athleteReferenceData,
        currentWeeklyVolume: { unit: "TIME", durationSeconds: 120 * 60 },
        updatedAt: "2026-11-10T12:00:00.000Z",
      },
    },
  };
  const noReferenceRunning: WorkoutPlanEnduranceModality<"RUNNING"> = {
    ...manualRunning,
    configuration: {
      ...manualRunning.configuration,
      athleteReferenceData: undefined,
    },
  };
  const referenceInput = {
    masterRecordId: "master-demonstration-fictional",
    patientId: "patient-demonstration-fictional",
    assessments: [],
    now: new Date("2026-11-13T12:00:00.000Z"),
  } as const;
  const manualSet = buildRunningPlanningReferenceSet({
    ...referenceInput,
    executions: [],
    manualReferenceData: manualRunning.configuration.athleteReferenceData,
  });
  const executionSet = buildRunningPlanningReferenceSet({
    ...referenceInput,
    executions: [fictitiousImportedRun()],
    manualReferenceData: manualRunning.configuration.athleteReferenceData,
  });
  const emptySet = buildRunningPlanningReferenceSet({
    ...referenceInput,
    executions: [],
  });
  const manualReferences = selectedRunningPlanningReferences(
    manualSet,
    manualSet.selectedReferenceIds,
  );
  const executionReferences = selectedRunningPlanningReferences(
    executionSet,
    executionSet.selectedReferenceIds,
  );
  const emptyReferences = selectedRunningPlanningReferences(
    emptySet,
    emptySet.selectedReferenceIds,
  );
  const unsavedManualSet = withLocalRunningManualReference({
    referenceSet: emptySet,
    manualReferenceData: manualRunning.configuration.athleteReferenceData,
    now: referenceInput.now,
  });
  const unsavedManualReferences = selectedRunningPlanningReferences(
    unsavedManualSet,
    unsavedManualSet.selectedReferenceIds,
  );
  const common = {
    objective: manualRunning.configuration.primaryObjective,
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE" as const,
    availableWeekdays: manualRunning.configuration.availableWeekdays,
    sessionDurationMinutes: 60,
  };
  const manualWeek = generateAssistedRunningWeek({
    ...common,
    running: manualRunning,
    targetWeekId: manualRunning.weeks[0].id,
    selectedReferences: manualReferences,
    idFactory: ids("manual-week"),
  });
  const executionWeek = generateAssistedRunningWeek({
    ...common,
    running: manualRunning,
    targetWeekId: manualRunning.weeks[0].id,
    selectedReferences: executionReferences,
    idFactory: ids("execution-week"),
  });
  const emptyWeek = generateAssistedRunningWeek({
    ...common,
    running: noReferenceRunning,
    targetWeekId: noReferenceRunning.weeks[0].id,
    selectedReferences: emptyReferences,
    professionalStrategy: { comfortableContinuousDurationSeconds: 25 * 60 },
    idFactory: ids("empty-week"),
  });
  const manualPeriod = generateAssistedRunningPeriod({
    ...common,
    running: manualRunning,
    selectedReferences: manualReferences,
    idFactory: ids("manual-period"),
  });
  const unsavedManualPeriod = generateAssistedRunningPeriod({
    ...common,
    running: manualRunning,
    selectedReferences: unsavedManualReferences,
    idFactory: ids("unsaved-manual-period"),
  });
  const executionPeriod = generateAssistedRunningPeriod({
    ...common,
    running: manualRunning,
    selectedReferences: executionReferences,
    idFactory: ids("execution-period"),
  });
  const emptyPeriod = generateAssistedRunningPeriod({
    ...common,
    running: noReferenceRunning,
    selectedReferences: emptyReferences,
    professionalStrategy: { comfortableContinuousDurationSeconds: 25 * 60 },
    idFactory: ids("empty-period"),
  });

  assert.deepEqual(manualSet.references.map((reference) => reference.kind), ["MANUAL_REFERENCE"]);
  assert.equal(manualSet.references[0]?.durationSeconds, undefined);
  assert.deepEqual(
    executionSet.references.map((reference) => reference.kind),
    ["EXECUTION", "MANUAL_REFERENCE"],
  );
  const importedReference = executionSet.references[0];
  assert.equal(importedReference?.averagePaceSecondsPerKilometer, 360);
  assert.equal(importedReference?.averageSpeedKilometersPerHour, 10);
  assert.match(importedReference?.limitations.join(" ") ?? "", /não classificada como teste máximo nem melhor marca/u);
  assert.deepEqual(emptySet.references, []);

  assert.deepEqual(
    proposalSessions(manualWeek).map((session) => session.estimatedDurationSeconds),
    [1_800, 1_800, 1_800],
  );
  assert.deepEqual(
    proposalSessions(executionWeek).map((session) => session.estimatedDurationSeconds),
    [1_800, 1_800, 1_800],
  );
  assert.deepEqual(
    proposalSessions(emptyWeek).map((session) => session.estimatedDurationSeconds),
    [1_500, 1_500, 1_500],
  );
  assert.ok(proposalSessions(executionWeek).every((session) => session.primaryIntensityMethod === "FREE_GUIDANCE"));
  assert.match(executionWeek.reviewNotes.join(" "), /não foi inferida classificação fisiológica/u);
  assert.match(executionWeek.reviewNotes.join(" "), /uma única execução não foi repetida como duração obrigatória/u);
  assert.match(emptyWeek.reviewNotes.join(" "), /não foi inferida classificação fisiológica/u);
  assert.equal(emptyWeek.readiness.status, "READY");
  assert.equal(executionWeek.strategySnapshot.objective, "Preparação para TAF");
  assert.deepEqual(manualRunning.configuration.testGoal, executionWeek.strategySnapshot.objective
    ? { requiredDistanceMeters: 2_400, targetDurationSeconds: 720, testDate: "2027-01-15" }
    : undefined);
  assert.equal(manualRunning.configuration.athleteReferenceData?.recentPerformance, undefined);

  assert.equal(manualPeriod.readiness.status, "READY");
  assert.equal(unsavedManualPeriod.readiness.status, "READY");
  assert.equal(executionPeriod.readiness.status, "READY");
  assert.equal(emptyPeriod.readiness.status, "READY");
  assert.deepEqual(emptyPeriod.readiness.missingInformation, []);
  assert.equal(emptyPeriod.dataUsed?.length, 1);
  assert.match(
    manualPeriod.decisionBasis?.find((basis) => basis.decision === "DURATION")?.influence ?? "",
    /não reduziu, aumentou nem redistribuiu/u,
  );
  assert.equal(executionPeriod.dataUsed?.find((reference) => reference.kind === "EXECUTION")?.planningUse, "CONTEXT_ONLY");
  assert.equal(
    emptyPeriod.decisionBasis?.find((basis) => basis.decision === "SESSION_STRUCTURE")?.source,
    "Estratégia profissional por dia",
  );
  assert.ok(emptyPeriod.weeks.flatMap((week) => week.sessions).every((session) =>
    session.primaryIntensityMethod === "FREE_GUIDANCE",
  ));

  const manualFirstWeekDurations = manualPeriod.weeks[0]?.sessions.map((session) => session.estimatedDurationSeconds);
  const unsavedManualFirstWeekDurations = unsavedManualPeriod.weeks[0]?.sessions.map((session) => session.estimatedDurationSeconds);
  const executionFirstWeekDurations = executionPeriod.weeks[0]?.sessions.map((session) => session.estimatedDurationSeconds);
  assert.deepEqual(manualFirstWeekDurations, [1_800, 1_800, 1_800]);
  assert.deepEqual(unsavedManualFirstWeekDurations, [1_800, 1_800, 1_800]);
  assert.equal(unsavedManualPeriod.dataUsed?.length, 1);
  assert.match(unsavedManualPeriod.dataUsed?.[0]?.origin ?? "", /estado local ainda não salvo/u);
  assert.deepEqual(executionFirstWeekDurations, [1_800, 1_800, 1_800]);
  assert.equal(
    manualPeriod.weeks[0]?.sessions.reduce(
      (total, session) => total + (session.estimatedDurationSeconds ?? 0),
      0,
    ),
    90 * 60,
  );
  assert.deepEqual(
    manualPeriod.weeks.map((week) =>
      week.sessions.reduce(
        (total, session) => total + (session.estimatedDurationSeconds ?? 0),
        0,
      ),
    ),
    [90 * 60, 90 * 60, 90 * 60, 90 * 60],
  );
  assert.deepEqual(
    executionPeriod.weeks.map((week) =>
      week.sessions.reduce(
        (total, session) => total + (session.estimatedDurationSeconds ?? 0),
        0,
      ),
    ),
    [90 * 60, 90 * 60, 90 * 60, 90 * 60],
  );
  assert.deepEqual(
    manualPeriod.dataUsed?.flatMap((reference) => reference.historicalFacts),
    [
      "Tempo contínuo confortável informado: 30 min",
      "Histórico informado: Histórico fictício: três semanas regulares, sem intercorrências registradas.",
      "Volume semanal informado: 120 min",
      "Distância contínua atual informada: 5.00 km",
    ],
  );
  assert.ok(executionPeriod.dataUsed?.some((reference) => reference.id === "execution:execution-fictional-30min-5km"));

  const manualPreviewSelection = selectRunningPreview(manualRunning, manualPeriod);
  const previewSelection = selectRunningPreview(manualRunning, executionPeriod);
  const emptyPreviewSelection = selectRunningPreview(noReferenceRunning, emptyPeriod);
  assert.equal(manualPreviewSelection.source, "PROPOSAL");
  assert.equal(previewSelection.source, "PROPOSAL");
  assert.equal(emptyPreviewSelection.source, "PROPOSAL");
  assert.equal(manualRunning.weeks[0]?.sessions.length, 0, "a prévia não aplica a proposta ao rascunho");
  assert.equal(noReferenceRunning.weeks[0]?.sessions.length, 0, "a prévia limitada também não aplica a proposta");
  const emptyDraft = emptyWorkoutPlanDraft();
  const previewHtml = renderToStaticMarkup(createElement(PerformanceDeliverablePreview, {
    contentScope: "RUNNING",
    documentStatus: "Demonstração — dados fictícios",
    hidePrintActions: true,
    professional: {
      userId: "professional-demonstration-fictional",
      fullName: "Profissional fictício",
      registrations: ["CREF FICTÍCIO"],
    },
    view: {
      patient: {
        id: "patient-demonstration-fictional",
        name: "Aluno fictício",
        code: "DEMO-FICTÍCIO",
      },
      masterRecordId: "master-demonstration-fictional",
      attendanceId: "attendance-demonstration-fictional",
      entryId: "entry-demonstration-fictional",
      status: "DRAFT",
      draft: {
        ...emptyDraft,
        endurance: { running: previewSelection.running },
      },
      inheritedFacts: [],
      exerciseLibrary: [],
      responsibleProfessionalId: "professional-demonstration-fictional",
      responsibleProfessional: "Profissional fictício",
      version: 1,
    },
  }));
  assert.match(previewHtml, /Demonstração — dados fictícios/u);
  assert.match(previewHtml, /Planejamento de Corrida/u);
  assert.match(previewHtml, /Detalhes das sessões/u);
  assert.doesNotMatch(previewHtml, /teste máximo|melhor marca|zona cardíaca/u);
});

test("rótulo iniciante sem capacidade estruturada gera proposta completa para revisão", () => {
  const input = {
    running: running(),
    targetWeekId: running().weeks[0].id,
    objective: "Iniciar caminhada e corrida",
    runningWeeklyFrequency: 3,
    experience: "BEGINNER",
    availableWeekdays: ["MONDAY", "WEDNESDAY", "SATURDAY"],
    sessionDurationMinutes: 35,
    idFactory: ids(),
  } as const;

  const proposal = generateAssistedRunningWeekProduction(input);
  assert.equal(proposal.readiness.status, "REVIEW_REQUIRED");
  assert.equal(proposal.weeks[0]?.sessions.length, 3);
  assert.ok(proposal.weeks[0]?.sessions.every((session) => session.estimatedDurationSeconds === 28.5 * 60));
  assert.ok(proposal.weeks[0]?.sessions.every((session) => session.sessionType === "WALK_RUN"));
  assert.ok(proposal.weeks[0]?.sessions.every((session) => session.primaryIntensityMethod === "FREE_GUIDANCE"));
});

test("TAF sem marca atual permanece meta futura e a sugestão não vira desempenho", () => {
  const taf = running();
  const runningWithTafGoal = {
    ...taf,
    configuration: {
      ...taf.configuration,
      primaryObjective: "Preparação para TAF",
      testGoal: {
        requiredDistanceMeters: 2_400,
        targetDurationSeconds: 12 * 60,
        testDate: "2027-01-15",
      },
    },
  };
  const input = {
    running: runningWithTafGoal,
    targetWeekId: runningWithTafGoal.weeks[0].id,
    objective: runningWithTafGoal.configuration.primaryObjective,
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE",
    availableWeekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"],
    sessionDurationMinutes: 45,
    idFactory: ids(),
  } as const;

  assert.deepEqual(runningWithTafGoal.configuration.testGoal, {
    requiredDistanceMeters: 2_400,
    targetDurationSeconds: 12 * 60,
    testDate: "2027-01-15",
  });
  const proposal = generateAssistedRunningWeekProduction(input);
  assert.equal(proposal.readiness.status, "REVIEW_REQUIRED");
  assert.ok(proposal.weeks[0]?.sessions.length);
  assert.ok(proposal.weeks[0]?.sessions.every((session) => session.objective !== input.objective));
  assert.match(proposal.reviewNotes.join(" "), /meta futura/u);
});

test("uma execução isolada contextualiza a proposta sem impor sua duração às sessões", () => {
  const base = running();
  const common = {
    running: base,
    targetWeekId: base.weeks[0].id,
    objective: "Preparação para TAF",
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE" as const,
    availableWeekdays: ["MONDAY", "WEDNESDAY", "SATURDAY"] as const,
    sessionDurationMinutes: 60,
  };
  const thirtyMinutesInput = {
    ...common,
    selectedReferences: [executionReference("execution:30", 1_800)],
    idFactory: ids("thirty"),
  };
  const fiftyMinutesInput = {
    ...common,
    selectedReferences: [executionReference("execution:50", 3_000)],
    idFactory: ids("fifty"),
  };

  const shortWeek = generateAssistedRunningWeekProduction(thirtyMinutesInput);
  const longWeek = generateAssistedRunningWeekProduction(fiftyMinutesInput);
  assert.equal(shortWeek.readiness.status, "REVIEW_REQUIRED");
  assert.equal(longWeek.readiness.status, "REVIEW_REQUIRED");
  assert.ok(proposalSessions(shortWeek).every((session) => session.estimatedDurationSeconds === 28.5 * 60));
  assert.ok(proposalSessions(longWeek).every((session) => session.estimatedDurationSeconds === 28.5 * 60));

  const periodBase = runningReadyForPeriod();
  const shortPeriod = generateAssistedRunningPeriodProduction({
    running: periodBase,
    objective: "Preparação para TAF",
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE",
    availableWeekdays: periodBase.configuration.availableWeekdays,
    sessionDurationMinutes: 60,
    selectedReferences: [executionReference("execution:period-30", 1_800)],
    idFactory: ids("period-short"),
  });
  const longPeriod = generateAssistedRunningPeriodProduction({
    running: periodBase,
    objective: "Preparação para TAF",
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE",
    availableWeekdays: periodBase.configuration.availableWeekdays,
    sessionDurationMinutes: 60,
    selectedReferences: [executionReference("execution:period-50", 3_000)],
    idFactory: ids("period-long"),
  });
  const shortFirstDuration = shortPeriod.weeks[0]?.sessions[0]?.estimatedDurationSeconds;
  const longFirstDuration = longPeriod.weeks[0]?.sessions[0]?.estimatedDurationSeconds;

  assert.equal(shortFirstDuration, 28.5 * 60);
  assert.equal(longFirstDuration, 28.5 * 60);
  assert.equal(shortPeriod.readiness.status, "REVIEW_REQUIRED");
  assert.equal(longPeriod.readiness.status, "REVIEW_REQUIRED");
  assert.equal(shortPeriod.dataUsed?.[0].id, "execution:period-30");
});

test("semana móvel iniciada na quarta usa quarta, sexta e segunda sem completar no domingo", () => {
  const base = running();
  const movingWeek = {
    ...base,
    configuration: {
      ...base.configuration,
      startDate: "2026-11-11",
      availableWeekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"] as const,
    },
    weeks: [
      {
        ...base.weeks[0],
        startDate: "2026-11-11",
        endDate: "2026-11-17",
      },
    ],
  };
  const proposal = generateAssistedRunningWeek({
    running: movingWeek,
    targetWeekId: movingWeek.weeks[0].id,
    objective: "Preparação para TAF",
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE",
    availableWeekdays: movingWeek.configuration.availableWeekdays,
    sessionDurationMinutes: 40,
    professionalStrategy: { comfortableContinuousDurationSeconds: 20 * 60 },
    idFactory: ids(),
  });
  const sessions = proposalSessions(proposal);

  assert.deepEqual(
    sessions.map((session) => session.scheduledDate),
    ["2026-11-11", "2026-11-13", "2026-11-16"],
  );
  assert.deepEqual(
    sessions.map((session) => session.weekday),
    ["WEDNESDAY", "FRIDAY", "MONDAY"],
  );
  assert.ok(sessions.every((session) => session.weekday !== "SUNDAY"));
});

test("esteira permanece em esteira sem inventar km/h", () => {
  const proposal = generateAssistedRunningWeek({
    running: running("TREADMILL"),
    targetWeekId: running("TREADMILL").weeks[0].id,
    objective: "Construir regularidade",
    runningWeeklyFrequency: 2,
    experience: "BEGINNER",
    availableWeekdays: ["MONDAY", "THURSDAY"],
    sessionDurationMinutes: 30,
    professionalStrategy: { comfortableContinuousDurationSeconds: 20 * 60 },
    idFactory: ids(),
  });
  const sessions = proposalSessions(proposal);

  assert.ok(sessions.every((session) => session.environment === "TREADMILL"));
  assert.ok(sessions.every((session) => session.primaryIntensityMethod !== "SPEED"));
});

test("divergência de dias é mostrada antes da geração", () => {
  const status = runningAvailabilityStatus(5, [
    "MONDAY",
    "WEDNESDAY",
    "SATURDAY",
  ]);
  assert.equal(status.diverges, true);
  assert.equal(status.plannedFrequency, 5);
  assert.equal(status.availableDayCount, 3);
  assert.match(status.message ?? "", /Corrida prevê 5 sessões/u);
});

test("prévia e aplicação são puras; reaplicar em acrescentar não duplica", () => {
  const manualSession = createRunningSessionFromTemplate({
    templateId: "EASY_RUN",
    scheduledDate: "2026-11-10",
    weekday: "TUESDAY",
    environment: "ROAD",
    id: ids("manual"),
  });
  const emptyBase = running();
  const empty = {
    ...emptyBase,
    configuration: {
      ...emptyBase.configuration,
      athleteReferenceData: {
        recentHistory: "Histórico fictício confirmado para o teste de aplicação.",
        currentWeeklyVolume: { unit: "TIME" as const, durationSeconds: 80 * 60 },
        comfortableContinuousDurationSeconds: 25 * 60,
        currentContinuousDistanceMeters: 5_000,
      },
    },
  };
  const original = {
    ...empty,
    weeks: empty.weeks.map((week, index) =>
      index === 0 ? { ...week, sessions: [manualSession] } : week,
    ),
  };
  const proposal = generateAssistedRunningWeek({
    running: original,
    targetWeekId: original.weeks[0].id,
    objective: "Rodagem fictícia",
    runningWeeklyFrequency: 2,
    experience: "INTERMEDIATE",
    availableWeekdays: ["MONDAY", "THURSDAY"],
    sessionDurationMinutes: 40,
    idFactory: ids(),
  });
  const edited = {
    ...proposal,
    weeks: proposal.weeks.map((week) => ({
      ...week,
      sessions: week.sessions.map((session, index) =>
        index === 0 ? { ...session, title: "Título editado na proposta" } : session,
      ),
    })),
  };

  const preview = applyRunningProposal(original, edited, "APPEND");
  assert.equal(original.weeks[0].sessions.length, 1, "gerar, editar ou cancelar não toca o rascunho");
  assert.equal(preview.weeks[0].sessions[0].id, manualSession.id, "a prévia em acrescentar inclui a sessão existente");
  assert.equal(preview.weeks[0].sessions[1].title, "Título editado na proposta");
  const reapplied = applyRunningProposal(preview, edited, "APPEND");
  assert.equal(reapplied.weeks[0].sessions.length, 3);
  assert.equal(reapplied.weeks[1], original.weeks[1], "as demais semanas são preservadas");
});

test("três corridas TAF preservam cinco sessões de musculação ao salvar e reabrir", () => {
  const baseRunning = running();
  const configuredRunning = {
    ...baseRunning,
    configuration: {
      ...baseRunning.configuration,
      primaryObjective: "Preparação para TAF",
      weeklyFrequency: 3,
      availableWeekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"] as const,
      testGoal: {
        requiredDistanceMeters: 2_400,
        targetDurationSeconds: 12 * 60,
        testDate: "2027-01-15",
      },
      athleteReferenceData: {
        recentHistory: "Histórico fictício confirmado para o teste de persistência.",
        currentWeeklyVolume: { unit: "TIME" as const, durationSeconds: 120 * 60 },
        comfortableContinuousDurationSeconds: 40 * 60,
        currentContinuousDistanceMeters: 5_000,
      },
    },
  };
  const proposal = generateAssistedRunningWeek({
    running: configuredRunning,
    targetWeekId: configuredRunning.weeks[0].id,
    objective: configuredRunning.configuration.primaryObjective,
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE",
    availableWeekdays: configuredRunning.configuration.availableWeekdays,
    sessionDurationMinutes: 40,
    idFactory: randomUUID,
  });
  const appliedRunning = applyRunningProposal(
    configuredRunning,
    proposal,
    "APPEND",
  );
  const emptyDraft = emptyWorkoutPlanDraft();
  const strengthSessions = Array.from({ length: 5 }, (_, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index}`,
    name: `Treino ${index + 1}`,
    objective: "Musculação fictícia",
    estimatedDuration: "",
    observations: "",
    exercises: [],
  }));
  const serialized = JSON.parse(
    JSON.stringify({
      ...emptyDraft,
      sessions: strengthSessions,
      endurance: { running: appliedRunning },
    }),
  ) as unknown;
  const validation = workoutPlanDraftSchema.safeParse(serialized);
  assert.equal(
    validation.success,
    true,
    validation.success ? undefined : JSON.stringify(validation.error.issues),
  );
  const reopened = parseWorkoutPlanDraft(serialized);

  assert.ok(reopened?.endurance?.running);
  assert.equal(reopened.sessions.length, 5);
  assert.equal(reopened.endurance.running.weeks[0].sessions.length, 3);
  assert.deepEqual(
    reopened.endurance.running.weeks[0].sessions.map((session) =>
      session.weekday,
    ),
    ["MONDAY", "WEDNESDAY", "FRIDAY"],
  );
});

test("planejamento de quatro semanas mantém estratégia estável sem anunciar progressão", () => {
  const configured = runningReadyForPeriod();
  const proposal = generateAssistedRunningPeriod({
    running: configured,
    objective: "Construir regularidade com dados fictícios",
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE",
    availableWeekdays: configured.configuration.availableWeekdays,
    sessionDurationMinutes: 60,
    idFactory: ids("periodo-quatro"),
  });
  const sessions = proposal.weeks.flatMap((week) => week.sessions);

  assert.equal(proposal.scope, "PERIOD");
  assert.deepEqual(proposal.period, {
    startDate: "2026-11-02",
    endDate: "2026-11-29",
  });
  assert.equal(proposal.readiness.status, "READY");
  assert.equal(proposal.weeks.length, 4);
  assert.deepEqual(
    proposal.weeks.map((week) => [week.startDate, week.endDate]),
    [
      ["2026-11-02", "2026-11-08"],
      ["2026-11-09", "2026-11-15"],
      ["2026-11-16", "2026-11-22"],
      ["2026-11-23", "2026-11-29"],
    ],
  );
  assert.deepEqual(
    sessions.map((session) => session.weekday),
    Array.from({ length: 4 }, () => ["MONDAY", "WEDNESDAY", "FRIDAY"]).flat(),
  );
  assert.equal(new Set(proposal.weeks.map((week) => week.objective)).size, 1);
  assert.equal(proposal.weeks.at(-1)?.phase, "Estratégia profissional definida");
  assert.deepEqual([...new Set(sessions.map((session) => session.sessionType))], ["CONTINUOUS"]);
  assert.ok(sessions.every((session) => session.primaryIntensityMethod === "FREE_GUIDANCE"));
  assert.ok(sessions.every((session) =>
    session.sessionKind === "STRUCTURED" &&
    session.blocks.every((block) =>
      (block.blockType === "STAGE" ? [block.stage] : block.stages).every(
        (stage) => stage.studentInstruction.length > 0 && stage.intensityTarget?.type === "FREE_GUIDANCE",
      ),
    ),
  ));
  assert.ok(sessions.every((session) =>
    session.sessionKind === "STRUCTURED" &&
    (runningPrescriptionTotals(session).durationSeconds ?? 0) < 60 * 60,
  ), "o limite disponível não é preenchido por obrigação");
});

test("ciclo de três semanas iniciado na quarta inclui semanas parciais e virada de mês", () => {
  const configured = runningReadyForPeriod({
    startDate: "2026-11-25",
    cycleDurationWeeks: 3,
  });
  const proposal = generateAssistedRunningPeriod({
    running: configured,
    objective: "Ciclo fictício atravessando o mês",
    runningWeeklyFrequency: 3,
    experience: "BEGINNER",
    availableWeekdays: configured.configuration.availableWeekdays,
    sessionDurationMinutes: 45,
    idFactory: ids("periodo-parcial"),
  });

  assert.deepEqual(proposal.period, {
    startDate: "2026-11-25",
    endDate: "2026-12-15",
  });
  assert.deepEqual(
    proposal.weeks.map((week) => [week.startDate, week.endDate, week.sessions.length]),
    [
      ["2026-11-25", "2026-11-29", 2],
      ["2026-11-30", "2026-12-06", 3],
      ["2026-12-07", "2026-12-13", 3],
      ["2026-12-14", "2026-12-15", 1],
    ],
  );
  assert.deepEqual(
    proposal.weeks.flatMap((week) => week.sessions.map((session) => session.scheduledDate)),
    [
      "2026-11-25", "2026-11-27",
      "2026-11-30", "2026-12-02", "2026-12-04",
      "2026-12-07", "2026-12-09", "2026-12-11",
      "2026-12-14",
    ],
  );
});

test("referências ausentes geram período completo com limitações para revisão", () => {
  const configured = running();
  const input = {
    running: configured,
    objective: "Preparação para TAF futuro",
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE",
    availableWeekdays: configured.configuration.availableWeekdays,
    sessionDurationMinutes: 45,
    idFactory: ids("periodo-pendente"),
  } as const;

  const proposal = generateAssistedRunningPeriodProduction(input);
  assert.equal(proposal.readiness.status, "REVIEW_REQUIRED");
  assert.ok(proposal.readiness.missingInformation.some((item) => /nenhuma métrica histórica/u.test(item)));
  assert.ok(proposal.weeks.flatMap((week) => week.sessions).length > 0);
});

test("editar e abrir a prévia do período não aplica; acrescentar é idempotente e substituir preserva fora do período", () => {
  const configured = runningReadyForPeriod();
  const outsideSession = createRunningSessionFromTemplate({
    templateId: "EASY_RUN",
    scheduledDate: "2026-12-08",
    weekday: "TUESDAY",
    environment: "ROAD",
    id: () => "sessao-fora-ficticia",
  });
  const runningWithOutside = {
    ...configured,
    weeks: [
      ...configured.weeks,
      {
        ...configured.weeks[1],
        id: "semana-fora-ficticia",
        weekNumber: 9,
        startDate: "2026-12-07",
        endDate: "2026-12-13",
        sessions: [outsideSession],
      },
    ],
  };
  const proposal = generateAssistedRunningPeriod({
    running: runningWithOutside,
    objective: "Período fictício editável",
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE",
    availableWeekdays: runningWithOutside.configuration.availableWeekdays,
    sessionDurationMinutes: 45,
    idFactory: ids("periodo-editavel"),
  });
  const edited = {
    ...proposal,
    weeks: proposal.weeks.map((week, index) => index === 0
      ? {
          ...week,
          objective: "Objetivo semanal editado",
          weeklyGuidance: "Orientação semanal editada para o aluno.",
          sessions: week.sessions.map((session, sessionIndex) => sessionIndex === 0
            ? { ...session, title: "Sessão editada antes de aplicar" }
            : session),
        }
      : week),
  };
  const preview = runningProposalPreview(runningWithOutside, edited);

  assert.equal(runningWithOutside.weeks.length, 3);
  assert.equal(configured.weeks[0].objective, "Semana fictícia");
  assert.equal(preview.weeks[0].objective, "Objetivo semanal editado");
  assert.equal(preview.weeks[0].sessions[0].title, "Sessão editada antes de aplicar");

  const appended = applyRunningProposal(runningWithOutside, edited, "APPEND");
  const reapplied = applyRunningProposal(appended, edited, "APPEND");
  assert.equal(
    reapplied.weeks.flatMap((week) => week.sessions).filter((session) =>
      edited.weeks.some((proposalWeek) => proposalWeek.sessions.some((item) => item.id === session.id)),
    ).length,
    edited.weeks.flatMap((week) => week.sessions).length,
  );
  const replaced = applyRunningProposal(runningWithOutside, edited, "REPLACE");
  assert.equal(
    replaced.weeks.find((week) => week.id === "semana-fora-ficticia")?.sessions[0],
    outsideSession,
  );
});

test("os dois geradores fecham os blocos no total e não excedem volume semanal nem tempo disponível", () => {
  const base = runningReadyForPeriod();
  const configured: WorkoutPlanEnduranceModality<"RUNNING"> = {
    ...base,
    configuration: {
      ...base.configuration,
      athleteReferenceData: {
        ...base.configuration.athleteReferenceData,
        currentWeeklyVolume: { unit: "TIME", durationSeconds: 100 * 60 },
      },
    },
  };
  const common = {
    running: configured,
    objective: "Preparação para TAF futuro",
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE" as const,
    availableWeekdays: configured.configuration.availableWeekdays,
    sessionDurationMinutes: 32,
  };
  const week = generateAssistedRunningWeek({
    ...common,
    targetWeekId: configured.weeks[0].id,
    idFactory: ids("coerencia-semana"),
  });
  const period = generateAssistedRunningPeriod({
    ...common,
    idFactory: ids("coerencia-periodo"),
  });

  for (const proposal of [week, period]) {
    for (const plannedWeek of proposal.weeks) {
      const totals = plannedWeek.sessions.map((session) => {
        assert.equal(session.sessionKind, "STRUCTURED");
        return session.sessionKind === "STRUCTURED"
          ? runningPrescriptionTotals(session).durationSeconds ?? 0
          : 0;
      });
      assert.ok(totals.every((total, index) =>
        total === plannedWeek.sessions[index]?.estimatedDurationSeconds,
      ));
      assert.ok(totals.every((total) => total <= 32 * 60));
      assert.ok(totals.reduce((sum, total) => sum + total, 0) <= 100 * 60);
    }
    assert.match(
      proposal.decisionBasis?.find((basis) => basis.decision === "DURATION")?.evidence ?? "",
      /100 min por semana/u,
    );
  }
});

test("nova sugestão limitada preserva a proposta anterior e permanece separada do rascunho", () => {
  const configured = running();
  const previousProposal = generateAssistedRunningPeriod({
    running: configured,
    objective: "Preparação para TAF futuro",
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE",
    availableWeekdays: configured.configuration.availableWeekdays,
    sessionDurationMinutes: 45,
    professionalStrategy: {
      comfortableContinuousDurationSeconds: 20 * 60,
      sessionObjective: "Sustentar corrida contínua confortável.",
    },
    selectedReferences: [],
    idFactory: ids("proposta-anterior"),
  });
  const previousSnapshot = structuredClone(previousProposal);
  const insufficientInput = {
    running: configured,
    objective: "Preparação para TAF futuro",
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE" as const,
    availableWeekdays: configured.configuration.availableWeekdays,
    sessionDurationMinutes: 45,
    selectedReferences: [],
    idFactory: ids("tentativa-incompleta"),
  };

  const limitedProposal = generateAssistedRunningPeriod(insufficientInput);
  assert.equal(limitedProposal.readiness.status, "REVIEW_REQUIRED");
  assert.ok(limitedProposal.weeks.flatMap((week) => week.sessions).length > 0);
  assert.deepEqual(previousProposal, previousSnapshot);
  assert.ok(previousProposal.weeks.flatMap((week) => week.sessions).every(
    (session) => session.title !== "Sessão a definir pelo profissional",
  ));
});

test("duas capacidades contínuas estruturadas alteram somente o bloco suportado nos dois geradores", () => {
  const fixture = (minutes: number) => {
    const base = runningReadyForPeriod();
    return {
      ...base,
      configuration: {
        ...base.configuration,
        primaryObjective: "Preparação para TAF",
        athleteReferenceData: {
          ...base.configuration.athleteReferenceData,
          currentWeeklyVolume: { unit: "TIME" as const, durationSeconds: 120 * 60 },
          comfortableContinuousDurationSeconds: minutes * 60,
        },
      },
    } satisfies WorkoutPlanEnduranceModality<"RUNNING">;
  };
  const generateBoth = (configured: WorkoutPlanEnduranceModality<"RUNNING">, prefix: string) => {
    const common = {
      running: configured,
      objective: configured.configuration.primaryObjective,
      runningWeeklyFrequency: 3,
      experience: "INTERMEDIATE" as const,
      availableWeekdays: configured.configuration.availableWeekdays,
      sessionDurationMinutes: 60,
    };
    return [
      generateAssistedRunningWeek({ ...common, targetWeekId: configured.weeks[0].id, idFactory: ids(`${prefix}-week`) }),
      generateAssistedRunningPeriod({ ...common, idFactory: ids(`${prefix}-period`) }),
    ] as const;
  };

  for (const [proposal, expectedMinutes] of [
    ...generateBoth(fixture(20), "capacidade-20").map((proposal) => [proposal, 20] as const),
    ...generateBoth(fixture(35), "capacidade-35").map((proposal) => [proposal, 35] as const),
  ]) {
    const sessions = proposal.weeks.flatMap((week) => week.sessions);
    assert.equal(proposal.readiness.status, "READY");
    assert.ok(sessions.every((session) => session.estimatedDurationSeconds === expectedMinutes * 60));
    assert.ok(sessions.every((session) => session.sessionType === "CONTINUOUS"));
    assert.ok(sessions.every((session) => session.objective !== "Preparação para TAF"));
    assert.ok(sessions.every((session) => session.sessionKind === "STRUCTURED" &&
      session.blocks.length === 1 &&
      session.blocks[0]?.blockType === "STAGE" &&
      session.blocks[0].stage.type === "WORK"));
    assert.equal(proposal.dataUsed?.[0]?.planningUse, "CONTEXT_ONLY");
    assert.ok(proposal.weeks.every((week) =>
      week.sessions.reduce((sum, session) => sum + (session.estimatedDurationSeconds ?? 0), 0) <= 120 * 60,
    ));
  }
});

test("distância isolada e retorno recente geram propostas revisáveis sem conversão implícita", () => {
  const distanceOnlyBase = runningReadyForPeriod();
  const distanceOnly = {
    ...distanceOnlyBase,
    configuration: {
      ...distanceOnlyBase.configuration,
      athleteReferenceData: {
        ...distanceOnlyBase.configuration.athleteReferenceData,
        comfortableContinuousDurationSeconds: undefined,
        currentContinuousDistanceMeters: 8_000,
      },
    },
  } satisfies WorkoutPlanEnduranceModality<"RUNNING">;
  const common = {
    running: distanceOnly,
    objective: "Preparação para TAF",
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE" as const,
    availableWeekdays: distanceOnly.configuration.availableWeekdays,
    sessionDurationMinutes: 60,
  };
  const distanceInput = {
    ...common,
    targetWeekId: distanceOnly.weeks[0].id,
    idFactory: ids("distancia-isolada"),
  };
  const returnInput = {
    ...common,
    professionalStrategy: {
      comfortableContinuousDurationSeconds: 35 * 60,
      recentReturn: true,
      sessionObjective: "Retomar a Corrida após interrupção.",
    },
    idFactory: ids("retorno-recente"),
  };

  const distanceProposal = generateAssistedRunningWeekProduction(distanceInput);
  const returnProposal = generateAssistedRunningPeriodProduction(returnInput);
  assert.equal(distanceProposal.readiness.status, "REVIEW_REQUIRED");
  assert.equal(returnProposal.readiness.status, "REVIEW_REQUIRED");
  assert.ok(returnProposal.readiness.missingInformation.some((item) => /retorno recente/u.test(item)));
  assert.ok(proposalSessions(distanceProposal).every((session) => session.estimatedDistanceMeters === undefined));
  assert.ok(proposalSessions(distanceProposal).every((session) => session.primaryIntensityMethod === "FREE_GUIDANCE"));
});

test("fixture 1: iniciante sem capacidade contínua conhecida recebe modelo publicado de alternância, não 30 min contínuos", () => {
  const configured = running();
  const input = {
    running: configured,
    targetWeekId: configured.weeks[0].id,
    objective: "Começar a correr com segurança",
    runningWeeklyFrequency: 3,
    experience: "BEGINNER" as const,
    availableWeekdays: configured.configuration.availableWeekdays,
    sessionDurationMinutes: 35,
    idFactory: ids("iniciante-sem-capacidade"),
  };

  const model = assistedRunningSuggestedModel(input);
  const proposal = generateAssistedRunningWeekProduction(input);
  const sessions = proposalSessions(proposal);

  assert.equal(model.id, "BEGINNER_WALK_RUN");
  assert.match(model.technicalSource, /NHS Better Health/u);
  assert.ok(model.criteria.some((criterion) => /não estabelecida/u.test(criterion)));
  assert.ok(model.factsUsed.some((fact) => /oito trabalhos.*sete recuperações.*28 min 30 s/u.test(fact)));
  assert.ok(assistedRunningQuestions(input).some((question) => question.id === "CURRENT_PRACTICE"));
  assert.equal(sessions.length, 3);
  assert.ok(sessions.every((session) => session.sessionType === "WALK_RUN"));
  assert.ok(sessions.every((session) => session.estimatedDurationSeconds === 28.5 * 60));
  assert.ok(sessions.every((session) => session.estimatedDurationSeconds !== 30 * 60));
  assert.ok(sessions.every((session) => session.primaryIntensityMethod === "FREE_GUIDANCE"));
  assert.ok(sessions.every((session) => /oito trabalhos.*sete recuperações.*28 min 30 s/u.test(session.professionalGuidance)));
  for (const session of sessions) {
    assert.ok(session.sessionKind === "STRUCTURED");
    const stages = session.blocks.flatMap((block) => block.blockType === "STAGE" ? [block.stage] : block.stages);
    const warmUp = stages.find((stage) => stage.type === "WARM_UP");
    const coolDown = stages.find((stage) => stage.type === "COOL_DOWN");
    assert.equal(warmUp?.studentInstruction, "Caminhar por 5 minutos.");
    assert.equal(coolDown?.studentInstruction, "Caminhar por 5 minutos.");
    assert.equal(warmUp?.intensityTarget?.type === "FREE_GUIDANCE" ? warmUp.intensityTarget.guidance : undefined, "Caminhar por 5 minutos.");
    assert.equal(coolDown?.intensityTarget?.type === "FREE_GUIDANCE" ? coolDown.intensityTarget.guidance : undefined, "Caminhar por 5 minutos.");
    assert.doesNotMatch(`${warmUp?.studentInstruction} ${coolDown?.studentInstruction}`, /conforme decisão profissional/u);
  }
  assert.ok(proposal.reviewNotes.join(" ").includes("não uma individualização comprovada"));
});

test("fixture 2: prática regular e referências suficientes tornam o contínuo elegível usando somente fatos e tetos", () => {
  const configured = runningReadyForPeriod();
  const input = {
    running: configured,
    objective: "Manter prática regular para uma meta futura",
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE" as const,
    availableWeekdays: configured.configuration.availableWeekdays,
    sessionDurationMinutes: 60,
    professionalStrategy: { currentPractice: "REGULAR" as const },
  };

  const model = assistedRunningSuggestedModel(input);
  const week = generateAssistedRunningWeekProduction({
    ...input,
    targetWeekId: configured.weeks[0].id,
    idFactory: ids("regular-week"),
  });
  const period = generateAssistedRunningPeriodProduction({
    ...input,
    idFactory: ids("regular-period"),
  });
  const sessions = period.weeks.flatMap((candidate) => candidate.sessions);

  assert.equal(model.id, "REGULAR_CONTINUOUS");
  assert.ok(model.factsUsed.some((fact) => /30 min/u.test(fact)));
  assert.ok(model.criteria.some((criterion) => /Prática atual.*regular/u.test(criterion)));
  assert.ok(proposalSessions(week).every((session) => session.sessionType === "CONTINUOUS"));
  assert.ok(sessions.every((session) => session.sessionType === "CONTINUOUS"));
  assert.ok(sessions.every((session) => session.estimatedDurationSeconds === 30 * 60));
  assert.equal(new Set(sessions.map((session) => session.title)).size, 1);
  assert.ok(period.dataUsed?.some((reference) => reference.planningUse === "DECISION"));
  assert.match(period.decisionBasis?.find((basis) => basis.decision === "SESSION_STRUCTURE")?.evidence ?? "", /Corrida contínua/u);
});

test("fixture 3: retorno com lesão e indicação profissional explícita seleciona reabilitação sem reutilizar capacidade anterior", () => {
  const configured = runningReadyForPeriod();
  const input = {
    running: configured,
    objective: "Retomar a prática",
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE" as const,
    availableWeekdays: configured.configuration.availableWeekdays,
    sessionDurationMinutes: 60,
    professionalStrategy: {
      currentPractice: "REGULAR" as const,
      recentReturn: true,
      returnContext: "INJURY_REHABILITATION" as const,
      rehabilitationProtocolIndicated: true,
      comfortableContinuousDurationSeconds: 35 * 60,
    },
    idFactory: ids("retorno-period"),
  };

  const model = assistedRunningSuggestedModel(input);
  const proposal = generateAssistedRunningPeriodProduction(input);
  const sessions = proposal.weeks.flatMap((week) => week.sessions);

  assert.equal(model.id, "RETURN_REHABILITATION");
  assert.match(model.technicalSource, /Harris-Hayes|bmjsem/u);
  assert.ok(sessions.every((session) => session.sessionType === "WALK_RUN"));
  assert.ok(sessions.every((session) => session.estimatedDurationSeconds === 4 * 60));
  assert.ok(sessions.every((session) => session.estimatedDurationSeconds !== 35 * 60));
  assert.equal(new Set(sessions.map((session) => session.estimatedDurationSeconds)).size, 1);
  assert.match(proposal.reviewNotes.join(" "), /sem progressão/u);
  assert.ok(proposal.readiness.missingInformation.some((item) => /retorno recente/u.test(item)));
});

test("retorno após pausa sem lesão usa retomada geral NHS e nunca seleciona Harris-Hayes", () => {
  const configured = runningReadyForPeriod();
  const input = {
    running: configured,
    targetWeekId: configured.weeks[0].id,
    objective: "Retomar a prática após pausa",
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE" as const,
    availableWeekdays: configured.configuration.availableWeekdays,
    sessionDurationMinutes: 60,
    professionalStrategy: {
      recentReturn: true,
      returnContext: "PAUSE_WITHOUT_INJURY" as const,
      comfortableContinuousDurationSeconds: 35 * 60,
    },
    idFactory: ids("retorno-sem-lesao"),
  };

  const model = assistedRunningSuggestedModel(input);
  const proposal = generateAssistedRunningWeekProduction(input);
  const sessions = proposalSessions(proposal);

  assert.equal(model.id, "RETURN_GENERAL_WALK_RUN");
  assert.match(model.technicalSource, /NHS Better Health/u);
  assert.doesNotMatch(model.technicalSource, /Harris-Hayes|bmjsem/u);
  assert.ok(model.criteria.some((criterion) => /não associada a lesão/u.test(criterion)));
  assert.ok(sessions.every((session) => session.estimatedDurationSeconds === 28.5 * 60));
  assert.ok(sessions.every((session) => /oito trabalhos.*sete recuperações.*28 min 30 s/u.test(session.professionalGuidance)));
  assert.ok(assistedRunningQuestions(input).every((question) => question.id !== "REHABILITATION_INDICATION"));
});

test("motivo desconhecido não presume lesão; contexto de lesão sem indicação também não seleciona Harris-Hayes", () => {
  const configured = runningReadyForPeriod();
  const common = {
    running: configured,
    objective: "Retomar a prática",
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE" as const,
    availableWeekdays: configured.configuration.availableWeekdays,
    sessionDurationMinutes: 60,
  };
  const unknownInput = {
    ...common,
    professionalStrategy: { recentReturn: true, returnContext: "UNKNOWN" as const },
  };
  const injuryWithoutIndicationInput = {
    ...common,
    professionalStrategy: {
      recentReturn: true,
      returnContext: "INJURY_REHABILITATION" as const,
      rehabilitationProtocolIndicated: false,
    },
  };

  const unknownModel = assistedRunningSuggestedModel(unknownInput);
  const injuryWithoutIndicationModel = assistedRunningSuggestedModel(injuryWithoutIndicationInput);

  assert.equal(unknownModel.id, "RETURN_GENERAL_WALK_RUN");
  assert.equal(injuryWithoutIndicationModel.id, "RETURN_GENERAL_WALK_RUN");
  assert.doesNotMatch(unknownModel.technicalSource, /Harris-Hayes|bmjsem/u);
  assert.doesNotMatch(injuryWithoutIndicationModel.technicalSource, /Harris-Hayes|bmjsem/u);
  assert.ok(unknownModel.criteria.some((criterion) => /nenhuma lesão foi presumida/u.test(criterion)));
  assert.ok(assistedRunningQuestions(unknownInput).some((question) => question.id === "RETURN_CONTEXT"));
  assert.ok(assistedRunningQuestions(injuryWithoutIndicationInput).some((question) => question.id === "REHABILITATION_INDICATION"));
});

test("fixture 4: execução importada é contexto; somente referência manual compatível influencia o modelo", () => {
  const configured = running();
  const imported = executionReference("execution:importada", 50 * 60);
  const currentCapacity: RunningPlanningReference = {
    id: "manual:capacidade-atual",
    kind: "MANUAL_REFERENCE",
    recordedAt: "2026-11-15T10:00:00.000Z",
    title: "Capacidade atual fictícia",
    origin: "Registro manual da Corrida",
    modality: "RUNNING",
    comfortableContinuousDurationSeconds: 24 * 60,
    weeklyVolumeDurationSeconds: 75 * 60,
    historicalFacts: ["Prática e capacidade atuais informadas na fixture."],
    limitations: ["Dado declarado; não é teste máximo."],
    planningInfluence: "Pode tornar o modelo contínuo elegível e limitar a duração.",
    selectable: true,
    selectedByDefault: true,
  };
  const baseInput = {
    running: configured,
    objective: "Manter regularidade",
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE" as const,
    availableWeekdays: configured.configuration.availableWeekdays,
    sessionDurationMinutes: 60,
    professionalStrategy: { currentPractice: "REGULAR" as const },
  };
  const importedOnly = generateAssistedRunningWeekProduction({
    ...baseInput,
    targetWeekId: configured.weeks[0].id,
    selectedReferences: [imported],
    idFactory: ids("importada-contexto"),
  });
  const withEffectiveReference = generateAssistedRunningWeekProduction({
    ...baseInput,
    targetWeekId: configured.weeks[0].id,
    selectedReferences: [imported, currentCapacity],
    idFactory: ids("importada-e-manual"),
  });

  assert.ok(proposalSessions(importedOnly).every((session) => session.sessionType === "WALK_RUN"));
  assert.ok(proposalSessions(importedOnly).every((session) => session.estimatedDurationSeconds !== imported.durationSeconds));
  assert.equal(importedOnly.dataUsed?.find((reference) => reference.id === imported.id)?.planningUse, "CONTEXT_ONLY");
  assert.ok(proposalSessions(withEffectiveReference).every((session) => session.sessionType === "CONTINUOUS"));
  assert.ok(proposalSessions(withEffectiveReference).every((session) => session.estimatedDurationSeconds === 24 * 60));
  assert.equal(withEffectiveReference.dataUsed?.find((reference) => reference.id === imported.id)?.planningUse, "CONTEXT_ONLY");
  assert.equal(withEffectiveReference.dataUsed?.find((reference) => reference.id === currentCapacity.id)?.planningUse, "DECISION");
  assert.ok(proposalSessions(withEffectiveReference).every((session) => session.primaryIntensityMethod === "FREE_GUIDANCE"));
});
