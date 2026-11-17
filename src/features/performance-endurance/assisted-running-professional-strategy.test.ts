import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSISTED_RUNNING_ENGINE,
  applyRunningProposal,
  assistedRunningQuestions,
  generateAssistedRunningPeriod,
  generateAssistedRunningWeek,
  type AssistedRunningDayStrategy,
} from "./assisted-running-week";
import type { RunningPlanningReference } from "./running-planning-references";
import { runningPrescriptionTotals } from "./running-session-editor";
import type { WorkoutPlanEnduranceModality } from "./workout-contracts";

function ids(prefix: string) {
  let value = 0;
  return () => `${prefix}-${++value}`;
}

function fixture(): WorkoutPlanEnduranceModality<"RUNNING"> {
  return {
    configuration: {
      modality: "RUNNING",
      primaryObjective: "Meta TAF fictícia futura",
      currentLevel: "Contexto fictício",
      startDate: "2026-11-02",
      cycleDurationWeeks: 2,
      weeklyFrequency: 3,
      availableWeekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"],
      environment: "ROAD",
      primaryUnit: "TIME",
      primaryIntensityMethod: "FREE_GUIDANCE",
      athleteReferenceData: {
        comfortableContinuousDurationSeconds: 22 * 60,
        currentWeeklyVolume: { unit: "TIME", durationSeconds: 120 * 60 },
        recentHistory: "Fixture fictícia, sem classificação fisiológica.",
      },
    },
    weeks: [{
      id: "fixture-week",
      weekNumber: 1,
      startDate: "2026-11-02",
      endDate: "2026-11-08",
      phase: "Fixture",
      objective: "Fixture",
      weeklyGuidance: "Fixture isolada",
      sessions: [],
    }],
  };
}

const qualitative = (guidance: string) => ({
  type: "FREE_GUIDANCE" as const,
  guidance,
});

function threeFormats(): readonly AssistedRunningDayStrategy[] {
  return [
    {
      weekday: "MONDAY",
      format: "CONTINUOUS",
      sessionObjective: "Praticar corrida contínua com execução controlada.",
      warmUp: { type: "TIME", durationSeconds: 5 * 60 },
      work: { type: "TIME", durationSeconds: 25 * 60 },
      coolDown: { type: "TIME", durationSeconds: 5 * 60 },
      workIntensity: qualitative("Esforço controlado, mantendo a técnica."),
      rationale: "Dose profissional fictícia; não copiada da capacidade de 22 min.",
    },
    {
      weekday: "WEDNESDAY",
      format: "WALK_RUN",
      sessionObjective: "Praticar alternância entre corrida e caminhada.",
      warmUp: { type: "TIME", durationSeconds: 5 * 60 },
      work: { type: "TIME", durationSeconds: 3 * 60 },
      repetitions: 4,
      recovery: { type: "TIME", durationSeconds: 2 * 60 },
      coolDown: { type: "TIME", durationSeconds: 5 * 60 },
      workIntensity: { type: "RPE", unit: "RPE", target: { valueType: "SINGLE", value: 4 } },
      rationale: "Alternância escolhida explicitamente na fixture.",
    },
    {
      weekday: "FRIDAY",
      format: "INTERVAL",
      sessionObjective: "Executar repetições prescritas com recuperação definida.",
      warmUp: { type: "TIME", durationSeconds: 8 * 60 },
      work: { type: "TIME", durationSeconds: 2 * 60 },
      repetitions: 5,
      recovery: { type: "TIME", durationSeconds: 60 },
      coolDown: { type: "TIME", durationSeconds: 5 * 60 },
      workIntensity: qualitative("Firme e tecnicamente estável, conforme decisão profissional."),
      recoveryIntensity: qualitative("Caminhada leve entre repetições."),
      rationale: "Intervalado definido pelo profissional na fixture.",
    },
  ];
}

function common(strategies: readonly AssistedRunningDayStrategy[]) {
  const running = fixture();
  return {
    running,
    objective: running.configuration.primaryObjective,
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE" as const,
    availableWeekdays: running.configuration.availableWeekdays,
    sessionDurationMinutes: 60,
    professionalStrategy: { sessions: strategies },
  };
}

function prescriptionTotals(
  session: WorkoutPlanEnduranceModality<"RUNNING">["weeks"][number]["sessions"][number],
) {
  if (session.sessionKind !== "STRUCTURED") throw new Error("FIXTURE_STRUCTURED_SESSION_REQUIRED");
  return runningPrescriptionTotals(session);
}

test("fixture isolada monta os três formatos, totais e recuperação somente entre repetições", () => {
  const input = common(threeFormats());
  const proposal = generateAssistedRunningWeek({
    ...input,
    targetWeekId: input.running.weeks[0].id,
    idFactory: ids("week"),
  });
  const sessions = proposal.weeks[0].sessions;

  assert.deepEqual(sessions.map((session) => session.scheduledDate), [
    "2026-11-02", "2026-11-04", "2026-11-06",
  ]);
  assert.deepEqual(sessions.map((session) => session.sessionType), [
    "CONTINUOUS", "WALK_RUN", "INTERVAL",
  ]);
  assert.deepEqual(sessions.map((session) => prescriptionTotals(session).durationSeconds), [
    35 * 60, 28 * 60, 27 * 60,
  ]);
  assert.deepEqual(sessions.map((session) => prescriptionTotals(session).recoveryCount), [0, 3, 4]);
  assert.equal(sessions.reduce((sum, session) => sum + (session.estimatedDurationSeconds ?? 0), 0), 90 * 60);
  assert.ok(sessions.every((session) => session.estimatedDurationSeconds !== 22 * 60));
  assert.equal(proposal.readiness.status, "READY");
  assert.equal(proposal.dataUsed?.[0]?.planningUse, "CONTEXT_ONLY");
  assert.match(proposal.dataUsed?.[0]?.influencedDecisions?.[0] ?? "", /conferido como teto/u);
});

test("período reutiliza a estratégia por dia sem progressão automática", () => {
  const input = common(threeFormats());
  const proposal = generateAssistedRunningPeriod({ ...input, idFactory: ids("period") });

  assert.deepEqual(proposal.weeks.map((week) => week.sessions.map((session) => session.estimatedDurationSeconds)), [
    [35 * 60, 28 * 60, 27 * 60],
    [35 * 60, 28 * 60, 27 * 60],
  ]);
  assert.deepEqual(proposal.weeks.flatMap((week) => week.sessions.map((session) => session.scheduledDate)), [
    "2026-11-02", "2026-11-04", "2026-11-06",
    "2026-11-09", "2026-11-11", "2026-11-13",
  ]);
  assert.match(proposal.reviewNotes[0], /sem progressão/u);
});

test("conflitos preservam a dose e exigem revisão explícita", () => {
  const strategies = threeFormats().map((strategy) => strategy.weekday === "MONDAY"
    ? { ...strategy, warmUp: undefined, work: { type: "TIME" as const, durationSeconds: 125 * 60 }, coolDown: undefined }
    : strategy);
  const input = common(strategies);
  const proposal = generateAssistedRunningWeek({
    ...input,
    targetWeekId: input.running.weeks[0].id,
    idFactory: ids("conflict"),
  });
  const monday = proposal.weeks[0].sessions[0];

  assert.equal(monday.estimatedDurationSeconds, 125 * 60, "o gerador não reduz a dose para fazê-la caber");
  assert.equal(proposal.readiness.status, "REVIEW_REQUIRED");
  assert.ok(proposal.readiness.missingInformation.some((item) => item.includes("excede o teto de 60 min")));
  assert.ok(proposal.readiness.missingInformation.some((item) => item.includes("excede o teto informado de 120 min")));
  assert.equal(proposal.dataUsed?.[0]?.planningUse, "DECISION");
});

test("sem dose profissional gera proposta completa para revisão sem transformar capacidade em histórico prescrito", () => {
  const running = fixture();
  const input = {
    running,
    objective: running.configuration.primaryObjective,
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE" as const,
    availableWeekdays: running.configuration.availableWeekdays,
    sessionDurationMinutes: 60,
    idFactory: ids("missing"),
  };
  const proposal = generateAssistedRunningPeriod(input);
  const sessions = proposal.weeks.flatMap((week) => week.sessions);
  assert.equal(proposal.readiness.status, "REVIEW_REQUIRED");
  assert.ok(proposal.readiness.missingInformation.some((item) => /sugestões/u.test(item)));
  assert.ok(sessions.length > 0);
  assert.ok(proposal.weeks.every((week) => week.phase === "Proposta assistida para revisão"));
  assert.ok(sessions.every((session) => session.estimatedDurationSeconds === 28.5 * 60));
  assert.ok(sessions.every((session) => session.sessionType === "WALK_RUN"));
  assert.ok(sessions.every((session) => session.primaryIntensityMethod === "FREE_GUIDANCE"));
  assert.ok(sessions.every((session) => session.professionalGuidance.includes("Modelo NHS")));
  assert.throws(
    () => applyRunningProposal(running, proposal, "APPEND"),
    /RUNNING_PROPOSAL_REVIEW_REQUIRED/u,
  );
  const edited = {
    ...proposal,
    readiness: { ...proposal.readiness, reviewConfirmed: true },
    weeks: proposal.weeks.map((week, weekIndex) => weekIndex === 0
      ? {
          ...week,
          sessions: week.sessions.map((session, sessionIndex) => sessionIndex === 0
            ? { ...session, title: "Proposta revisada antes de aplicar" }
            : session),
        }
      : week),
  };
  assert.equal(running.weeks[0]?.sessions.length, 0, "editar ou cancelar não altera o rascunho");
  const applied = applyRunningProposal(running, edited, "APPEND");
  const reapplied = applyRunningProposal(applied, edited, "APPEND");
  assert.equal(reapplied.weeks.flatMap((week) => week.sessions).length, sessions.length);
  assert.equal(reapplied.weeks[0]?.sessions[0]?.title, "Proposta revisada antes de aplicar");
});

test("distância sem ritmo permanece distância e não inventa duração", () => {
  const strategies = threeFormats().map((strategy) => strategy.weekday === "MONDAY"
    ? {
        ...strategy,
        warmUp: undefined,
        work: { type: "DISTANCE" as const, distanceMeters: 3_000 },
        coolDown: undefined,
        workIntensity: qualitative("Execução controlada, sem ritmo numérico presumido."),
      }
    : strategy);
  const input = common(strategies);
  const proposal = generateAssistedRunningWeek({
    ...input,
    targetWeekId: input.running.weeks[0].id,
    idFactory: ids("distance"),
  });
  const monday = proposal.weeks[0].sessions[0];
  const totals = prescriptionTotals(monday);

  assert.equal(totals.distanceMeters, 3_000);
  assert.equal(totals.durationSeconds, undefined);
  assert.equal(monday.estimatedDurationSeconds, undefined);
  assert.equal(monday.estimatedDistanceMeters, 3_000);
});

const sharedAnswers = {
  format: "CONTINUOUS" as const,
  work: { type: "TIME" as const, durationSeconds: 24 * 60 },
  workIntensity: { type: "FREE_GUIDANCE" as const, guidance: "Esforço controlado informado pelo profissional." },
};

test("dados manuais suficientes sem relógio fazem perguntas curtas e geram a proposta", () => {
  const running = fixture();
  const draftBeforeGeneration = structuredClone(running);
  const input = {
    running,
    objective: running.configuration.primaryObjective,
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE" as const,
    availableWeekdays: running.configuration.availableWeekdays,
    sessionDurationMinutes: 60,
    selectedReferences: [],
    professionalStrategy: { sharedStrategy: sharedAnswers },
  };
  assert.deepEqual(assistedRunningQuestions(input), []);
  const proposal = generateAssistedRunningWeek({
    ...input,
    targetWeekId: running.weeks[0].id,
    idFactory: ids("manual-without-watch"),
  });
  assert.deepEqual(proposal.weeks[0].sessions.map((session) => session.estimatedDurationSeconds), [24 * 60, 24 * 60, 24 * 60]);
  assert.equal(proposal.dataUsed?.some((reference) => reference.kind === "EXECUTION"), false);
  const reviewedProposal = {
    ...proposal,
    weeks: proposal.weeks.map((week, index) => index === 0
      ? { ...week, sessions: week.sessions.map((session, sessionIndex) => sessionIndex === 0 ? { ...session, title: "Título revisado sem aplicar" } : session) }
      : week),
  };
  assert.equal(reviewedProposal.weeks[0].sessions[0]?.title, "Título revisado sem aplicar");
  assert.deepEqual(running, draftBeforeGeneration, "gerar e revisar a proposta não aplica ao rascunho");
});

test("referência importada aparece como fato, mas respostas profissionais continuam definindo a proposta", () => {
  const running = fixture();
  const imported: RunningPlanningReference = {
    id: "imported-fixture",
    kind: "EXECUTION",
    title: "Execução importada fictícia",
    origin: "Arquivo fictício isolado",
    modality: "RUNNING",
    durationSeconds: 30 * 60,
    distanceMeters: 5_000,
    averagePaceSecondsPerKilometer: 360,
    historicalFacts: ["Execução comum fictícia."],
    limitations: ["Não é teste máximo nem zona."],
    planningInfluence: "Contexto histórico somente.",
    planningUse: "CONTEXT_ONLY",
    influencedDecisions: [],
    selectable: true,
    selectedByDefault: true,
  };
  const input = {
    running,
    objective: running.configuration.primaryObjective,
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE" as const,
    availableWeekdays: running.configuration.availableWeekdays,
    sessionDurationMinutes: 60,
    selectedReferences: [imported],
    professionalStrategy: { sharedStrategy: { ...sharedAnswers, work: { type: "TIME" as const, durationSeconds: 26 * 60 } } },
  };
  assert.deepEqual(assistedRunningQuestions(input), []);
  const proposal = generateAssistedRunningPeriod({ ...input, idFactory: ids("imported-reference") });
  assert.ok(proposal.weeks.flatMap((week) => week.sessions).every((session) => session.estimatedDurationSeconds === 26 * 60));
  assert.equal(proposal.dataUsed?.find((reference) => reference.id === imported.id)?.planningUse, "CONTEXT_ONLY");
  assert.ok(proposal.weeks.flatMap((week) => week.sessions).every((session) => session.primaryIntensityMethod === "FREE_GUIDANCE"));
});

test("respostas ausentes permanecem opcionais e geram proposta identificada para revisão", () => {
  const running = fixture();
  const input = {
    running,
    objective: running.configuration.primaryObjective,
    runningWeeklyFrequency: 3,
    experience: "INTERMEDIATE" as const,
    availableWeekdays: running.configuration.availableWeekdays,
    sessionDurationMinutes: 60,
    selectedReferences: [],
    professionalStrategy: { sharedStrategy: { format: "UNKNOWN" as const, intensityUnknown: true } },
  };
  const questions = assistedRunningQuestions(input);
  assert.deepEqual(questions.map((question) => question.id), ["FORMAT", "WORK", "INTENSITY"]);
  assert.ok(questions.every((question) => question.allowsUnknown));
  const proposal = generateAssistedRunningPeriod({ ...input, idFactory: ids("optional-answers") });
  assert.equal(proposal.readiness.status, "REVIEW_REQUIRED");
  assert.ok(proposal.weeks.flatMap((week) => week.sessions).length > 0);
  assert.equal(ASSISTED_RUNNING_ENGINE.usesArtificialIntelligence, false);
});
