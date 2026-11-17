import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { emptyWorkoutPlanDraft } from "@/features/performance-endurance/workout-record";
import {
  createRunningSessionFromTemplate,
  selectRunningPreview,
} from "@/features/performance-endurance/running-session-editor";
import type {
  PerformanceWorkoutView,
  WorkoutExercise,
  WorkoutPlanEnduranceModality,
  WorkoutWeekday,
} from "@/features/performance-endurance/workout-contracts";
import type { PhysicalDocumentProfessionalIdentity } from "@/features/professional-responsibility/document-identity";

import { PerformanceDeliverablePreview } from "./performance-deliverable-preview";

const professional: PhysicalDocumentProfessionalIdentity = {
  userId: "professional-fictional",
  fullName: "Profissional Fictício",
  registrations: ["CREF TESTE"],
};

function finalizedView(
  draft: PerformanceWorkoutView["draft"],
): PerformanceWorkoutView {
  return {
    patient: {
      id: "patient-fictional",
      name: "Aluno Fictício",
      code: "SV-TESTE",
    },
    masterRecordId: "master-fictional",
    attendanceId: "attendance-fictional",
    entryId: "entry-fictional",
    status: "FINALIZED",
    draft,
    inheritedFacts: [],
    exerciseLibrary: [],
    responsibleProfessionalId: professional.userId,
    responsibleProfessional: professional.fullName,
    updatedAt: "2026-11-07T15:30:00.000Z",
    version: 4,
  };
}

function fictionalExercise(id: string, name: string): WorkoutExercise {
  return {
    id,
    order: 1,
    name,
    libraryExerciseId: `library-${id}`,
    libraryExerciseSource: "SCIENTIFIC_LIBRARY",
    prescription: "",
    sets: "3",
    repetitions: "8–10",
    load: "",
    loadUnit: "",
    rir: "2",
    rpe: "",
    intensityType: "",
    intensityValue: "",
    restInterval: "60 s",
    cadence: "",
    rangeOfMotion: "",
    methodId: "",
    observations: "",
    patientInstructions: "Execução fictícia controlada.",
    substituteExercise: "",
  };
}

test("prévia do período usa nove sessões da proposta e a prévia do rascunho preserva suas três sessões", () => {
  const makeSession = (
    id: string,
    title: string,
    scheduledDate: string,
    weekday: WorkoutWeekday,
  ) => {
    let part = 0;
    const session = createRunningSessionFromTemplate({
      templateId: "EASY_RUN",
      scheduledDate,
      weekday,
      environment: "ROAD",
      id: () => `${id}-part-${++part}`,
    });
    return { ...session, id, title };
  };
  const draftSessions = [
    makeSession("draft-old-1", "Rascunho antigo 1", "2026-11-03", "TUESDAY"),
    makeSession("draft-old-2", "Rascunho antigo 2", "2026-11-05", "THURSDAY"),
    makeSession("draft-old-3", "Rascunho antigo 3", "2026-11-07", "SATURDAY"),
  ];
  const proposalDates = [
    ["2026-11-02", "MONDAY"], ["2026-11-04", "WEDNESDAY"], ["2026-11-06", "FRIDAY"],
    ["2026-11-09", "MONDAY"], ["2026-11-11", "WEDNESDAY"], ["2026-11-13", "FRIDAY"],
    ["2026-11-16", "MONDAY"], ["2026-11-18", "WEDNESDAY"], ["2026-11-20", "FRIDAY"],
  ] as const satisfies readonly (readonly [string, WorkoutWeekday])[];
  const longInstruction = "Orientação personalizada extensa para conferir quebra de linha sem ocultar conteúdo: manter postura confortável, observar o ambiente, respeitar a sensação informada e interromper a sessão se houver qualquer sinal que exija revisão profissional.";
  const proposalSessions = proposalDates.map(([scheduledDate, weekday], index) => {
    const generated = makeSession(
      `proposal-period-${index + 1}`,
      `Proposta do período ${index + 1}`,
      scheduledDate,
      weekday,
    );
    return {
      ...generated,
      objective: `${generated.objective}. ${longInstruction}`,
      blocks: generated.blocks.map((block) => block.blockType === "STAGE"
        ? {
            ...block,
            stage: { ...block.stage, studentInstruction: longInstruction },
          }
        : block),
    };
  });
  const configuration: WorkoutPlanEnduranceModality<"RUNNING">["configuration"] = {
    modality: "RUNNING",
    primaryObjective: "Validar fontes independentes da prévia",
    currentLevel: "Fixture fictícia",
    startDate: "2026-11-02",
    cycleDurationWeeks: 3,
    weeklyFrequency: 3,
    availableWeekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"],
    environment: "ROAD",
    primaryUnit: "TIME",
    primaryIntensityMethod: "FREE_GUIDANCE",
  };
  const running: WorkoutPlanEnduranceModality<"RUNNING"> = {
    configuration,
    weeks: [{
      id: "draft-week-old",
      weekNumber: 1,
      startDate: "2026-11-02",
      endDate: "2026-11-08",
      phase: "Rascunho anterior",
      objective: "Três sessões antigas",
      weeklyGuidance: "Fonte: rascunho.",
      sessions: draftSessions,
    }],
  };
  const proposalWeeks = Array.from({ length: 3 }, (_, weekIndex) => ({
    id: `proposal-week-${weekIndex + 1}`,
    weekNumber: weekIndex + 1,
    startDate: proposalDates[weekIndex * 3][0],
    endDate: proposalDates[weekIndex * 3 + 2][0],
    phase: "Proposta assistida para revisão",
    objective: `Semana proposta ${weekIndex + 1}`,
    weeklyGuidance: "Fonte: proposta ativa não aplicada.",
    sessions: proposalSessions.slice(weekIndex * 3, weekIndex * 3 + 3),
  }));
  const proposal = {
    id: "proposal-period-preview-fixture",
    source: "ASSISTED_SUGGESTION" as const,
    scope: "PERIOD" as const,
    period: { startDate: "2026-11-02", endDate: "2026-11-20" },
    strategySnapshot: { objective: configuration.primaryObjective, weeklyFrequency: 3 },
    readiness: { status: "REVIEW_REQUIRED" as const, missingInformation: ["Fixture para revisão"] },
    reviewNotes: ["Fixture fictícia não aplicada."],
    weeks: proposalWeeks,
  };
  const draftSelection = selectRunningPreview(running);
  const proposalSelection = selectRunningPreview(running, proposal);
  assert.equal(draftSelection.source, "DRAFT");
  assert.equal(proposalSelection.source, "PROPOSAL");
  assert.ok("running" in draftSelection && "running" in proposalSelection);
  assert.equal(draftSelection.running.weeks.flatMap((week) => week.sessions).length, 3);
  assert.equal(proposalSelection.running.weeks.flatMap((week) => week.sessions).length, 9);

  const renderRunning = (
    selected: WorkoutPlanEnduranceModality<"RUNNING">,
    documentStatus: string,
  ) => {
    const empty = emptyWorkoutPlanDraft();
    return renderToStaticMarkup(
      <PerformanceDeliverablePreview
        contentScope="RUNNING"
        documentStatus={documentStatus}
        hidePrintActions
        professional={professional}
        view={{
          ...finalizedView({ ...empty, endurance: { running: selected } }),
          status: "DRAFT",
          updatedAt: undefined,
        }}
      />,
    );
  };
  const draftHtml = renderRunning(draftSelection.running, "Prévia da Corrida — rascunho não finalizado");
  const proposalHtml = renderRunning(proposalSelection.running, "Proposta do período — não aplicada");
  assert.match(draftHtml, /Prévia da Corrida — rascunho não finalizado/u);
  assert.match(proposalHtml, /Proposta do período — não aplicada/u);
  for (const session of draftSessions) {
    assert.match(draftHtml, new RegExp(session.title, "u"));
    assert.doesNotMatch(proposalHtml, new RegExp(session.title, "u"));
  }
  for (const session of proposalSessions) {
    assert.match(proposalHtml, new RegExp(session.title, "u"));
    assert.match(proposalHtml, new RegExp(session.scheduledDate.split("-").reverse().join("/"), "u"));
    assert.doesNotMatch(draftHtml, new RegExp(session.title, "u"));
  }
  assert.match(proposalHtml, new RegExp(longInstruction, "u"));
});

test("impressão de Corrida isola a fonte selecionada e aplica paginação própria", () => {
  const workspaceSource = readFileSync(
    new URL("../performance-endurance/performance-workout-workspace.tsx", import.meta.url),
    "utf8",
  );
  const previewSource = readFileSync(
    new URL("./performance-deliverable-preview.tsx", import.meta.url),
    "utf8",
  );
  const gridSource = readFileSync(
    new URL("../performance-endurance/running-week-grid.tsx", import.meta.url),
    "utf8",
  );
  const globalCss = readFileSync(
    new URL("../../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(workspaceSource, /selectRunningPreview\(draft\.endurance\.running, runningProposal\)/u);
  assert.match(workspaceSource, /selectRunningPreview\(draft\.endurance\.running\)/u);
  assert.match(workspaceSource, /<RunningPrintPreviewPortal source=\{isProposalPreview \? "PROPOSAL" : "DRAFT"\}>/u);
  assert.match(workspaceSource, /createPortal\(/u);
  assert.match(workspaceSource, /data-running-print-source=\{source\}/u);
  assert.match(globalCss, /body\.running-print-preview-open > \*:not\(\.running-print-preview-portal\)/u);
  assert.match(globalCss, /body\.running-print-preview-open \.running-print-controls/u);
  assert.match(globalCss, /position: static !important/u);
  assert.match(previewSource, /@page \{ size: \$\{hasRunningPrescription \? "A4 landscape" : "A4 portrait"\}/u);
  assert.match(previewSource, /\.performance-session \{[\s\S]*break-inside: avoid-page/u);
  assert.match(previewSource, /\.performance-session-block,[\s\S]*break-inside: avoid-page/u);
  assert.doesNotMatch(previewSource, /running-week-row:nth-child/u);
  assert.match(gridSource, /running-week-grid/u);
  assert.doesNotMatch(gridSource, /print:min-h-\[(?:16|32)mm\]/u);
});

test("entrega oficial mostra o percurso finalizado sem incorporar rascunho posterior", () => {
  const emptyDraft = emptyWorkoutPlanDraft();
  const officialDraft: PerformanceWorkoutView["draft"] = {
    ...emptyDraft,
    strategy: {
      ...emptyDraft.strategy,
      currentPhase: "Desenvolvimento",
      currentFocus: "Hipertrofia",
      nextPhase: "Intensificação",
      nextFocus: "Força",
      observations: "NOTA INTERNA QUE NÃO PODE APARECER",
      transitions: [
        {
          effectiveDate: "2026-11-10",
          recordedAt: "2026-11-07T15:30:00.000Z",
          phaseBefore: "Adaptação",
          phaseAfter: "Desenvolvimento",
          focusBefore: "Força",
          focusAfter: "Hipertrofia",
        },
      ],
    },
  };
  const laterDraft = {
    ...officialDraft,
    strategy: {
      ...officialDraft.strategy,
      currentPhase: "RASCUNHO POSTERIOR",
      currentFocus: "FOCO POSTERIOR",
      transitions: [],
    },
  };

  const html = renderToStaticMarkup(
    <PerformanceDeliverablePreview
      professional={professional}
      view={finalizedView(officialDraft)}
    />,
  );

  assert.match(html, /Seu percurso no treino/u);
  assert.match(html, /lucide-dumbbell/u);
  assert.match(html, /Percurso registrado/u);
  assert.match(html, /10\/11\/2026/u);
  assert.match(html, /Adaptação/u);
  assert.match(html, /Desenvolvimento/u);
  assert.match(html, /Hipertrofia/u);
  assert.match(html, /Próximo passo/u);
  assert.match(html, /Planejamento/u);
  assert.match(html, /Intensificação/u);
  assert.match(html, /Força/u);
  assert.doesNotMatch(html, /NOTA INTERNA QUE NÃO PODE APARECER/u);
  assert.doesNotMatch(html, new RegExp(laterDraft.strategy.currentPhase, "u"));
  assert.doesNotMatch(html, new RegExp(laterDraft.strategy.currentFocus, "u"));
});

test("entrega antiga abre com ausências tratadas sem regravar dados", () => {
  const html = renderToStaticMarkup(
    <PerformanceDeliverablePreview
      professional={professional}
      view={finalizedView(emptyWorkoutPlanDraft())}
    />,
  );

  assert.match(html, /Seu percurso no treino/u);
  assert.match(html, /Nenhuma mudança de fase registrada/u);
  assert.match(html, /Agora/u);
  assert.match(html, /Próximo passo/u);
  assert.ok((html.match(/Não informado/gu)?.length ?? 0) >= 4);
});

test("prévia assistida reutiliza o documento oficial sem se identificar como emissão", () => {
  const emptyDraft = emptyWorkoutPlanDraft();
  const previewDraft: PerformanceWorkoutView["draft"] = {
    ...emptyDraft,
    service: {
      ...emptyDraft.service,
      trainingObjective: "Objetivo geral da Musculação fictícia",
    },
    strategy: {
      ...emptyDraft.strategy,
      currentPhase: "Força fictícia",
      currentFocus: "Hipertrofia fictícia",
    },
    sessions: [
      {
        id: "session-fictional-a",
        name: "Treino A editado na prévia",
        objective: "Objetivo fictício",
        estimatedDuration: "50 min",
        observations: "",
        exercises: [
          fictionalExercise("exercise-fictional-a", "Exercício fictício A"),
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(
    <PerformanceDeliverablePreview
      documentStatus="Prévia — não finalizado"
      hidePrintActions
      professional={professional}
      view={{ ...finalizedView(previewDraft), status: "DRAFT" }}
    />,
  );

  assert.match(html, /Prévia — não finalizado/u);
  assert.match(html, /Plano de Treino/u);
  assert.match(html, /lucide-dumbbell/u);
  assert.doesNotMatch(html, /data-runner-icon="true"/u);
  assert.match(html, /Objetivo geral da Musculação fictícia/u);
  assert.match(html, /Força fictícia/u);
  assert.match(html, /Hipertrofia fictícia/u);
  assert.match(html, /Treino A editado na prévia/u);
  assert.match(html, /Objetivo fictício/u);
  assert.match(html, /Exercício fictício A/u);
  assert.doesNotMatch(html, /Data de emissão/u);
  assert.doesNotMatch(html, /Emitido em/u);
  assert.doesNotMatch(html, />Imprimir</u);
  assert.doesNotMatch(html, />Salvar em PDF</u);
});

test("ficha de corrida mostra cinco recuperações para 6 × 400 m sem recuperação final", () => {
  const session = createRunningSessionFromTemplate({
    templateId: "INTERVAL",
    scheduledDate: "2026-11-11",
    weekday: "WEDNESDAY",
    environment: "TRACK",
  });
  const interval = {
    ...session,
    title: "TAF fictício · 6 × 400 m",
    blocks: session.blocks.map((block) =>
      block.blockType === "REPEAT"
        ? {
            ...block,
            repetitions: 6,
            includeRecoveryAfterLast: false,
            stages: block.stages.map((stage) => ({
              ...stage,
              completion: stage.type === "WORK"
                ? { type: "DISTANCE" as const, distanceMeters: 400 }
                : { type: "OPEN_MANUAL" as const },
            })),
          }
        : block,
    ),
  };
  const empty = emptyWorkoutPlanDraft();
  const draft: PerformanceWorkoutView["draft"] = {
    ...empty,
    endurance: {
      running: {
        configuration: {
          modality: "RUNNING",
          primaryObjective: "TAF fictício",
          currentLevel: "Intermediário",
          startDate: "2026-11-09",
          cycleDurationWeeks: 1,
          weeklyFrequency: 1,
          availableWeekdays: ["WEDNESDAY"],
          environment: "TRACK",
          primaryUnit: "DISTANCE",
          primaryIntensityMethod: "RPE",
        },
        weeks: [{
          id: crypto.randomUUID(),
          weekNumber: 1,
          startDate: "2026-11-09",
          endDate: "2026-11-15",
          phase: "TAF",
          objective: "Teste fictício",
          weeklyGuidance: "Teste fictício",
          sessions: [interval],
        }],
      },
    },
  };
  const html = renderToStaticMarkup(
    <PerformanceDeliverablePreview
      documentStatus="Prévia — rascunho não finalizado"
      hidePrintActions
      professional={professional}
      view={{ ...finalizedView(draft), status: "DRAFT" }}
    />,
  );

  assert.match(html, /Detalhes das sessões/u);
  assert.match(html, /TAF fictício · 6 × 400 m/u);
  assert.match(html, /5 recuperações/u);
  assert.match(html, /somente entre os tiros/u);
  assert.match(html, /Tempo parcial: não calculável sem ritmo ou velocidade/u);
  assert.match(html, /Distância parcial: <span class="whitespace-nowrap">2,4 km<\/span>/u);
});

test("prévia exclusiva da proposta mostra somente objetivo, meta, período e Corrida", () => {
  const baseSession = createRunningSessionFromTemplate({
    templateId: "EASY_RUN",
    scheduledDate: "2026-11-11",
    weekday: "WEDNESDAY",
    environment: "ROAD",
  });
  const session = {
    ...baseSession,
    estimatedDurationSeconds: 40 * 60,
    blocks: baseSession.blocks.map((block, index) =>
      block.blockType !== "STAGE"
        ? block
        : {
            ...block,
            stage: {
              ...block.stage,
              completion: {
                type: "TIME" as const,
                durationSeconds: index === 0 ? 4.716666666666667 * 60 : 2.35 * 60,
              },
              intensityTarget: index === 0
                ? {
                    type: "FREE_GUIDANCE" as const,
                    guidance: "Mantenha esforço controlado e sustentável.",
                  }
                : index === 1
                  ? {
                      type: "RPE" as const,
                      unit: "RPE" as const,
                      target: {
                        valueType: "SINGLE" as const,
                        value: 6,
                      },
                    }
                  : block.stage.intensityTarget,
              studentInstruction: index === 0
                ? "Mantenha esforço controlado e sustentável."
                : block.stage.studentInstruction,
            },
          },
    ),
    professionalGuidance:
      "Proposta assistida de Corrida. Revisar duração, blocos e intensidade individual antes de aplicar.",
  };
  const empty = emptyWorkoutPlanDraft();
  const draft: PerformanceWorkoutView["draft"] = {
    ...empty,
    service: { ...empty.service, trainingObjective: "Perda de peso fictícia" },
    strategy: {
      ...empty.strategy,
      currentPhase: "Fase da musculação fictícia",
      currentFocus: "Foco da musculação fictício",
    },
    sessions: [{
      id: "strength-fictional-a",
      name: "Treino A fictício",
      objective: "Musculação fictícia",
      estimatedDuration: "50 min",
      observations: "",
      exercises: [],
    }],
    endurance: {
      running: {
        configuration: {
          modality: "RUNNING",
          primaryObjective: "Preparação para TAF",
          currentLevel: "Intermediário",
          startDate: "2026-11-11",
          cycleDurationWeeks: 1,
          weeklyFrequency: 3,
          availableWeekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"],
          environment: "ROAD",
          primaryUnit: "TIME",
          primaryIntensityMethod: "RPE",
          testGoal: {
            requiredDistanceMeters: 2_400,
            targetDurationSeconds: 12 * 60,
            testDate: "2026-12-10",
          },
        },
        weeks: [{
          id: crypto.randomUUID(),
          weekNumber: 1,
          startDate: "2026-11-11",
          endDate: "2026-11-17",
          phase: "Interna",
          objective: "Interno",
          weeklyGuidance: "Interna",
          sessions: [session],
        }],
      },
    },
  };

  const html = renderToStaticMarkup(
    <PerformanceDeliverablePreview
      contentScope="RUNNING"
      documentStatus="Prévia — não finalizado"
      hidePrintActions
      professional={professional}
      view={{ ...finalizedView(draft), status: "DRAFT" }}
    />,
  );

  assert.match(html, /Planejamento de Corrida/u);
  assert.match(html, /data-runner-icon="true"/u);
  assert.doesNotMatch(html, /lucide-dumbbell/u);
  assert.match(html, /Preparação para TAF/u);
  assert.match(html, /2,4 km em 12 min/u);
  assert.match(html, /11\/11\/2026 a 17\/11\/2026/u);
  assert.match(html, /4 min 43 s/u);
  assert.match(html, /2 min 21 s/u);
  assert.match(html, /duração originalmente planejada: <span class="whitespace-nowrap">40 min<\/span>/u);
  assert.doesNotMatch(html, /estimado: 40 min/u);
  assert.equal(
    html.match(/Mantenha esforço controlado e sustentável\./gu)?.length,
    1,
  );
  assert.match(html, /Esforço por orientação/u);
  assert.match(html, /RPE 6/u);
  assert.match(html, /Intensidade a definir/u);
  assert.doesNotMatch(html, /Z[1-5] ·[^<]*Mantenha esforço|bpm[^<]*Mantenha esforço|min\/km[^<]*Mantenha esforço/u);
  assert.doesNotMatch(html, /Treino A fictício/u);
  assert.doesNotMatch(html, /Perda de peso fictícia/u);
  assert.doesNotMatch(html, /Fase da musculação fictícia/u);
  assert.doesNotMatch(html, /Foco da musculação fictício/u);
  assert.doesNotMatch(html, /Seu percurso no treino/u);
  assert.doesNotMatch(html, /Revisar duração, blocos e intensidade/u);

  const finalizedHtml = renderToStaticMarkup(
    <PerformanceDeliverablePreview
      contentScope="RUNNING"
      hidePrintActions
      professional={professional}
      view={finalizedView(draft)}
    />,
  );
  assert.doesNotMatch(finalizedHtml, /Esforço por orientação/u);
  assert.equal(
    finalizedHtml.match(/Mantenha esforço controlado e sustentável\./gu)?.length,
    1,
  );
});

test("caminho integrado da prévia da Corrida prioriza três sessões propostas e renderiza a planilha sem aplicar", () => {
  const savedSession = createRunningSessionFromTemplate({
    templateId: "LONG_RUN",
    scheduledDate: "2026-11-15",
    weekday: "SUNDAY",
    environment: "ROAD",
  });
  const proposalSessions = [
    ["EASY_RUN", "2026-11-09", "MONDAY"],
    ["INTERVAL", "2026-11-11", "WEDNESDAY"],
    ["TEMPO", "2026-11-13", "FRIDAY"],
  ].map(([templateId, scheduledDate, weekday], index) => ({
    ...createRunningSessionFromTemplate({
      templateId: templateId as "EASY_RUN" | "INTERVAL" | "TEMPO",
      scheduledDate,
      weekday: weekday as "MONDAY" | "WEDNESDAY" | "FRIDAY",
      environment: index === 1 ? "TRACK" : "ROAD",
    }),
    title: `Sessão fictícia ${index + 1}`,
  }));
  const empty = emptyWorkoutPlanDraft();
  const draft: PerformanceWorkoutView["draft"] = {
    ...empty,
    sessions: [{
      id: "strength-fictional",
      name: "Treino A de musculação fictício",
      objective: "Conteúdo geral que não pertence à prévia da Corrida",
      estimatedDuration: "50 min",
      observations: "",
      exercises: [],
    }],
    endurance: {
      running: {
        configuration: {
          modality: "RUNNING",
          primaryObjective: "Corrida fictícia de validação",
          currentLevel: "Intermediário",
          startDate: "2026-11-09",
          cycleDurationWeeks: 1,
          weeklyFrequency: 3,
          availableWeekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"],
          environment: "ROAD",
          primaryUnit: "TIME",
          primaryIntensityMethod: "RPE",
          generalObservation: "Orientação fictícia do ciclo.",
        },
        weeks: [{
          id: "running-week-fictional",
          weekNumber: 1,
          startDate: "2026-11-09",
          endDate: "2026-11-15",
          phase: "Validação",
          objective: "Validar a prévia",
          weeklyGuidance: "Dados exclusivamente fictícios.",
          sessions: [savedSession],
        }],
      },
    },
  };
  const running = draft.endurance?.running;
  assert.ok(running);
  const draftBeforePreview = structuredClone(draft);
  const proposal = {
    id: "proposal-fictional",
    source: "ASSISTED_SUGGESTION" as const,
    scope: "WEEK" as const,
    period: {
      startDate: running.weeks[0].startDate,
      endDate: running.weeks[0].endDate,
    },
    strategySnapshot: {
      objective: "Corrida fictícia de validação",
      weeklyFrequency: 3,
    },
    readiness: { status: "READY" as const, missingInformation: [] },
    reviewNotes: ["Proposta fictícia para teste."],
    weeks: [{ ...running.weeks[0], sessions: proposalSessions }],
  };

  const selection = selectRunningPreview(running, proposal);
  assert.equal(selection.source, "PROPOSAL");
  assert.ok("running" in selection);
  const previewView = finalizedView({
    ...draft,
    endurance: { ...draft.endurance, running: selection.running },
  });
  const html = renderToStaticMarkup(
    <PerformanceDeliverablePreview
      contentScope="RUNNING"
      documentStatus="Prévia da proposta — não aplicada"
      hidePrintActions
      professional={professional}
      view={{ ...previewView, status: "DRAFT", updatedAt: undefined }}
    />,
  );

  assert.match(html, /Planejamento de Corrida/u);
  assert.match(html, /data-runner-icon="true"/u);
  assert.doesNotMatch(html, /lucide-dumbbell/u);
  assert.match(html, /Planejamento do ciclo/u);
  assert.match(html, /Como ler sua planilha/u);
  assert.match(html, /Orientações do ciclo/u);
  assert.match(html, /Orientação fictícia do ciclo\./u);
  assert.match(html, /Detalhes das sessões/u);
  for (const session of proposalSessions) assert.match(html, new RegExp(session.title, "u"));
  assert.doesNotMatch(html, /Treino A de musculação fictício/u);
  assert.doesNotMatch(html, new RegExp(savedSession.title, "u"));
  assert.deepEqual(draft, draftBeforePreview);
});

test("prévia geral omite Treinos A/B vazios e preserva a musculação preenchida", () => {
  const empty = emptyWorkoutPlanDraft();
  const draft: PerformanceWorkoutView["draft"] = {
    ...empty,
    sessions: [
      {
        id: "empty-strength-a",
        name: "Treino A vazio fictício",
        objective: "",
        estimatedDuration: "",
        observations: "",
        exercises: [],
      },
      {
        id: "empty-strength-b",
        name: "Treino B placeholder fictício",
        objective: "Objetivo ainda sem exercícios",
        estimatedDuration: "45 min",
        observations: "Placeholder fictício",
        exercises: [],
      },
      {
        id: "filled-strength-c",
        name: "Treino C preenchido fictício",
        objective: "Força fictícia",
        estimatedDuration: "55 min",
        observations: "",
        exercises: [
          fictionalExercise("exercise-filled-c", "Agachamento fictício"),
        ],
      },
    ],
  };
  const draftBeforePreview = structuredClone(draft);

  const html = renderToStaticMarkup(
    <PerformanceDeliverablePreview
      documentStatus="Prévia — rascunho não finalizado"
      hidePrintActions
      professional={professional}
      view={{ ...finalizedView(draft), status: "DRAFT" }}
    />,
  );

  assert.match(html, /Sessões de treino/u);
  assert.match(html, /Treino C preenchido fictício/u);
  assert.match(html, /Agachamento fictício/u);
  assert.doesNotMatch(html, /Treino A vazio fictício/u);
  assert.doesNotMatch(html, /Treino B placeholder fictício/u);
  assert.doesNotMatch(html, /Objetivo ainda sem exercícios/u);
  assert.deepEqual(draft, draftBeforePreview);
});

test("prévia geral somente de Corrida reutiliza a planilha do rascunho e ignora proposta não aplicada", () => {
  const draftSession = {
    ...createRunningSessionFromTemplate({
      templateId: "LONG_RUN",
      scheduledDate: "2026-11-15",
      weekday: "SUNDAY",
      environment: "ROAD",
    }),
    title: "Corrida do rascunho fictício",
  };
  const proposedSession = {
    ...createRunningSessionFromTemplate({
      templateId: "INTERVAL",
      scheduledDate: "2026-11-11",
      weekday: "WEDNESDAY",
      environment: "TRACK",
    }),
    title: "Corrida proposta ainda não aplicada",
  };
  const empty = emptyWorkoutPlanDraft();
  const draft: PerformanceWorkoutView["draft"] = {
    ...empty,
    service: {
      ...empty.service,
      trainingObjective: "Objetivo geral fictício preservado",
    },
    strategy: {
      ...empty.strategy,
      currentPhase: "Força que não pertence à Corrida",
      currentFocus: "Hipertrofia que não pertence à Corrida",
      nextPhase: "Potência que não pertence à Corrida",
    },
    sessions: [
      {
        id: "empty-strength-only-running-a",
        name: "Treino A vazio no plano de Corrida",
        objective: "",
        estimatedDuration: "",
        observations: "",
        exercises: [],
      },
      {
        id: "empty-strength-only-running-b",
        name: "Treino B vazio no plano de Corrida",
        objective: "",
        estimatedDuration: "",
        observations: "",
        exercises: [],
      },
    ],
    endurance: {
      running: {
        configuration: {
          modality: "RUNNING",
          primaryObjective: "Objetivo próprio da Corrida fictícia",
          currentLevel: "Intermediário",
          startDate: "2026-11-09",
          cycleDurationWeeks: 1,
          weeklyFrequency: 1,
          availableWeekdays: ["SUNDAY"],
          environment: "ROAD",
          primaryUnit: "TIME",
          primaryIntensityMethod: "RPE",
          generalObservation: "Orientação do rascunho fictício.",
          testGoal: {
            requiredDistanceMeters: 5_000,
            targetDurationSeconds: 25 * 60,
            testDate: "2026-12-20",
          },
        },
        weeks: [
          {
            id: "running-week-draft-fictional",
            weekNumber: 1,
            startDate: "2026-11-09",
            endDate: "2026-11-15",
            phase: "Base fictícia",
            objective: "Semana do rascunho",
            weeklyGuidance: "Dados fictícios.",
            sessions: [draftSession],
          },
        ],
      },
    },
  };
  const running = draft.endurance?.running;
  assert.ok(running);
  const proposal = {
    id: "running-proposal-not-applied-fictional",
    source: "ASSISTED_SUGGESTION" as const,
    scope: "WEEK" as const,
    period: {
      startDate: running.weeks[0].startDate,
      endDate: running.weeks[0].endDate,
    },
    strategySnapshot: {
      objective: running.configuration.primaryObjective,
      weeklyFrequency: 1,
    },
    readiness: { status: "READY" as const, missingInformation: [] },
    reviewNotes: ["Proposta fictícia ainda não aplicada."],
    weeks: [{ ...running.weeks[0], sessions: [proposedSession] }],
  };
  const proposalSelection = selectRunningPreview(running, proposal);
  assert.equal(proposalSelection.source, "PROPOSAL");
  const draftBeforePreview = structuredClone(draft);

  const html = renderToStaticMarkup(
    <PerformanceDeliverablePreview
      documentStatus="Prévia — rascunho não finalizado"
      hidePrintActions
      professional={professional}
      view={{ ...finalizedView(draft), status: "DRAFT", updatedAt: undefined }}
    />,
  );

  assert.match(html, /Plano de Corrida/u);
  assert.match(html, /data-runner-icon="true"/u);
  assert.doesNotMatch(html, /lucide-dumbbell/u);
  assert.match(html, /Objetivo próprio da Corrida fictícia/u);
  assert.match(html, /5 km em 25 min/u);
  assert.match(html, /09\/11\/2026 a 15\/11\/2026/u);
  assert.doesNotMatch(html, /Objetivo geral fictício preservado/u);
  assert.match(html, /Planejamento da Corrida/u);
  assert.match(html, /Como ler sua planilha/u);
  assert.match(html, /Orientações do ciclo/u);
  assert.match(html, /Orientação do rascunho fictício\./u);
  assert.match(html, /Legenda dos resumos/u);
  assert.match(html, /Legenda de intensidade/u);
  assert.match(html, /Detalhes das sessões/u);
  assert.match(html, /Corrida do rascunho fictício/u);
  assert.doesNotMatch(html, /Sessões de treino/u);
  assert.doesNotMatch(html, /Seu percurso no treino/u);
  assert.doesNotMatch(html, /Força que não pertence à Corrida/u);
  assert.doesNotMatch(html, /Hipertrofia que não pertence à Corrida/u);
  assert.doesNotMatch(html, /Potência que não pertence à Corrida/u);
  assert.doesNotMatch(html, /Treino A vazio no plano de Corrida/u);
  assert.doesNotMatch(html, /Treino B vazio no plano de Corrida/u);
  assert.doesNotMatch(html, /Corrida proposta ainda não aplicada/u);
  assert.deepEqual(draft, draftBeforePreview);
});

test("prévia geral mista mantém Plano de Treino e separa o contexto das modalidades", () => {
  const runningSession = {
    ...createRunningSessionFromTemplate({
      templateId: "EASY_RUN",
      scheduledDate: "2026-11-12",
      weekday: "THURSDAY",
      environment: "ROAD",
    }),
    title: "Corrida mista fictícia",
  };
  const empty = emptyWorkoutPlanDraft();
  const draft: PerformanceWorkoutView["draft"] = {
    ...empty,
    service: {
      ...empty.service,
      trainingObjective: "Objetivo geral do plano misto fictício",
    },
    strategy: {
      ...empty.strategy,
      currentPhase: "Força mista fictícia",
      currentFocus: "Hipertrofia mista fictícia",
    },
    sessions: [
      {
        id: "mixed-strength-session-fictional",
        name: "Musculação mista fictícia",
        objective: "Força da Musculação fictícia",
        estimatedDuration: "50 min",
        observations: "",
        exercises: [
          fictionalExercise("mixed-strength-exercise", "Remada fictícia"),
        ],
      },
    ],
    endurance: {
      running: {
        configuration: {
          modality: "RUNNING",
          primaryObjective: "Objetivo da Corrida mista fictícia",
          currentLevel: "Intermediário",
          startDate: "2026-11-09",
          cycleDurationWeeks: 1,
          weeklyFrequency: 1,
          availableWeekdays: ["THURSDAY"],
          environment: "ROAD",
          primaryUnit: "TIME",
          primaryIntensityMethod: "RPE",
          generalObservation: "Orientação mista fictícia.",
          testGoal: {
            requiredDistanceMeters: 10_000,
            targetDurationSeconds: 50 * 60,
            testDate: "2027-01-10",
          },
        },
        weeks: [
          {
            id: "mixed-running-week-fictional",
            weekNumber: 1,
            startDate: "2026-11-09",
            endDate: "2026-11-15",
            phase: "Base mista fictícia",
            objective: "Semana mista fictícia",
            weeklyGuidance: "Dados fictícios.",
            sessions: [runningSession],
          },
        ],
      },
    },
  };
  const draftBeforePreview = structuredClone(draft);

  const html = renderToStaticMarkup(
    <PerformanceDeliverablePreview
      documentStatus="Prévia — rascunho não finalizado"
      hidePrintActions
      professional={professional}
      view={{ ...finalizedView(draft), status: "DRAFT", updatedAt: undefined }}
    />,
  );

  assert.match(html, /Plano de Treino/u);
  assert.match(html, /lucide-dumbbell/u);
  assert.doesNotMatch(html, /data-runner-icon="true"/u);
  assert.match(html, /Objetivo geral do plano misto fictício/u);
  assert.match(html, /Musculação · percurso no treino/u);
  assert.match(html, /Força mista fictícia/u);
  assert.match(html, /Hipertrofia mista fictícia/u);
  assert.match(html, /Musculação · sessões de treino/u);
  assert.match(html, /Musculação mista fictícia/u);
  assert.match(html, /Remada fictícia/u);
  assert.match(html, /Corrida · planejamento do ciclo/u);
  assert.match(html, /Objetivo da Corrida mista fictícia/u);
  assert.match(html, /10 km em 50 min/u);
  assert.match(html, /09\/11\/2026 a 15\/11\/2026/u);
  assert.match(html, /Corrida · detalhes das sessões/u);
  assert.match(html, /Corrida mista fictícia/u);
  assert.deepEqual(draft, draftBeforePreview);
});

test("documento finalizado somente de Corrida conserva a identificação oficial existente", () => {
  const runningSession = createRunningSessionFromTemplate({
    templateId: "EASY_RUN",
    scheduledDate: "2026-11-12",
    weekday: "THURSDAY",
    environment: "ROAD",
  });
  const empty = emptyWorkoutPlanDraft();
  const draft: PerformanceWorkoutView["draft"] = {
    ...empty,
    strategy: {
      ...empty.strategy,
      currentPhase: "Fase oficial fictícia preservada",
    },
    endurance: {
      running: {
        configuration: {
          modality: "RUNNING",
          primaryObjective: "Corrida oficial fictícia",
          currentLevel: "Intermediário",
          startDate: "2026-11-09",
          cycleDurationWeeks: 1,
          weeklyFrequency: 1,
          availableWeekdays: ["THURSDAY"],
          environment: "ROAD",
          primaryUnit: "TIME",
          primaryIntensityMethod: "RPE",
        },
        weeks: [
          {
            id: "official-running-week-fictional",
            weekNumber: 1,
            startDate: "2026-11-09",
            endDate: "2026-11-15",
            phase: "Oficial fictícia",
            objective: "Documento finalizado fictício",
            weeklyGuidance: "Dados fictícios.",
            sessions: [runningSession],
          },
        ],
      },
    },
  };

  const html = renderToStaticMarkup(
    <PerformanceDeliverablePreview
      hidePrintActions
      professional={professional}
      view={finalizedView(draft)}
    />,
  );

  assert.match(html, /Plano de Treino/u);
  assert.match(html, /lucide-dumbbell/u);
  assert.doesNotMatch(html, /data-runner-icon="true"/u);
  assert.match(html, /Seu percurso no treino/u);
  assert.match(html, /Fase oficial fictícia preservada/u);
  assert.match(html, /Planilha de corrida/u);
  assert.doesNotMatch(html, /Plano de Corrida/u);
});

test("prévia de Corrida preserva textos fictícios longos e prepara A4 paisagem sem mascarar transbordamento", () => {
  const longObjective =
    "Objetivo semanal fictício muito extenso para validar quebra natural de linha em telas de 1366 px e em celular, preservando integralmente todas as orientações profissionais sem reticências, cortes ou redução de fonte.";
  const longInstruction =
    "Instrução fictícia extensa do bloco: mantenha a execução controlada, observe a respiração, respeite a recuperação prescrita e registre qualquer desconforto antes de avançar para a etapa seguinte.\nSegunda linha preservada para confirmar o crescimento vertical do card.";
  const baseSession = createRunningSessionFromTemplate({
    templateId: "EASY_RUN",
    scheduledDate: "2026-11-12",
    weekday: "THURSDAY",
    environment: "ROAD",
  });
  const runningSession = {
    ...baseSession,
    objective: longObjective,
    estimatedDistanceMeters: 5_000,
    blocks: baseSession.blocks.map((block) =>
      block.blockType === "STAGE"
        ? { ...block, stage: { ...block.stage, studentInstruction: longInstruction } }
        : {
            ...block,
            stages: block.stages.map((stage) => ({
              ...stage,
              studentInstruction: longInstruction,
            })),
          },
    ),
  };
  const empty = emptyWorkoutPlanDraft();
  const draft: PerformanceWorkoutView["draft"] = {
    ...empty,
    endurance: {
      running: {
        configuration: {
          modality: "RUNNING",
          primaryObjective: longObjective,
          currentLevel: "Intermediário fictício",
          startDate: "2026-11-09",
          cycleDurationWeeks: 1,
          weeklyFrequency: 1,
          availableWeekdays: ["THURSDAY"],
          environment: "ROAD",
          primaryUnit: "TIME",
          primaryIntensityMethod: "RPE",
        },
        weeks: [{
          id: "long-running-week-fictional",
          weekNumber: 1,
          startDate: "2026-11-09",
          endDate: "2026-11-15",
          phase: "Validação responsiva fictícia",
          objective: longObjective,
          weeklyGuidance: longInstruction,
          sessions: [runningSession],
        }],
      },
    },
  };

  const html = renderToStaticMarkup(
    <PerformanceDeliverablePreview
      contentScope="RUNNING"
      hidePrintActions
      professional={professional}
      view={finalizedView(draft)}
    />,
  );

  assert.ok(html.includes(longObjective));
  assert.ok(html.includes(longInstruction));
  assert.match(html, /@page \{ size: A4 landscape/u);
  assert.match(html, /max-w-\[297mm\]/u);
  assert.match(html, /whitespace-pre-wrap break-words/u);
  assert.match(html, /whitespace-nowrap[^>]*>5 km/u);
  assert.doesNotMatch(
    html,
    /class="[^"]*overflow-hidden[^"]*" id="performance-deliverable-report"/u,
  );
});
