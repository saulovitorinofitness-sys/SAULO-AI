import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { WorkoutPlanEnduranceModality } from "@/features/performance-endurance/workout-contracts";

import {
  activateRunningAssistedGeneration,
  activateRunningManualEntry,
} from "./assisted-running-week-panel";
import {
  revealRunningManualSessionForm,
  RunningSessionEditor,
} from "./running-session-editor";

function emptyRunningFixture(): WorkoutPlanEnduranceModality<"RUNNING"> {
  return {
    configuration: {
      modality: "RUNNING",
      primaryObjective: "Fixture fictícia",
      currentLevel: "Não informado",
      startDate: "2026-11-16",
      cycleDurationWeeks: 1,
      weeklyFrequency: 3,
      availableWeekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"],
      environment: "ROAD",
      primaryUnit: "TIME",
      primaryIntensityMethod: "RPE",
    },
    weeks: [{
      id: "week-fictional-manual-entry",
      weekNumber: 1,
      startDate: "2026-11-16",
      endDate: "2026-11-22",
      phase: "Fixture fictícia",
      objective: "Fixture fictícia",
      weeklyGuidance: "Fixture fictícia",
      sessions: [],
    }],
  };
}

function runEntryClick(input: {
  readonly source: "MOUNT_MANUALLY" | "CONTINUE_MANUALLY";
  readonly sessionCount: number;
}) {
  let mode = "ASSISTED";
  let openRequests = 0;
  let scrollOptions: ScrollIntoViewOptions | undefined;
  let focusOptions: FocusOptions | undefined;
  const firstEditable = {
    focus: (options?: FocusOptions) => {
      focusOptions = options;
    },
  } as HTMLElement;
  const form = {
    open: false,
    scrollIntoView: (options?: ScrollIntoViewOptions) => {
      scrollOptions = options;
    },
    querySelector: () => firstEditable,
  };

  activateRunningManualEntry({
    ...input,
    activateManualMode: () => {
      mode = "MANUAL";
    },
    requestManualForm: () => {
      openRequests += 1;
      revealRunningManualSessionForm(form);
    },
  });

  return { mode, openRequests, form, scrollOptions, focusOptions };
}

test("Continuar manualmente ativa o modo, expande, rola e foca sem salvar", () => {
  const result = runEntryClick({
    source: "CONTINUE_MANUALLY",
    sessionCount: 2,
  });

  assert.equal(result.mode, "MANUAL");
  assert.equal(result.openRequests, 1);
  assert.equal(result.form.open, true);
  assert.deepEqual(result.scrollOptions, { behavior: "smooth", block: "start" });
  assert.deepEqual(result.focusOptions, { preventScroll: true });
});

test("Montar manualmente abre diretamente somente quando a fixture não possui sessões", () => {
  const empty = runEntryClick({ source: "MOUNT_MANUALLY", sessionCount: 0 });
  const existing = runEntryClick({ source: "MOUNT_MANUALLY", sessionCount: 2 });

  assert.equal(empty.mode, "MANUAL");
  assert.equal(empty.openRequests, 1);
  assert.equal(empty.form.open, true);
  assert.equal(existing.mode, "MANUAL");
  assert.equal(existing.openRequests, 0);
  assert.equal(existing.form.open, false);
});

test("formulário aberto mantém adicionar e cancelar sem criar sessão na renderização", () => {
  const fixture = emptyRunningFixture();
  let changeCount = 0;
  const html = renderToStaticMarkup(
    <RunningSessionEditor
      disabled={false}
      manualFormOpenRequest={1}
      onChange={() => {
        changeCount += 1;
      }}
      runningWeeklyFrequency={3}
      value={fixture}
    />,
  );

  assert.match(html, /Adicionar sessão manual/u);
  assert.match(html, /Adicionar com modelo/u);
  assert.match(html, /Adicionar do zero/u);
  assert.match(html, /Cancelar/u);
  assert.equal(changeCount, 0);
  assert.equal(fixture.weeks[0]?.sessions.length, 0);
});

test("Gerar semana assistida reabre a assistência e preserva a proposta anterior", () => {
  let mode = "MANUAL";
  let scope = "PERIOD";
  let revising = false;

  activateRunningAssistedGeneration({
    scope: "WEEK",
    hasProposal: true,
    activateAssistedMode: () => { mode = "ASSISTED"; },
    selectScope: (value) => { scope = value; },
    preserveAndReviseProposal: () => { revising = true; },
  });

  assert.equal(mode, "ASSISTED");
  assert.equal(scope, "WEEK");
  assert.equal(revising, true);
});

test("Gerar planejamento do período abre a assistência sem criar proposta", () => {
  let scope = "WEEK";
  let reviseRequests = 0;

  activateRunningAssistedGeneration({
    scope: "PERIOD",
    hasProposal: false,
    activateAssistedMode: () => undefined,
    selectScope: (value) => { scope = value; },
    preserveAndReviseProposal: () => { reviseRequests += 1; },
  });

  assert.equal(scope, "PERIOD");
  assert.equal(reviseRequests, 0);
});
