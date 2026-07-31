import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWorkoutMethodGlossary,
  emptyWorkoutPlanDraft,
  parseStoredWorkoutPlanPayload,
  parseWorkoutPlanDraft,
} from "./workout-record";

const firstId = "00000000-0000-4000-8000-000000000001";
const secondId = "00000000-0000-4000-8000-000000000002";

test("mantém o modo livre como caminho inicial e aceita rascunho incompleto", () => {
  const draft = emptyWorkoutPlanDraft();

  assert.equal(draft.startMode, "FREE");
  assert.deepEqual(parseWorkoutPlanDraft(draft), draft);
});

test("gera glossário somente com métodos usados e sem repetição", () => {
  const draft = {
    ...emptyWorkoutPlanDraft(),
    sessions: [
      {
        id: firstId,
        name: "Treino A",
        objective: "",
        observations: "",
        exercises: [
          {
            id: secondId,
            order: 1,
            name: "Agachamento",
            prescription: "4 × 8–12",
            sets: "",
            repetitions: "",
            load: "",
            intensityType: "",
            intensityValue: "",
            restInterval: "",
            cadence: "",
            rangeOfMotion: "",
            methodId: "drop-set",
            observations: "",
            substituteExercise: "",
          },
          {
            id: firstId,
            order: 2,
            name: "Leg press",
            prescription: "",
            sets: "3",
            repetitions: "10",
            load: "",
            intensityType: "RIR",
            intensityValue: "2",
            restInterval: "",
            cadence: "",
            rangeOfMotion: "",
            methodId: "drop-set",
            observations: "",
            substituteExercise: "",
          },
        ],
      },
    ],
  } as const;

  const glossary = buildWorkoutMethodGlossary(draft);

  assert.equal(glossary.length, 1);
  assert.equal(glossary[0]?.methodId, "drop-set");
});

test("reconstrói o registro persistido e recalcula o glossário", () => {
  const draft = emptyWorkoutPlanDraft();
  const stored = parseStoredWorkoutPlanPayload({
    ...draft,
    schemaVersion: 1,
    status: "DRAFT",
    methodGlossary: [{ methodId: "registro-obsoleto" }],
  });

  assert.ok(stored);
  assert.equal(stored.status, "DRAFT");
  assert.deepEqual(stored.methodGlossary, []);
});
