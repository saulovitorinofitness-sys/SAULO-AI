import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createRunningSessionFromTemplate,
  distanceDisplayFromMeters,
  distanceMetersFromDisplay,
  formatRunningDuration,
  paceSecondsPerKilometerFromSpeed,
  replaceRunningSessionInWeeks,
  runningProposalPreview,
  runningPrescriptionTotals,
  runningCompletionForMode,
  selectRunningPreview,
  speedKilometersPerHourFromPace,
  weekdayFromIsoDate,
} from "./running-session-editor";
import { emptyWorkoutPlanDraft, parseWorkoutPlanDraft } from "./workout-record";
import type {
  WorkoutPlanDraft,
  WorkoutPlanEnduranceWeek,
} from "./workout-contracts";

function runningWeek(
  sessions: WorkoutPlanEnduranceWeek<"RUNNING">["sessions"],
): WorkoutPlanEnduranceWeek<"RUNNING"> {
  return {
    id: randomUUID(),
    weekNumber: 1,
    startDate: "2026-11-09",
    endDate: "2026-11-15",
    phase: "Preparação TAF",
    objective: "Validar sessões fictícias",
    weeklyGuidance: "Dados exclusivamente fictícios.",
    sessions,
  };
}

function runningDraft(
  sessions: WorkoutPlanEnduranceWeek<"RUNNING">["sessions"],
): WorkoutPlanDraft {
  return {
    ...emptyWorkoutPlanDraft(),
    service: {
      ...emptyWorkoutPlanDraft().service,
      contractedService: "RUNNING_PLAN",
      primaryModality: "Corrida",
    },
    strategy: {
      ...emptyWorkoutPlanDraft().strategy,
      weeklyFrequency: 3,
    },
    endurance: {
      running: {
        configuration: {
          modality: "RUNNING",
          primaryObjective: "TAF fictício",
          currentLevel: "Intermediário",
          startDate: "2026-11-09",
          cycleDurationWeeks: 1,
          weeklyFrequency: 3,
          availableWeekdays: ["MONDAY", "WEDNESDAY", "SATURDAY"],
          environment: "ROAD",
          primaryUnit: "DISTANCE",
          primaryIntensityMethod: "RPE",
        },
        weeks: [runningWeek(sessions)],
      },
    },
  };
}

test("caminhada e corrida salva e reabre preservando todos os blocos", () => {
  const session = createRunningSessionFromTemplate({
    templateId: "WALK_RUN",
    scheduledDate: "2026-11-09",
    weekday: "MONDAY",
    environment: "ROAD",
  });
  const draft = runningDraft([session]);
  const reopened = parseWorkoutPlanDraft(draft);

  assert.ok(reopened?.endurance?.running);
  assert.deepEqual(
    reopened.endurance.running.weeks[0].sessions[0],
    session,
  );
});

test("data definida deriva o mesmo dia usado ao reabrir", () => {
  assert.equal(weekdayFromIsoDate("2026-11-09"), "MONDAY");
  assert.equal(weekdayFromIsoDate("2026-11-11"), "WEDNESDAY");
  assert.equal(weekdayFromIsoDate("2026-11-13"), "FRIDAY");

  const session = createRunningSessionFromTemplate({
    templateId: "EASY_RUN",
    scheduledDate: "2026-11-11",
    weekday: "MONDAY",
    environment: "ROAD",
  });
  const reopened = parseWorkoutPlanDraft(runningDraft([session]));

  assert.equal(
    reopened?.endurance?.running?.weeks[0].sessions[0].weekday,
    "WEDNESDAY",
  );
});

test("prévia de Corrida vazia não seleciona outro conteúdo nem altera o rascunho", () => {
  const running = runningDraft([]).endurance?.running;
  assert.ok(running);
  const before = structuredClone(running);

  assert.deepEqual(selectRunningPreview(running), { source: "EMPTY" });
  assert.deepEqual(running, before);
});

test("prévia de Corrida manual usa as sessões do rascunho sem alterá-las", () => {
  const manual = createRunningSessionFromTemplate({
    templateId: "EASY_RUN",
    scheduledDate: "2026-11-11",
    weekday: "WEDNESDAY",
    environment: "ROAD",
  });
  const running = runningDraft([manual]).endurance?.running;
  assert.ok(running);
  const before = structuredClone(running);
  const selection = selectRunningPreview(running);

  assert.equal(selection.source, "DRAFT");
  assert.ok("running" in selection);
  assert.equal(selection.running.weeks[0].sessions[0].id, manual.id);
  assert.deepEqual(running, before);
});

test("prévia de Corrida prioriza a proposta aberta sem aplicá-la ao rascunho", () => {
  const manual = createRunningSessionFromTemplate({
    templateId: "LONG_RUN",
    scheduledDate: "2026-11-15",
    weekday: "SUNDAY",
    environment: "ROAD",
  });
  const suggested = createRunningSessionFromTemplate({
    templateId: "INTERVAL",
    scheduledDate: "2026-11-13",
    weekday: "FRIDAY",
    environment: "TRACK",
  });
  const running = runningDraft([manual]).endurance?.running;
  assert.ok(running);
  const proposal = {
    id: randomUUID(),
    source: "ASSISTED_SUGGESTION" as const,
    scope: "WEEK" as const,
    period: {
      startDate: running.weeks[0].startDate,
      endDate: running.weeks[0].endDate,
    },
    strategySnapshot: { objective: "TAF fictício", weeklyFrequency: 3 },
    readiness: { status: "READY" as const, missingInformation: [] },
    reviewNotes: ["Revisão fictícia."],
    weeks: [{ ...running.weeks[0], sessions: [suggested] }],
  };
  const runningBefore = structuredClone(running);
  const proposalBefore = structuredClone(proposal);
  const selection = selectRunningPreview(running, proposal);

  assert.equal(selection.source, "PROPOSAL");
  assert.ok("running" in selection);
  assert.deepEqual(selection.running.weeks[0].sessions, [suggested]);
  assert.deepEqual(running, runningBefore);
  assert.deepEqual(proposal, proposalBefore);
});

test("ações de Treinos → Corrida usam estados exclusivos para a prévia da Corrida e a geral", () => {
  const panelSource = readFileSync(
    new URL(
      "../../components/performance-endurance/assisted-running-week-panel.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const workspaceSource = readFileSync(
    new URL(
      "../../components/performance-endurance/performance-workout-workspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(panelSource, />Prévia do rascunho</u);
  assert.match(panelSource, /Visualizar proposta do período/u);
  assert.match(panelSource, /Proposta do período — não aplicada/u);
  assert.match(panelSource, /Origem da repetição automática/u);
  assert.match(panelSource, /não uma individualização comprovada por desempenho do aluno/u);
  assert.match(panelSource, />Gerar semana assistida</u);
  assert.match(panelSource, />Gerar planejamento do período</u);
  assert.match(panelSource, /proposal\.readiness\.status === "REVIEW_REQUIRED"/u);
  assert.match(panelSource, /Acrescentar Corrida no período afetado/u);
  assert.match(panelSource, /Substituir Corrida no período afetado/u);
  assert.match(panelSource, /Confirmo a substituição somente das sessões de Corrida/u);
  assert.match(panelSource, /Outras modalidades e sessões fora desse período serão preservadas/u);
  assert.match(panelSource, /Notas internas de revisão — não exibidas ao aluno/u);
  assert.match(panelSource, /Orientação da semana/u);
  assert.match(
    panelSource,
    /Adicione uma sessão ao rascunho para visualizar a prévia do rascunho de Corrida/u,
  );
  assert.match(workspaceSource, />\s*Prévia geral do plano\s*</u);
  assert.match(
    workspaceSource,
    /onClick=\{\(\) => setDeliverablePreview\("GENERAL"\)\}/u,
  );
  assert.match(
    workspaceSource,
    /onPreviewDraft=\{\(\) => setDeliverablePreview\("RUNNING_DRAFT"\)\}/u,
  );
  assert.match(
    workspaceSource,
    /onPreviewProposal=\{\(\) => setDeliverablePreview\("RUNNING_PROPOSAL"\)\}/u,
  );
  assert.match(workspaceSource, /deliverablePreview === "GENERAL"/u);
  assert.match(workspaceSource, /deliverablePreview === "RUNNING_DRAFT"/u);
  assert.match(workspaceSource, /deliverablePreview === "RUNNING_PROPOSAL"/u);
  assert.ok(
    (workspaceSource.match(/setDeliverablePreview\(undefined\)/gu)?.length ?? 0) >= 2,
  );
  assert.match(workspaceSource, /selectRunningPreview\(draft\.endurance\.running, runningProposal\)/u);
  assert.match(workspaceSource, /selectRunningPreview\(draft\.endurance\.running\)/u);
  assert.match(workspaceSource, /Proposta do período — não aplicada/u);
  assert.match(workspaceSource, /contentScope="RUNNING"/u);
  assert.match(
    workspaceSource,
    /sticky top-\[calc\(4rem\+env\(safe-area-inset-top\)\)\][^"\n]*print:hidden/u,
  );
  assert.match(workspaceSource, /grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5/u);
  assert.match(workspaceSource, /scroll-mt-44 space-y-6/u);
  assert.match(workspaceSource, /Planejamento de Corrida aplicado ao rascunho no período de/u);
  assert.doesNotMatch(workspaceSource, /draftPrintPreviewOpen|runningPrintPreviewOpen/u);
});

test("editor e grade de Corrida mantêm textos longos responsivos sem corte", () => {
  const editorSource = readFileSync(
    new URL(
      "../../components/performance-endurance/running-session-editor.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const panelSource = readFileSync(
    new URL(
      "../../components/performance-endurance/assisted-running-week-panel.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const gridSource = readFileSync(
    new URL(
      "../../components/performance-endurance/running-week-grid.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const formSource = readFileSync(
    new URL("../../components/ui/form.tsx", import.meta.url),
    "utf8",
  );

  assert.match(editorSource, /AutoGrowTextarea[\s\S]+studentInstruction/u);
  assert.match(panelSource, /AutoGrowTextarea[\s\S]+Finalidade da semana/u);
  assert.match(panelSource, /AutoGrowTextarea[\s\S]+weeklyGuidance/u);
  assert.match(formSource, /\[field-sizing:content\]/u);
  assert.match(gridSource, /grid-cols-\[4\.5rem_minmax\(0,1fr\)\]/u);
  assert.match(gridSource, /md:grid-cols-\[7rem_repeat\(7,minmax\(0,1fr\)\)\]/u);
  assert.doesNotMatch(gridSource, /min-w-\[1120px\]/u);
  assert.doesNotMatch(editorSource, /xl:grid-cols-\[minmax\(0,1fr\)_9rem_11rem_13rem_11rem\]/u);
});

test("prévia da proposta usa somente o snapshot recém-gerado sem alterar sessões salvas", () => {
  const saved = createRunningSessionFromTemplate({
    templateId: "LONG_RUN",
    scheduledDate: "2026-11-15",
    weekday: "SUNDAY",
    environment: "ROAD",
  });
  const fresh = ["2026-11-11", "2026-11-13", "2026-11-16"].map(
    (scheduledDate) =>
      createRunningSessionFromTemplate({
        templateId: "EASY_RUN",
        scheduledDate,
        weekday: weekdayFromIsoDate(scheduledDate) ?? "MONDAY",
        environment: "ROAD",
      }),
  );
  const running = runningDraft([saved]).endurance?.running;
  assert.ok(running);

  const preview = runningProposalPreview(running, {
    id: randomUUID(),
    source: "ASSISTED_SUGGESTION",
    scope: "WEEK",
    period: {
      startDate: running.weeks[0].startDate,
      endDate: running.weeks[0].endDate,
    },
    strategySnapshot: {
      objective: "Preparação para TAF",
      weeklyFrequency: 3,
    },
    readiness: { status: "READY", missingInformation: [] },
    reviewNotes: ["Revisão fictícia."],
    weeks: [{ ...running.weeks[0], sessions: fresh }],
  });

  assert.deepEqual(
    preview.weeks[0].sessions.map((session) => session.scheduledDate),
    ["2026-11-11", "2026-11-13", "2026-11-16"],
  );
  assert.equal(running.weeks[0].sessions[0].scheduledDate, "2026-11-15");
  assert.equal(
    preview.weeks[0].sessions.some((session) => session.weekday === "SUNDAY"),
    false,
  );
});

test("intervalado fictício de 6 × 400 m registra cinco recuperações", () => {
  const session = createRunningSessionFromTemplate({
    templateId: "INTERVAL",
    scheduledDate: "2026-11-11",
    weekday: "WEDNESDAY",
    environment: "TRACK",
  });
  const configured = {
    ...session,
    title: "TAF fictício · 6 × 400 m",
    blocks: session.blocks.map((block) =>
      block.blockType !== "REPEAT"
        ? block
        : {
            ...block,
            repetitions: 6,
            includeRecoveryAfterLast: false,
            stages: block.stages.map((stage) =>
              stage.type === "WORK"
                ? {
                    ...stage,
                    completion: {
                      type: "DISTANCE" as const,
                      distanceMeters: 400,
                    },
                  }
                : {
                    ...stage,
                    completion: {
                      type: "TIME" as const,
                      durationSeconds: 90,
                    },
                  },
            ),
          },
    ),
  };

  const totals = runningPrescriptionTotals(configured);
  assert.equal(totals.recoveryCount, 5);
  assert.equal(totals.distanceMeters, 2_400);
  assert.equal(totals.durationSeconds, 450);
  assert.equal(totals.completeness, "PARTIAL");
  assert.equal(totals.durationCompleteness, "PARTIAL");
  assert.equal(totals.distanceCompleteness, "PARTIAL");
});

test("durações usam minutos e segundos e o total soma somente recuperações prescritas", () => {
  assert.equal(formatRunningDuration(4.716666666666667 * 60), "4 min 43 s");
  assert.equal(formatRunningDuration(2.35 * 60), "2 min 21 s");

  const session = createRunningSessionFromTemplate({
    templateId: "INTERVAL",
    scheduledDate: "2026-11-11",
    weekday: "WEDNESDAY",
    environment: "ROAD",
  });
  assert.equal(
    runningPrescriptionTotals(session).recoveryCount,
    0,
    "recuperação aberta no modelo não conta como prescrita",
  );
  const configured = {
    ...session,
    blocks: session.blocks.map((block) =>
      block.blockType !== "REPEAT"
        ? block
        : {
            ...block,
            repetitions: 3,
            includeRecoveryAfterLast: false,
            stages: block.stages.map((stage) => ({
              ...stage,
              completion: {
                type: "TIME" as const,
                durationSeconds:
                  stage.type === "RECOVERY"
                    ? 2.35 * 60
                    : 4.716666666666667 * 60,
              },
            })),
          },
    ),
  };

  const totals = runningPrescriptionTotals(configured);
  assert.equal(totals.recoveryCount, 2);
  assert.equal(totals.durationSeconds, 3 * 283 + 2 * 141);
  assert.equal(formatRunningDuration(totals.durationSeconds as number), "18 min 51 s");
});

test("troca entre tempo e distância preserva rascunhos sem inventar valor", () => {
  assert.equal(runningCompletionForMode("DISTANCE", { durationSeconds: 300 }), undefined);
  assert.deepEqual(
    runningCompletionForMode("DISTANCE", {
      durationSeconds: 300,
      distanceMeters: distanceMetersFromDisplay(1, "KM"),
    }),
    { type: "DISTANCE", distanceMeters: 1_000 },
  );
  assert.deepEqual(
    runningCompletionForMode("TIME", {
      durationSeconds: 300,
      distanceMeters: 1_000,
    }),
    { type: "TIME", durationSeconds: 300 },
  );
  assert.equal(distanceDisplayFromMeters(1_000, "KM"), 1);
  assert.equal(distanceDisplayFromMeters(400, "KM"), 0.4);
  assert.equal(distanceMetersFromDisplay(400, "M"), 400);
});

test("todos os blocos alternados salvam e reabrem sem campos redundantes", () => {
  const base = createRunningSessionFromTemplate({
    templateId: "EASY_RUN",
    scheduledDate: "2026-11-11",
    weekday: "WEDNESDAY",
    environment: "ROAD",
  });
  const values = [
    { type: "TIME" as const, durationSeconds: 300 },
    { type: "DISTANCE" as const, distanceMeters: 1_000 },
    { type: "TIME" as const, durationSeconds: 120 },
    { type: "DISTANCE" as const, distanceMeters: 400 },
  ];
  const session = {
    ...base,
    blocks: base.blocks.map((block, index) =>
      block.blockType === "STAGE"
        ? {
            ...block,
            stage: { ...block.stage, completion: values[index] },
          }
        : block,
    ),
  };
  const reopened = parseWorkoutPlanDraft(runningDraft([session]));
  const reopenedSession = reopened?.endurance?.running?.weeks[0].sessions[0];
  assert.ok(reopenedSession?.sessionKind === "STRUCTURED");
  assert.deepEqual(
    reopenedSession.blocks.map((block) =>
      block.blockType === "STAGE" ? block.stage.completion : undefined,
    ),
    values,
  );

  const totals = runningPrescriptionTotals(reopenedSession);
  assert.equal(totals.durationSeconds, 420);
  assert.equal(totals.distanceMeters, 1_400);
  assert.equal(totals.durationCompleteness, "PARTIAL");
  assert.equal(totals.distanceCompleteness, "PARTIAL");
});

test("sessão fictícia de esteira em km/h usa o mesmo alvo canônico do ritmo", () => {
  const pace = paceSecondsPerKilometerFromSpeed(12);
  assert.equal(pace, 300);
  assert.equal(speedKilometersPerHourFromPace(pace as number), 12);
  const session = createRunningSessionFromTemplate({
    templateId: "TEMPO",
    scheduledDate: "2026-11-13",
    weekday: "FRIDAY",
    environment: "TREADMILL",
  });
  const treadmill = {
    ...session,
    primaryIntensityMethod: "SPEED" as const,
    blocks: session.blocks.map((block) =>
      block.blockType !== "STAGE" || block.stage.type !== "WORK"
        ? block
        : {
            ...block,
            stage: {
              ...block.stage,
              intensityTarget: {
                type: "PACE" as const,
                unit: "SECONDS_PER_KILOMETER" as const,
                preferredDisplay: "SPEED" as const,
                target: {
                  valueType: "SINGLE" as const,
                  value: pace as number,
                },
              },
            },
          },
    ),
  };
  const reopened = parseWorkoutPlanDraft(runningDraft([treadmill]));
  const reopenedSession = reopened?.endurance?.running?.weeks[0].sessions[0];
  assert.equal(reopenedSession?.environment, "TREADMILL");
  assert.equal(reopenedSession?.primaryIntensityMethod, "SPEED");
  assert.equal(
    reopenedSession?.sessionKind === "STRUCTURED" &&
      reopenedSession.blocks[1]?.blockType === "STAGE" &&
      reopenedSession.blocks[1].stage.intensityTarget?.type === "PACE"
      ? reopenedSession.blocks[1].stage.intensityTarget.target.valueType === "SINGLE"
        ? reopenedSession.blocks[1].stage.intensityTarget.target.value
        : undefined
      : undefined,
    300,
  );
});

test("mover sessão atualiza o calendário sem duplicar o identificador", () => {
  const session = createRunningSessionFromTemplate({
    templateId: "EASY_RUN",
    scheduledDate: "2026-11-09",
    weekday: "MONDAY",
    environment: "ROAD",
  });
  const weeks = [runningWeek([session])];
  const moved = replaceRunningSessionInWeeks(weeks, {
    ...session,
    scheduledDate: "2026-11-10",
    weekday: "TUESDAY",
  });

  assert.equal(moved.flatMap((week) => week.sessions).length, 1);
  assert.equal(moved[0].sessions[0].id, session.id);
  assert.equal(moved[0].sessions[0].scheduledDate, "2026-11-10");
});

test("editar o rascunho não altera a entrega oficial finalizada", () => {
  const officialSession = createRunningSessionFromTemplate({
    templateId: "LONG_RUN",
    scheduledDate: "2026-11-15",
    weekday: "SUNDAY",
    environment: "ROAD",
  });
  const official = runningDraft([officialSession]);
  const adjustedDraft = {
    ...official,
    endurance: {
      ...official.endurance,
      running: {
        ...official.endurance?.running,
        configuration: official.endurance?.running?.configuration as NonNullable<WorkoutPlanDraft["endurance"]>["running"] extends infer R ? R extends { configuration: infer C } ? C : never : never,
        weeks: replaceRunningSessionInWeeks(
          official.endurance?.running?.weeks ?? [],
          { ...officialSession, title: "Longo ajustado no rascunho" },
        ),
      },
    },
  } satisfies WorkoutPlanDraft;

  assert.equal(
    official.endurance?.running?.weeks[0].sessions[0].title,
    "Longo",
  );
  assert.equal(
    adjustedDraft.endurance?.running?.weeks[0].sessions[0].title,
    "Longo ajustado no rascunho",
  );
});

test("cinco sessões de musculação não alteram três corridas por semana", () => {
  const draft = runningDraft([]);
  const configured = {
    ...draft,
    service: { ...draft.service, primaryModality: "Musculacao" },
    strategy: { ...draft.strategy, weeklyFrequency: 5 },
    endurance: {
      running: {
        ...draft.endurance!.running!,
        configuration: {
          ...draft.endurance!.running!.configuration,
          weeklyFrequency: 3,
          availableWeekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"] as const,
          environment: "ROAD" as const,
          primaryUnit: "TIME" as const,
          primaryIntensityMethod: "RPE" as const,
        },
      },
    },
  } satisfies WorkoutPlanDraft;

  const reopened = parseWorkoutPlanDraft(
    JSON.parse(JSON.stringify(configured)) as unknown,
  );

  assert.ok(reopened?.endurance?.running);
  assert.equal(reopened.strategy.weeklyFrequency, 5);
  assert.equal(reopened.endurance.running.configuration.weeklyFrequency, 3);
  assert.deepEqual(reopened.endurance.running.configuration.availableWeekdays, [
    "MONDAY",
    "WEDNESDAY",
    "FRIDAY",
  ]);
  assert.equal(reopened.endurance.running.configuration.environment, "ROAD");
  assert.equal(reopened.endurance.running.configuration.primaryUnit, "TIME");
  assert.equal(
    reopened.endurance.running.configuration.primaryIntensityMethod,
    "RPE",
  );
  assert.equal(reopened.service.primaryModality, "Musculacao");
});
