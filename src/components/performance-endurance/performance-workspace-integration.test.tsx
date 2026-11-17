import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { emptyWorkoutPlanDraft } from "@/features/performance-endurance/workout-record";

import { RunningExecutionHistory } from "./running-execution-history";
import {
  performanceWorkspaceCalendarData,
  performanceWorkspaceTabFromQuery,
} from "./performance-workout-workspace";

const entryId = "5c8d6c29-3147-43ba-8b43-02df47be2d10";
const versionId = "7c559ecb-dba7-4e59-bd87-276bbf8e7378";

test("calendário acompanha o rascunho aberto sem liberar ação de plano finalizado", () => {
  const base = emptyWorkoutPlanDraft();
  const draft = {
    ...base,
    service: {
      ...base.service,
      primaryModality: "Musculação",
    },
    sessions: [
      {
        id: "8f5376a0-5ec4-4613-a6a4-d69815c582e5",
        name: "Treino fictício editado",
        objective: "Validação fictícia",
        estimatedDuration: "45 min",
        observations: "",
        exercises: [],
      },
    ],
  };

  const draftData = performanceWorkspaceCalendarData(
    { entryId, status: "DRAFT", version: 3 },
    draft,
  );
  assert.deepEqual(draftData.planOptions, []);

  const finalizedData = performanceWorkspaceCalendarData(
    {
      entryId,
      workoutPlanVersionId: versionId,
      status: "FINALIZED",
      version: 4,
    },
    draft,
  );
  assert.equal(finalizedData.planOptions.length, 1);
  assert.equal(finalizedData.planOptions[0]?.sessionLabel, "Treino fictício editado");
  assert.equal(finalizedData.planOptions[0]?.workoutPlanVersionId, versionId);
});

test("abas novas permanecem montadas e o acesso antigo ao calendário continua aceito", async () => {
  const [workspace, page] = await Promise.all([
    readFile(new URL("./performance-workout-workspace.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../../app/(authenticated)/performance-endurance/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(workspace, /label: "Resumo"/u);
  assert.match(workspace, /label: "Planejamento"/u);
  assert.match(workspace, /label: "Treinos"/u);
  assert.match(workspace, /label: "Calendário"/u);
  assert.match(workspace, /label: "Execuções e relógio"/u);
  assert.match(workspace, /hidden=\{activeWorkspaceTab !== "CALENDAR"\}/u);
  assert.match(workspace, /hidden=\{activeWorkspaceTab !== "EXECUTIONS"\}/u);
  assert.match(workspace, /const \[runningConfigurationDraft/u);
  assert.match(workspace, /const \[runningProposal/u);
  assert.match(page, /calendarPatientId/u);
  assert.match(page, /<PerformanceCalendarView/u);
  assert.match(page, /workspaceHref\([\s\S]*"calendar"/u);
  assert.equal(performanceWorkspaceTabFromQuery("calendar"), "CALENDAR");
  assert.equal(performanceWorkspaceTabFromQuery("executions"), "EXECUTIONS");
  assert.equal(performanceWorkspaceTabFromQuery(null), "SUMMARY");
});

test("histórico vazio não é apresentado como falha de carregamento", () => {
  const html = renderToStaticMarkup(
    <RunningExecutionHistory
      initialExecutions={[]}
      masterRecordId="ec6a8ae7-7217-4fc4-bc4b-0feb952fb948"
    />,
  );
  assert.match(html, /Nenhuma execução importada encontrada/u);
  assert.doesNotMatch(html, /Tentar novamente/u);
});

test("falha do histórico oferece nova tentativa sem tratar erro como lista vazia", async () => {
  const source = await readFile(
    new URL("./running-execution-history.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /role="alert"/u);
  assert.match(source, /Tentar novamente/u);
  assert.match(source, /setRetryKey\(\(current\) => current \+ 1\)/u);
});
