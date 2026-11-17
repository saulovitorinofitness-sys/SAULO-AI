import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { createRunningSessionFromTemplate } from "@/features/performance-endurance/running-session-editor";
import type { WorkoutPlanEnduranceModality } from "@/features/performance-endurance/workout-contracts";

import { RunningSessionEditor } from "./running-session-editor";
import { RunningWeekGrid } from "./running-week-grid";

test("grade mostra ciclo móvel, sessões e semanas futuras a planejar", () => {
  const dates = ["2026-11-11", "2026-11-13", "2026-11-16"] as const;
  const weekdays = ["WEDNESDAY", "FRIDAY", "MONDAY"] as const;
  const running: WorkoutPlanEnduranceModality<"RUNNING"> = {
    configuration: {
      modality: "RUNNING",
      primaryObjective: "TAF fictício",
      currentLevel: "Intermediário",
      startDate: "2026-11-11",
      cycleDurationWeeks: 2,
      weeklyFrequency: 3,
      availableWeekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"],
      environment: "ROAD",
      primaryUnit: "TIME",
      primaryIntensityMethod: "RPE",
    },
    weeks: [{
      id: randomUUID(),
      weekNumber: 1,
      startDate: "2026-11-11",
      endDate: "2026-11-17",
      phase: "Semana 1",
      objective: "Fictício",
      weeklyGuidance: "Fictícia",
      sessions: dates.map((scheduledDate, index) =>
        createRunningSessionFromTemplate({
          templateId: index === 0 ? "INTERVAL" : "EASY_RUN",
          scheduledDate,
          weekday: weekdays[index],
          environment: "ROAD",
        }),
      ),
    }],
  };

  const html = renderToStaticMarkup(<RunningWeekGrid running={running} />);
  assert.match(html, /Semana 1/u);
  assert.match(html, /Semana 2/u);
  assert.match(html, /11\/11/u);
  assert.match(html, /13\/11/u);
  assert.match(html, /16\/11/u);
  assert.match(html, /Intervalado/u);
  assert.match(html, /Intensidade a definir/u);
  assert.match(html, /Sem zonas individuais configuradas/u);
  assert.doesNotMatch(html, /Z1 individual|Z5 individual/u);
  assert.ok(html.indexOf("11/11") < html.indexOf("13/11"));
  assert.ok(html.indexOf("13/11") < html.indexOf("16/11"));
  assert.ok((html.match(/Fora do período/gu)?.length ?? 0) >= 2);
  assert.ok((html.match(/A planejar/gu)?.length ?? 0) >= 8);
});

test("tela e impressão compartilham resumos compactos de intervalado, rodagem e treino misto", () => {
  const intervalBase = createRunningSessionFromTemplate({
    templateId: "INTERVAL",
    scheduledDate: "2026-11-11",
    weekday: "WEDNESDAY",
    environment: "TRACK",
  });
  const interval = {
    ...intervalBase,
    blocks: intervalBase.blocks.map((block) =>
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
  const distanceBase = createRunningSessionFromTemplate({
    templateId: "EASY_RUN",
    scheduledDate: "2026-11-13",
    weekday: "FRIDAY",
    environment: "ROAD",
  });
  const distanceRun = {
    ...distanceBase,
    title: "Rodagem por distância fictícia",
    blocks: distanceBase.blocks.map((block, index) => {
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
  const mixedBase = createRunningSessionFromTemplate({
    templateId: "PROGRESSIVE",
    scheduledDate: "2026-11-16",
    weekday: "MONDAY",
    environment: "ROAD",
  });
  const mixed = {
    ...mixedBase,
    title: "Treino misto fictício",
    blocks: mixedBase.blocks.map((block, index) => {
      assert.equal(block.blockType, "STAGE");
      return {
        ...block,
        stage: {
          ...block.stage,
          completion: index % 2 === 0
            ? { type: "TIME" as const, durationSeconds: (index + 1) * 300 }
            : { type: "DISTANCE" as const, distanceMeters: index === 1 ? 5_000 : 1_000 },
        },
      };
    }),
  };
  const running: WorkoutPlanEnduranceModality<"RUNNING"> = {
    configuration: {
      modality: "RUNNING",
      primaryObjective: "Validação visual fictícia",
      currentLevel: "Intermediário",
      startDate: "2026-11-11",
      cycleDurationWeeks: 2,
      weeklyFrequency: 3,
      availableWeekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"],
      environment: "ROAD",
      primaryUnit: "TIME",
      primaryIntensityMethod: "RPE",
    },
    weeks: [{
      id: randomUUID(),
      weekNumber: 1,
      startDate: "2026-11-11",
      endDate: "2026-11-17",
      phase: "Validação fictícia",
      objective: "Validação fictícia",
      weeklyGuidance: "Dados fictícios para validar a grade.",
      sessions: [interval, distanceRun, mixed],
    }],
  };

  const screenHtml = renderToStaticMarkup(<RunningWeekGrid running={running} />);
  const printHtml = renderToStaticMarkup(<RunningWeekGrid printMode running={running} />);
  for (const html of [screenHtml, printHtml]) {
    assert.match(html, /Aquec\. = aquecimento/u);
    assert.match(html, /recuperação ocorre somente entre tiros/u);
    assert.match(html, /Aquec\.: 8 min/u);
    assert.match(html, /Tiros: 4 × 2 min/u);
    assert.match(html, /Recup\.: 3 × 1 min/u);
    assert.match(html, /Final: 6 min/u);
    assert.match(html, /Total: 25 min/u);
    assert.match(html, /Rodagem por distância fictícia/u);
    assert.match(html, /Trabalho: 5 km/u);
    assert.match(html, /Total: 7,5 km/u);
    assert.match(html, /Treino misto fictício/u);
    assert.match(html, /Tempo parc\.: 20 min/u);
    assert.match(html, /Dist\. parc\.: 6 km/u);
    assert.doesNotMatch(html, /truncate|line-clamp|overflow-hidden/u);
  }
  assert.match(screenHtml, /grid-cols-\[4\.5rem_minmax\(0,1fr\)\]/u);
  assert.match(screenHtml, /md:grid-cols-\[7rem_repeat\(7,minmax\(0,1fr\)\)\]/u);
  assert.match(printHtml, /print:grid-cols-\[17mm_repeat\(7,minmax\(0,1fr\)\)\]/u);
  assert.doesNotMatch(screenHtml, /overflow-x-auto|min-w-\[1120px\]/u);
});

test("editor e ficha compartilham intensidade definida por bloco e ausência explícita", () => {
  const base = createRunningSessionFromTemplate({
    templateId: "EASY_RUN",
    scheduledDate: "2026-11-11",
    weekday: "WEDNESDAY",
    environment: "ROAD",
  });
  const defined = {
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
                target: { valueType: "SINGLE" as const, value: 6 },
              },
            },
          }
        : block,
    ),
  };
  const running: WorkoutPlanEnduranceModality<"RUNNING"> = {
    configuration: {
      modality: "RUNNING",
      primaryObjective: "Validação fictícia",
      currentLevel: "Intermediário",
      startDate: "2026-11-11",
      cycleDurationWeeks: 1,
      weeklyFrequency: 1,
      availableWeekdays: ["WEDNESDAY"],
      environment: "ROAD",
      primaryUnit: "TIME",
      primaryIntensityMethod: "RPE",
    },
    weeks: [{
      id: randomUUID(),
      weekNumber: 1,
      startDate: "2026-11-11",
      endDate: "2026-11-17",
      phase: "Fictícia",
      objective: "Fictício",
      weeklyGuidance: "Fictícia",
      sessions: [defined],
    }],
  };

  const gridHtml = renderToStaticMarkup(<RunningWeekGrid running={running} />);
  const editorHtml = renderToStaticMarkup(
    <RunningSessionEditor
      disabled={false}
      onChange={() => undefined}
      runningWeeklyFrequency={1}
      value={running}
    />,
  );

  assert.match(gridHtml, /RPE 6/u);
  assert.doesNotMatch(gridHtml, /Z[1-5] ·/u);
  assert.match(editorHtml, /Trabalho: escala de intensidade/u);
  assert.match(editorHtml, /Recuperação: escala de intensidade/u);
  assert.match(editorHtml, />Percepção de esforço · RPE \(0–10\)</u);
  assert.match(editorHtml, /value="6"/u);
  assert.match(editorHtml, />Intensidade a definir</u);

  const qualitativeSession = {
    ...defined,
    primaryIntensityMethod: "FREE_GUIDANCE" as const,
    blocks: defined.blocks.map((block) =>
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
  const qualitativeRunning = {
    ...running,
    weeks: running.weeks.map((week) => ({ ...week, sessions: [qualitativeSession] })),
  };
  const qualitativeGridHtml = renderToStaticMarkup(<RunningWeekGrid running={qualitativeRunning} />);
  const qualitativeEditorHtml = renderToStaticMarkup(
    <RunningSessionEditor disabled={false} onChange={() => undefined} runningWeeklyFrequency={1} value={qualitativeRunning} />,
  );
  for (const html of [qualitativeGridHtml, qualitativeEditorHtml]) {
    assert.match(html, /Esforço por orientação/u);
    assert.match(html, /Respiração confortável e técnica estável/u);
  }
  assert.doesNotMatch(qualitativeGridHtml, /Z[1-5] ·|RPE \d|bpm|min\/km/u);
  assert.doesNotMatch(
    qualitativeEditorHtml,
    /Esforço por orientação[^<]*(?:Z[1-5]|RPE \d|bpm|min\/km)/u,
  );
});

test("editor de período compara a frequência por semana, sem marcar semanas parciais como divergência", () => {
  const makeSession = (scheduledDate: string, weekday: "MONDAY" | "WEDNESDAY" | "FRIDAY") =>
    createRunningSessionFromTemplate({
      templateId: "EASY_RUN",
      scheduledDate,
      weekday,
      environment: "ROAD",
    });
  const running: WorkoutPlanEnduranceModality<"RUNNING"> = {
    configuration: {
      modality: "RUNNING",
      primaryObjective: "Período fictício",
      currentLevel: "Intermediário",
      startDate: "2026-11-25",
      cycleDurationWeeks: 2,
      weeklyFrequency: 3,
      availableWeekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"],
      environment: "ROAD",
      primaryUnit: "TIME",
      primaryIntensityMethod: "RPE",
    },
    weeks: [
      {
        id: randomUUID(),
        weekNumber: 1,
        startDate: "2026-11-25",
        endDate: "2026-11-29",
        phase: "Adaptação",
        objective: "Semana parcial fictícia",
        weeklyGuidance: "Dados fictícios.",
        sessions: [
          makeSession("2026-11-25", "WEDNESDAY"),
          makeSession("2026-11-27", "FRIDAY"),
        ],
      },
      {
        id: randomUUID(),
        weekNumber: 2,
        startDate: "2026-11-30",
        endDate: "2026-12-06",
        phase: "Desenvolvimento",
        objective: "Semana completa fictícia",
        weeklyGuidance: "Dados fictícios.",
        sessions: [
          makeSession("2026-11-30", "MONDAY"),
          makeSession("2026-12-02", "WEDNESDAY"),
          makeSession("2026-12-04", "FRIDAY"),
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(
    <RunningSessionEditor
      disabled={false}
      onChange={() => undefined}
      runningWeeklyFrequency={3}
      value={running}
    />,
  );

  assert.match(html, /5 sessão\(ões\) programada\(s\) no período/u);
  assert.doesNotMatch(html, /revisar divergência/u);
});
