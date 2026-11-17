import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  createRunningSessionFromTemplate,
  runningPrescriptionTotals,
} from "./running-session-editor";
import {
  buildRunningWeekGrid,
  runningBlockSequence,
  runningBlockSequenceLines,
  runningIntensityPresentation,
  runningSessionGridTotalLines,
  runningSessionTotalLabel,
} from "./running-week-presentation";
import type { WorkoutPlanEnduranceModality } from "./workout-contracts";

function running(): WorkoutPlanEnduranceModality<"RUNNING"> {
  const dates = ["2026-11-11", "2026-11-13", "2026-11-16"] as const;
  const weekdays = ["WEDNESDAY", "FRIDAY", "MONDAY"] as const;
  const sessions = dates.map((scheduledDate, index) =>
    createRunningSessionFromTemplate({
      templateId: index === 0 ? "INTERVAL" : "EASY_RUN",
      scheduledDate,
      weekday: weekdays[index],
      environment: "ROAD",
    }),
  );
  return {
    configuration: {
      modality: "RUNNING",
      primaryObjective: "Preparação fictícia",
      currentLevel: "Intermediário",
      startDate: "2026-11-11",
      cycleDurationWeeks: 3,
      weeklyFrequency: 3,
      availableWeekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"],
      environment: "ROAD",
      primaryUnit: "TIME",
      primaryIntensityMethod: "RPE",
      generalObservation: "Orientação fictícia do ciclo.",
    },
    weeks: [{
      id: randomUUID(),
      weekNumber: 1,
      startDate: "2026-11-11",
      endDate: "2026-11-17",
      phase: "Semana 1",
      objective: "Semana fictícia",
      weeklyGuidance: "Revisar a semana fictícia.",
      sessions,
    }],
  };
}

test("grade preserva a semana móvel, mas projeta as sessões em semanas civis crescentes", () => {
  const value = running();
  const before = structuredClone(value);
  const rows = buildRunningWeekGrid(value);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].startDate, "2026-11-09");
  assert.equal(rows[0].endDate, "2026-11-15");
  assert.deepEqual(
    rows[0].cells.flatMap((cell) =>
      cell.sessions.length ? [cell.date] : [],
    ),
    ["2026-11-11", "2026-11-13"],
  );
  assert.deepEqual(
    rows[1].cells.flatMap((cell) =>
      cell.sessions.length ? [cell.date] : [],
    ),
    ["2026-11-16"],
  );
  assert.deepEqual(
    rows[0].cells.map((cell) => cell.date),
    [
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ],
  );
  assert.equal(rows[0].cells[0].inCyclePeriod, false);
  assert.equal(rows[0].cells[1].inCyclePeriod, false);
  assert.equal(rows[0].cells[2].inCyclePeriod, true);
  assert.equal(rows[2].cells.every((cell) => cell.sessions.length === 0), true);
  assert.deepEqual(value, before);
});

test("resumo usa blocos, total parcial e intensidade neutra sem inventar zona", () => {
  const session = running().weeks[0].sessions[0];
  assert.ok(session.sessionKind === "STRUCTURED");
  assert.match(runningBlockSequence(session), /Aquecimento/u);
  assert.equal(
    runningIntensityPresentation(session).label,
    "Intensidade a definir",
  );
  assert.match(runningSessionTotalLabel(session), /Tempo parcial/u);
});

test("orientação qualitativa tem apresentação própria sem virar zona ou alvo numérico", () => {
  const base = running().weeks[0].sessions[1];
  assert.ok(base.sessionKind === "STRUCTURED");
  const session = {
    ...base,
    blocks: base.blocks.map((block) =>
      block.blockType === "STAGE" && block.stage.type === "WORK"
        ? {
            ...block,
            stage: {
              ...block.stage,
              intensityTarget: {
                type: "FREE_GUIDANCE" as const,
                guidance: "Respiração confortável e técnica estável.",
              },
            },
          }
        : block,
    ),
  };

  assert.deepEqual(runningIntensityPresentation(session), {
    label: "Esforço por orientação",
    guidance: "Respiração confortável e técnica estável.",
    tone: "NEUTRAL",
  });
});

test("zona individual aparece apenas quando a faixa numérica corresponde", () => {
  const base = running().weeks[0].sessions[1];
  assert.ok(base.sessionKind === "STRUCTURED");
  const session = {
    ...base,
    blocks: base.blocks.map((block) =>
      block.blockType === "STAGE" && block.stage.type === "WORK"
        ? {
            ...block,
            stage: {
              ...block.stage,
              intensityTarget: {
                type: "RPE" as const,
                unit: "RPE" as const,
                target: {
                  valueType: "RANGE" as const,
                  minimum: 5,
                  maximum: 6,
                },
              },
            },
          }
        : block,
    ),
  };
  const presentation = runningIntensityPresentation(session, {
    source: "MANUAL",
    assessedAt: "2026-11-01",
    zones: {
      Z1: { minimumRpe: 1, maximumRpe: 2 },
      Z2: { minimumRpe: 3, maximumRpe: 4 },
      Z3: { name: "Moderada", minimumRpe: 5, maximumRpe: 6 },
      Z4: { minimumRpe: 7, maximumRpe: 8 },
      Z5: { minimumRpe: 9, maximumRpe: 10 },
    },
  });

  assert.deepEqual(presentation, {
    label: "Z3 · Moderada · RPE 5–6",
    zone: "Z3",
    tone: "Z3",
  });
});

test("resumo intervalado distingue três ou quatro recuperações sem alterar totais", () => {
  const base = running().weeks[0].sessions[0];
  assert.ok(base.sessionKind === "STRUCTURED");
  const interval = {
    ...base,
    blocks: base.blocks.map((block) =>
      block.blockType === "REPEAT"
        ? {
            ...block,
            repetitions: 4,
            stages: block.stages.map((stage) => ({
              ...stage,
              completion: {
                type: "TIME" as const,
                durationSeconds: stage.type === "WORK" ? 120 : 60,
              },
            })),
          }
        : {
            ...block,
            stage: {
              ...block.stage,
              completion: {
                type: "TIME" as const,
                durationSeconds: block.stage.type === "WARM_UP" ? 480 : 360,
              },
            },
          },
    ),
  };
  const repeat = interval.blocks.find((block) => block.blockType === "REPEAT");
  assert.ok(repeat?.blockType === "REPEAT");

  assert.match(
    runningBlockSequence(interval),
    /4 tiros de 2 min · 3 recuperações de 1 min, somente entre tiros/u,
  );
  assert.deepEqual(runningBlockSequenceLines(interval), [
    "Aquec.: 8\u00a0min",
    "Tiros: 4 × 2\u00a0min",
    "Recup.: 3 × 1\u00a0min",
    "Final: 6\u00a0min",
  ]);
  assert.deepEqual(runningSessionGridTotalLines(interval), ["Total: 25\u00a0min"]);
  assert.equal(runningPrescriptionTotals(interval).recoveryCount, 3);

  const withFinalRecovery = {
    ...interval,
    blocks: interval.blocks.map((block) =>
      block.id === repeat.id
        ? { ...block, includeRecoveryAfterLast: true }
        : block,
    ),
  };
  assert.match(
    runningBlockSequence(withFinalRecovery),
    /4 tiros de 2 min · 4 recuperações de 1 min, inclusive após o último tiro/u,
  );
  assert.deepEqual(runningBlockSequenceLines(withFinalRecovery), [
    "Aquec.: 8\u00a0min",
    "Tiros: 4 × 2\u00a0min",
    "Recup.: 4 × 1\u00a0min · inclui recuperação final",
    "Final: 6\u00a0min",
  ]);
  assert.deepEqual(runningSessionGridTotalLines(withFinalRecovery), ["Total: 26\u00a0min"]);
  assert.equal(runningPrescriptionTotals(withFinalRecovery).recoveryCount, 4);
});

test("resumos compactos preservam distância e totais parciais de sessão mista", () => {
  const base = running().weeks[0].sessions[1];
  assert.ok(base.sessionKind === "STRUCTURED");
  const distanceRun = {
    ...base,
    blocks: base.blocks.map((block, index) => {
      assert.equal(block.blockType, "STAGE");
      return {
        ...block,
        stage: {
          ...block.stage,
          completion: {
            type: "DISTANCE" as const,
            distanceMeters: [1_000, 5_000, 500, 1_000][index],
          },
        },
      };
    }),
  };
  assert.deepEqual(runningBlockSequenceLines(distanceRun), [
    "Aquec.: 1\u00a0km",
    "Trabalho: 5\u00a0km",
    "Recup.: 500\u00a0m",
    "Final: 1\u00a0km",
  ]);
  assert.deepEqual(runningSessionGridTotalLines(distanceRun), ["Total: 7,5\u00a0km"]);

  const mixed = {
    ...distanceRun,
    blocks: distanceRun.blocks.map((block, index) =>
      index % 2 === 0
        ? {
            ...block,
            stage: {
              ...block.stage,
              completion: { type: "TIME" as const, durationSeconds: (index + 1) * 300 },
            },
          }
        : block,
    ),
  };
  assert.deepEqual(runningBlockSequenceLines(mixed), [
    "Aquec.: 5\u00a0min",
    "Trabalho: 5\u00a0km",
    "Recup.: 15\u00a0min",
    "Final: 1\u00a0km",
  ]);
  assert.deepEqual(runningSessionGridTotalLines(mixed), [
    "Tempo parc.: 20\u00a0min",
    "Dist. parc.: 6\u00a0km",
  ]);
});
