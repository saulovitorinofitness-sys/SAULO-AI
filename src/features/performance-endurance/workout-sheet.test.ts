import assert from "node:assert/strict";
import test from "node:test";

import type { WorkoutExercise, WorkoutSession } from "./workout-contracts";
import { emptyWorkoutPlanDraft } from "./workout-record";
import { workoutSheetReducer } from "./workout-sheet";

const sessionId = "00000000-0000-4000-8000-000000000010";
const firstExerciseId = "00000000-0000-4000-8000-000000000011";
const secondExerciseId = "00000000-0000-4000-8000-000000000012";

function session(): WorkoutSession {
  return {
    id: sessionId,
    name: "Treino A",
    objective: "",
    estimatedDuration: "",
    observations: "",
    exercises: [],
  };
}

function exercise(id: string, name: string): WorkoutExercise {
  return {
    id,
    order: 1,
    name,
    libraryExerciseId: id,
    prescription: "",
    sets: "",
    repetitions: "",
    load: "",
    loadUnit: "",
    rir: "",
    rpe: "",
    intensityType: "",
    intensityValue: "",
    restInterval: "",
    cadence: "",
    rangeOfMotion: "",
    methodId: "",
    observations: "",
    patientInstructions: "",
    substituteExercise: "",
  };
}

test("cria e renomeia sessão com objetivo, duração e observação", () => {
  let draft = workoutSheetReducer(emptyWorkoutPlanDraft(), {
    type: "ADD_SESSION",
    session: session(),
  });
  draft = workoutSheetReducer(draft, {
    type: "UPDATE_SESSION",
    sessionId,
    change: {
      name: "Treino Inferiores",
      objective: "Hipertrofia",
      estimatedDuration: "55 min",
      observations: "Aquecimento específico",
    },
  });

  assert.equal(draft.sessions.length, 1);
  assert.deepEqual(
    {
      name: draft.sessions[0].name,
      objective: draft.sessions[0].objective,
      estimatedDuration: draft.sessions[0].estimatedDuration,
      observations: draft.sessions[0].observations,
    },
    {
      name: "Treino Inferiores",
      objective: "Hipertrofia",
      estimatedDuration: "55 min",
      observations: "Aquecimento específico",
    },
  );
});

test("edita, reordena e remove exercícios referenciados da biblioteca", () => {
  let draft = workoutSheetReducer(emptyWorkoutPlanDraft(), {
    type: "ADD_SESSION",
    session: session(),
  });
  draft = workoutSheetReducer(draft, {
    type: "ADD_EXERCISE",
    sessionId,
    exercise: exercise(firstExerciseId, "Agachamento"),
  });
  draft = workoutSheetReducer(draft, {
    type: "ADD_EXERCISE",
    sessionId,
    exercise: exercise(secondExerciseId, "Leg press"),
  });
  draft = workoutSheetReducer(draft, {
    type: "UPDATE_EXERCISE",
    sessionId,
    exerciseId: firstExerciseId,
    change: {
      sets: "4",
      repetitions: "8-10",
      load: "60",
      loadUnit: "kg",
      restInterval: "90 s",
      rir: "2",
      rpe: "8",
      methodId: "traditional",
      cadence: "3-1-1",
      observations: "Monitorar amplitude",
      patientInstructions: "Manter os pés apoiados",
    },
  });

  const edited = draft.sessions[0].exercises[0];
  assert.equal(edited.libraryExerciseId, firstExerciseId);
  assert.deepEqual(
    [edited.sets, edited.repetitions, edited.load, edited.loadUnit, edited.restInterval],
    ["4", "8-10", "60", "kg", "90 s"],
  );
  assert.deepEqual(
    [edited.rir, edited.rpe, edited.methodId, edited.cadence],
    ["2", "8", "traditional", "3-1-1"],
  );
  assert.equal(edited.observations, "Monitorar amplitude");
  assert.equal(edited.patientInstructions, "Manter os pés apoiados");

  draft = workoutSheetReducer(draft, {
    type: "MOVE_EXERCISE",
    sessionId,
    exerciseId: secondExerciseId,
    direction: -1,
  });
  assert.deepEqual(
    draft.sessions[0].exercises.map((item) => [item.name, item.order]),
    [["Leg press", 1], ["Agachamento", 2]],
  );

  draft = workoutSheetReducer(draft, {
    type: "REMOVE_EXERCISE",
    sessionId,
    exerciseId: secondExerciseId,
  });
  assert.deepEqual(
    draft.sessions[0].exercises.map((item) => [item.name, item.order]),
    [["Agachamento", 1]],
  );
});
