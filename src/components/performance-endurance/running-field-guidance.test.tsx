import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { createRunningSessionFromTemplate } from "@/features/performance-endurance/running-session-editor";
import type { WorkoutPlanEnduranceModality } from "@/features/performance-endurance/workout-contracts";

import {
  RunningPlanConfigurationForm,
  type RunningPlanConfiguration,
} from "./running-plan-configuration-form";
import { RunningSessionEditor } from "./running-session-editor";

function configurationFixture(): RunningPlanConfiguration {
  return {
    modality: "RUNNING",
    primaryObjective: "Preparação fictícia para TAF",
    currentLevel: "Iniciante",
    startDate: "2026-11-16",
    cycleDurationWeeks: 4,
    weeklyFrequency: 3,
    availableWeekdays: [],
    environment: "ROAD",
    primaryUnit: "TIME",
    primaryIntensityMethod: "RPE",
  };
}

function editorFixture(): WorkoutPlanEnduranceModality<"RUNNING"> {
  const session = createRunningSessionFromTemplate({
    templateId: "INTERVAL",
    scheduledDate: "2026-11-18",
    weekday: "WEDNESDAY",
    environment: "TRACK",
    id: (() => {
      let current = 0;
      return () => `field-guidance-fictional-${++current}`;
    })(),
  });
  return {
    configuration: configurationFixture(),
    weeks: [{
      id: "field-guidance-week-fictional",
      weekNumber: 1,
      startDate: "2026-11-16",
      endDate: "2026-11-22",
      phase: "Fixture fictícia",
      objective: "Fixture fictícia",
      weeklyGuidance: "Fixture fictícia",
      sessions: [session],
    }],
  };
}

test("Planejamento separa dado atual, meta futura e decisão profissional com ajuda associada", () => {
  const html = renderToStaticMarkup(
    <RunningPlanConfigurationForm
      onChange={() => undefined}
      value={configurationFixture()}
    />,
  );

  assert.match(html, /Dados atuais do aluno/u);
  assert.match(html, /Meta futura/u);
  assert.match(html, /Decisão profissional/u);
  assert.match(html, /Opcional no rascunho/u);
  assert.match(html, /Se algo não estiver disponível, deixe o campo vazio/u);
  assert.match(html, /RPE:<\/strong> percepção de esforço de 0 a 10/u);
  assert.match(html, /aria-describedby="running-primary-objective-description"/u);
  assert.match(html, /id="running-primary-objective-description"/u);
  assert.match(html, /aria-describedby="running-current-continuous-distance-description"/u);
  assert.match(html, /id="running-current-continuous-distance-description"/u);
  assert.match(html, /id="running-resting-heart-rate"[^>]*value=""/u);
});

test("editor explica Comando manual e intensidade sem alterar a fixture", () => {
  const fixture = editorFixture();
  const original = structuredClone(fixture);
  let changeCount = 0;
  const html = renderToStaticMarkup(
    <RunningSessionEditor
      disabled={false}
      onChange={() => {
        changeCount += 1;
      }}
      runningWeeklyFrequency={3}
      value={fixture}
    />,
  );

  assert.match(html, /Como o bloco termina/u);
  assert.match(html, /Comando manual · sem tempo ou distância/u);
  assert.match(html, /não entra nesses totais enquanto permanecer aberto/u);
  assert.match(html, /Como controlar a intensidade/u);
  assert.match(html, /Percepção de esforço · RPE \(0–10\)/u);
  assert.match(html, /aria-describedby="field-guidance-fictional-\d+-completion-description"/u);
  assert.match(html, /id="field-guidance-fictional-\d+-completion-description"/u);
  assert.equal(changeCount, 0);
  assert.deepEqual(fixture, original);
});

test("painel assistido mantém personalização opcional e geração independente do formulário manual", async () => {
  const source = await readFile(
    new URL("./assisted-running-week-panel.tsx", import.meta.url),
    "utf8",
  );

  for (const id of [
    "assisted-running-comfortable-continuous-time",
    "assisted-running-restrictions",
  ]) {
    assert.match(source, new RegExp(`aria-describedby="${id}-description"`, "u"));
  }
  assert.match(source, /aria-describedby=\{`\$\{prefix\}-objective-description`\}/u);
  assert.match(source, /aria-describedby=\{`\$\{prefix\}-rationale-description`\}/u);
  assert.match(source, /Tempo contínuo confortável atual \(min\)/u);
  assert.match(source, /Finalidade da sessão/u);
  assert.match(source, /Justificativa da estratégia/u);
  assert.match(source, /Retorno recente à Corrida \(opcional\)/u);
  assert.match(source, /Se não houver informação, deixe vazio/u);
  assert.match(source, /Você pode gerar sem preencher esta seção/u);
  assert.match(source, /Personalizar a sugestão \(opcional\)/u);
  assert.match(source, /Definição detalhada por treino \(opcional\)/u);
  assert.doesNotMatch(source, /\.\.\.minimumInformation/u);
  const pendingBlock = /const generationPendingInformation = \[([\s\S]*?)\n  \];/u.exec(source)?.[1] ?? "";
  assert.doesNotMatch(pendingBlock, /essentialQuestions|sharedFormat|sharedWork|sharedIntensity/u);
});
