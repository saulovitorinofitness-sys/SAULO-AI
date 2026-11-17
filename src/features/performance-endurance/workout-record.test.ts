import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LEGACY_TRAINING_METHOD_ALIASES,
  STANDARD_TRAINING_METHODS,
  buildWorkoutMethodGlossary,
  confirmWorkoutPlanningTransition,
  emptyWorkoutPlanDraft,
  parseStoredWorkoutPlanPayload,
  parseWorkoutPlanDraft,
  validateWorkoutPlanFinalization,
} from "./workout-record";
import type { ExerciseLibraryItemView } from "./exercise-library-contracts";
import { PROGRAM_FOCUS_OPTIONS } from "./workout-contracts";

const firstId = "00000000-0000-4000-8000-000000000001";
const secondId = "00000000-0000-4000-8000-000000000002";

function workoutDraftWithLibraryId(libraryExerciseId: string) {
  return {
    ...emptyWorkoutPlanDraft(),
    sessions: [
      {
        id: firstId,
        name: "Treino A",
        objective: "Força",
        estimatedDuration: "60 min",
        observations: "",
        exercises: [
          {
            id: secondId,
            order: 1,
            name: "Agachamento livre",
            libraryExerciseId,
            libraryExerciseSource: "SCIENTIFIC_LIBRARY",
            prescription: "",
            sets: "3",
            repetitions: "8-10",
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
          },
        ],
      },
    ],
  };
}

function workoutDraftWithMethod(
  methodId: string,
  customMethods = emptyWorkoutPlanDraft().customMethods,
) {
  const draft = workoutDraftWithLibraryId(secondId);
  return {
    ...draft,
    customMethods,
    sessions: draft.sessions.map((session) => ({
      ...session,
      exercises: session.exercises.map((exercise) => ({
        ...exercise,
        methodId,
      })),
    })),
  };
}

const customTrainingMethod = {
  id: "custom-00000000-0000-4000-8000-000000000003",
  name: "Método personalizado",
  studentExplanation: "Explicação personalizada.",
  executionInstruction: "Execução personalizada.",
  objective: "Objetivo personalizado.",
  professionalObservation: "Observação personalizada.",
  custom: true,
} as const;

const validBaseProtocol = {
  protocolId: "scientific-protocol-training-1",
  protocolName: "Protocolo de força para iniciantes",
  source: "SCIENTIFIC_LIBRARY",
  version: "1.0",
  area: "PERFORMANCE",
  professionalNotes: "Adaptar progressão conforme resposta ao treino.",
} as const;

const validTrainingDay = {
  weekday: "MONDAY",
  weeklyOrder: 1,
  sessionName: "Treino A",
  primaryFocus: "Força",
  prioritizedGroupsOrCapacities: ["Membros inferiores"],
  sessionId: firstId,
  kind: "TRAINING",
  observations: "Priorizar técnica.",
} as const;

const validRestDay = {
  weekday: "TUESDAY",
  weeklyOrder: 2,
  sessionName: "",
  primaryFocus: "Descanso",
  prioritizedGroupsOrCapacities: [],
  kind: "REST",
} as const;

test("aceita UUID e IDs estáveis da Biblioteca Científica", () => {
  for (const libraryExerciseId of [
    secondId,
    "scientific-exercise-1",
    "scientific-exercise-83",
  ]) {
    const parsed = parseWorkoutPlanDraft(
      workoutDraftWithLibraryId(libraryExerciseId),
    );

    assert.ok(parsed);
    assert.equal(
      parsed.sessions[0].exercises[0].libraryExerciseId,
      libraryExerciseId,
    );
  }
});

test("rejeita IDs incompletos, alfabéticos ou arbitrários", () => {
  for (const libraryExerciseId of [
    "scientific-exercise-",
    "scientific-exercise-abc",
    "identificador-aleatorio",
  ]) {
    assert.equal(
      parseWorkoutPlanDraft(workoutDraftWithLibraryId(libraryExerciseId)),
      null,
    );
  }
});

test("preserva o ID científico ao validar, serializar e reabrir o registro", () => {
  const libraryExerciseId = "scientific-exercise-83";
  const libraryExercise: ExerciseLibraryItemView = {
    id: libraryExerciseId,
    sourceKind: "SCIENTIFIC_LIBRARY",
    name: "Agachamento livre",
    category: "STRENGTH",
    muscleGroup: "Membros inferiores",
    equipment: "Barra",
    description: "",
    executionInstructions: "",
    professionalNotes: "",
    active: true,
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
  };
  const parsed = parseWorkoutPlanDraft(
    workoutDraftWithLibraryId(libraryExerciseId),
  );

  assert.ok(parsed);
  assert.deepEqual(
    validateWorkoutPlanFinalization(parsed, [libraryExercise]),
    [],
  );

  const serialized = JSON.stringify({
    ...parsed,
    schemaVersion: 1,
    status: "DRAFT",
    methodGlossary: [],
  });
  const reopened = parseStoredWorkoutPlanPayload(JSON.parse(serialized));

  assert.ok(reopened);
  assert.equal(
    reopened.sessions[0].exercises[0].libraryExerciseId,
    libraryExerciseId,
  );
  assert.equal(serialized.includes(libraryExerciseId), true);
  assert.equal(
    reopened.sessions[0].exercises[0].libraryExerciseId?.includes("-4000-"),
    false,
  );
});

test("expõe exatamente 39 métodos científicos com IDs e nomes únicos", () => {
  const ids = STANDARD_TRAINING_METHODS.map((method) => method.id);
  const normalizedNames = STANDARD_TRAINING_METHODS.map((method) =>
    method.name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
      .toLocaleLowerCase("pt-BR"),
  );

  assert.equal(STANDARD_TRAINING_METHODS.length, 39);
  assert.equal(new Set(ids).size, 39);
  assert.equal(new Set(normalizedNames).size, 39);
});

test("preserva o ID científico oficial ao selecionar, salvar e reabrir um plano novo", () => {
  const officialMethod = STANDARD_TRAINING_METHODS.at(-1);
  assert.ok(officialMethod);

  const parsed = parseWorkoutPlanDraft(
    workoutDraftWithMethod(officialMethod.id),
  );
  assert.ok(parsed);

  const serialized = JSON.stringify({
    ...parsed,
    schemaVersion: 1,
    status: "DRAFT",
    methodGlossary: buildWorkoutMethodGlossary(parsed),
  });
  const reopened = parseStoredWorkoutPlanPayload(JSON.parse(serialized));

  assert.ok(reopened);
  assert.equal(
    reopened.sessions[0].exercises[0].methodId,
    officialMethod.id,
  );
  assert.equal(reopened.methodGlossary[0]?.methodId, officialMethod.id);
  assert.equal(reopened.methodGlossary[0]?.name, officialMethod.name);
});

test("aceita e resolve todos os 18 aliases legados sem alterar o ID histórico", () => {
  const methodsById = new Map(
    STANDARD_TRAINING_METHODS.map((method) => [method.id, method]),
  );
  const aliases = Object.entries(LEGACY_TRAINING_METHOD_ALIASES);

  assert.equal(aliases.length, 18);
  assert.equal(LEGACY_TRAINING_METHOD_ALIASES.traditional, "training-method-1");
  assert.equal(LEGACY_TRAINING_METHOD_ALIASES["drop-set"], "training-method-5");

  for (const [legacyId, officialId] of aliases) {
    const parsed = parseWorkoutPlanDraft(workoutDraftWithMethod(legacyId));
    assert.ok(parsed, `Alias legado rejeitado: ${legacyId}`);
    assert.equal(parsed.sessions[0].exercises[0].methodId, legacyId);

    const glossary = buildWorkoutMethodGlossary(parsed);
    assert.equal(glossary.length, 1);
    assert.equal(glossary[0]?.methodId, legacyId);
    assert.equal(glossary[0]?.name, methodsById.get(officialId)?.name);
  }
});

test("reabre plano antigo com alias sem migrar silenciosamente o registro", () => {
  const parsed = parseWorkoutPlanDraft(workoutDraftWithMethod("traditional"));
  assert.ok(parsed);

  const reopened = parseStoredWorkoutPlanPayload(
    JSON.parse(JSON.stringify({
      ...parsed,
      schemaVersion: 1,
      status: "FINALIZED",
      methodGlossary: [],
    })),
  );

  assert.ok(reopened);
  assert.equal(reopened.sessions[0].exercises[0].methodId, "traditional");
  assert.equal(reopened.methodGlossary[0]?.methodId, "traditional");
  assert.equal(reopened.methodGlossary[0]?.name, "Séries tradicionais");
});

test("rejeita método desconhecido e aceita método personalizado custom-*", () => {
  assert.equal(
    parseWorkoutPlanDraft(workoutDraftWithMethod("unknown-method")),
    null,
  );

  const parsed = parseWorkoutPlanDraft(
    workoutDraftWithMethod(customTrainingMethod.id, [customTrainingMethod]),
  );
  assert.ok(parsed);
  assert.equal(
    parsed.sessions[0].exercises[0].methodId,
    customTrainingMethod.id,
  );
});

test("rejeita personalizado com nome normalizado igual ao científico", () => {
  const duplicateName = {
    ...customTrainingMethod,
    name: "  SERIES TRADICIONAIS  ",
  };

  assert.equal(
    parseWorkoutPlanDraft(
      workoutDraftWithMethod(duplicateName.id, [duplicateName]),
    ),
    null,
  );
});

test("glossário reconhece método oficial, alias antigo e personalizado", () => {
  const officialMethod = STANDARD_TRAINING_METHODS.find(
    (method) => method.id === "training-method-39",
  );
  assert.ok(officialMethod);

  const draft = workoutDraftWithMethod(officialMethod.id, [customTrainingMethod]);
  const parsed = parseWorkoutPlanDraft({
    ...draft,
    sessions: draft.sessions.map((session) => ({
      ...session,
      exercises: [
        session.exercises[0],
        { ...session.exercises[0], id: firstId, order: 2, methodId: "drop-set" },
        {
          ...session.exercises[0],
          id: "00000000-0000-4000-8000-000000000004",
          order: 3,
          methodId: customTrainingMethod.id,
        },
      ],
    })),
  });
  assert.ok(parsed);

  const glossary = buildWorkoutMethodGlossary(parsed);
  assert.equal(glossary.length, 3);
  assert.deepEqual(
    glossary.map((method) => method.methodId),
    [officialMethod.id, "drop-set", customTrainingMethod.id],
  );
  assert.deepEqual(
    glossary.map((method) => method.name),
    [officialMethod.name, "Drop-set", customTrainingMethod.name],
  );
});

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
        estimatedDuration: "",
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
            loadUnit: "",
            rir: "",
            rpe: "",
            intensityType: "",
            intensityValue: "",
            restInterval: "",
            cadence: "",
            rangeOfMotion: "",
            methodId: "drop-set",
            observations: "",
            patientInstructions: "",
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
            loadUnit: "",
            rir: "2",
            rpe: "",
            intensityType: "RIR",
            intensityValue: "2",
            restInterval: "",
            cadence: "",
            rangeOfMotion: "",
            methodId: "drop-set",
            observations: "",
            patientInstructions: "",
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

test("reabre payload anterior preenchendo novos campos sem perder intensidade", () => {
  const stored = parseStoredWorkoutPlanPayload({
    ...emptyWorkoutPlanDraft(),
    sessions: [
      {
        id: firstId,
        name: "Treino A",
        objective: "Força",
        observations: "Manter técnica",
        exercises: [
          {
            id: secondId,
            order: 1,
            name: "Agachamento",
            prescription: "",
            sets: "3",
            repetitions: "8",
            load: "40",
            intensityType: "RIR",
            intensityValue: "2",
            restInterval: "90 s",
            cadence: "3-1-1",
            rangeOfMotion: "Completa",
            methodId: "traditional",
            observations: "",
            substituteExercise: "",
          },
        ],
      },
    ],
    schemaVersion: 1,
    status: "DRAFT",
    methodGlossary: [],
  });

  assert.ok(stored);
  assert.equal(stored.sessions[0].estimatedDuration, "");
  assert.equal(stored.sessions[0].exercises[0].loadUnit, "");
  assert.equal(stored.sessions[0].exercises[0].rir, "2");
  assert.equal(stored.sessions[0].exercises[0].rpe, "");
  assert.equal(stored.sessions[0].exercises[0].patientInstructions, "");
});

test("finaliza com essenciais e mantém parâmetros opcionais", () => {
  const libraryExercise: ExerciseLibraryItemView = {
    id: secondId,
    sourceKind: "SCIENTIFIC_LIBRARY",
    name: "Agachamento",
    category: "STRENGTH",
    muscleGroup: "Membros inferiores",
    equipment: "Barra",
    description: "",
    executionInstructions: "",
    professionalNotes: "",
    active: true,
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
  };
  const draft = parseWorkoutPlanDraft({
    ...emptyWorkoutPlanDraft(),
    sessions: [
      {
        id: firstId,
        name: "Treino A",
        objective: "Força",
        estimatedDuration: "60 min",
        observations: "",
        exercises: [
          {
            id: secondId,
            order: 1,
            name: libraryExercise.name,
            libraryExerciseId: libraryExercise.id,
            libraryExerciseSource: libraryExercise.sourceKind,
            prescription: "",
            sets: "3",
            repetitions: "8-10",
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
          },
        ],
      },
    ],
  });

  assert.ok(draft);
  assert.deepEqual(validateWorkoutPlanFinalization(draft, [libraryExercise]), []);
  const reopened = parseStoredWorkoutPlanPayload({
    ...draft,
    schemaVersion: 1,
    status: "DRAFT",
    methodGlossary: [],
  });
  assert.ok(reopened);
  assert.equal(reopened.sessions[0].estimatedDuration, "60 min");
  assert.equal(
    reopened.sessions[0].exercises[0].libraryExerciseId,
    libraryExercise.id,
  );
  assert.equal(
    reopened.sessions[0].exercises[0].libraryExerciseSource,
    "SCIENTIFIC_LIBRARY",
  );
  assert.equal(
    validateWorkoutPlanFinalization({ ...draft, sessions: [] }, [libraryExercise])[0]?.path,
    "sessions",
  );
  const legacyReferenceDraft = {
    ...draft,
    sessions: draft.sessions.map((session) => ({
      ...session,
      exercises: session.exercises.map((exercise) => ({
        ...exercise,
        libraryExerciseSource: undefined,
      })),
    })),
  };
  assert.deepEqual(
    validateWorkoutPlanFinalization(legacyReferenceDraft, [
      { ...libraryExercise, sourceKind: "LEGACY_EXERCISE_LIBRARY" },
    ]),
    [],
  );
  assert.match(
    validateWorkoutPlanFinalization(
      {
        ...draft,
        sessions: [
          {
            ...draft.sessions[0],
            exercises: [{ ...draft.sessions[0].exercises[0], sets: "" }],
          },
        ],
      },
      [libraryExercise],
    )[0]?.message ?? "",
    /séries/i,
  );
});

test("mantém válido o plano antigo sem protocolo e divisão semanal", () => {
  const legacyDraft = emptyWorkoutPlanDraft();
  const parsed = parseWorkoutPlanDraft(legacyDraft);

  assert.ok(parsed);
  assert.equal(parsed.strategy.baseProtocol, undefined);
  assert.equal(parsed.strategy.weeklyDivision, undefined);
});

test("aceita protocolo científico válido", () => {
  const parsed = parseWorkoutPlanDraft({
    ...emptyWorkoutPlanDraft(),
    strategy: {
      ...emptyWorkoutPlanDraft().strategy,
      baseProtocol: validBaseProtocol,
    },
  });

  assert.ok(parsed);
  assert.deepEqual(parsed.strategy.baseProtocol, validBaseProtocol);
});

test("rejeita protocolo com ID, nome, origem ou área inválidos", () => {
  const invalidProtocols = [
    { ...validBaseProtocol, protocolId: "scientific-protocol-training-0" },
    { ...validBaseProtocol, protocolName: " " },
    { ...validBaseProtocol, source: "LEGACY_LIBRARY" },
    { ...validBaseProtocol, area: "NUTRITION" },
  ];

  for (const baseProtocol of invalidProtocols) {
    assert.equal(
      parseWorkoutPlanDraft({
        ...emptyWorkoutPlanDraft(),
        strategy: { ...emptyWorkoutPlanDraft().strategy, baseProtocol },
      }),
      null,
    );
  }
});

test("aceita divisão semanal válida com treino e descanso", () => {
  const draft = workoutDraftWithLibraryId(secondId);
  const parsed = parseWorkoutPlanDraft({
    ...draft,
    strategy: {
      ...draft.strategy,
      weeklyDivision: [validTrainingDay, validRestDay],
    },
  });

  assert.ok(parsed);
  assert.equal(parsed.strategy.weeklyDivision?.length, 2);
  assert.equal(parsed.strategy.weeklyDivision?.[0].kind, "TRAINING");
  assert.equal(parsed.strategy.weeklyDivision?.[1].kind, "REST");
});

test("não exige sessionId no dia de descanso", () => {
  const parsed = parseWorkoutPlanDraft({
    ...emptyWorkoutPlanDraft(),
    strategy: {
      ...emptyWorkoutPlanDraft().strategy,
      weeklyDivision: [validRestDay],
    },
  });

  assert.ok(parsed);
  assert.equal(parsed.strategy.weeklyDivision?.[0].sessionId, undefined);
});

test("aceita dia de treino que referencia sessão existente", () => {
  const draft = workoutDraftWithLibraryId(secondId);
  const parsed = parseWorkoutPlanDraft({
    ...draft,
    strategy: {
      ...draft.strategy,
      weeklyDivision: [validTrainingDay],
    },
  });

  assert.ok(parsed);
  assert.equal(parsed.strategy.weeklyDivision?.[0].sessionId, firstId);
  assert.equal(parsed.sessions[0].id, firstId);
});

test("rejeita ordem semanal duplicada", () => {
  const draft = workoutDraftWithLibraryId(secondId);

  assert.equal(
    parseWorkoutPlanDraft({
      ...draft,
      strategy: {
        ...draft.strategy,
        weeklyDivision: [
          validTrainingDay,
          { ...validRestDay, weeklyOrder: validTrainingDay.weeklyOrder },
        ],
      },
    }),
    null,
  );
});

test("rejeita combinação conflitante de treino sem nome de sessão", () => {
  const draft = workoutDraftWithLibraryId(secondId);

  assert.equal(
    parseWorkoutPlanDraft({
      ...draft,
      strategy: {
        ...draft.strategy,
        weeklyDivision: [{ ...validTrainingDay, sessionName: " " }],
      },
    }),
    null,
  );
});

test("rejeita referência a sessão inexistente", () => {
  const draft = workoutDraftWithLibraryId(secondId);

  assert.equal(
    parseWorkoutPlanDraft({
      ...draft,
      strategy: {
        ...draft.strategy,
        weeklyDivision: [
          { ...validTrainingDay, sessionId: secondId },
        ],
      },
    }),
    null,
  );
});

test("preserva protocolo e divisão semanal ao serializar e reabrir", () => {
  const draft = workoutDraftWithLibraryId("scientific-exercise-83");
  const parsed = parseWorkoutPlanDraft({
    ...draft,
    strategy: {
      ...draft.strategy,
      baseProtocol: validBaseProtocol,
      weeklyDivision: [validTrainingDay, validRestDay],
    },
  });

  assert.ok(parsed);
  const serialized = JSON.stringify({
    ...parsed,
    schemaVersion: 1,
    status: "DRAFT",
    methodGlossary: [],
  });
  const reopened = parseStoredWorkoutPlanPayload(JSON.parse(serialized));

  assert.ok(reopened);
  assert.deepEqual(reopened.strategy.baseProtocol, validBaseProtocol);
  assert.deepEqual(reopened.strategy.weeklyDivision, [
    validTrainingDay,
    validRestDay,
  ]);
  assert.equal(
    reopened.sessions[0].exercises[0].libraryExerciseId,
    "scientific-exercise-83",
  );
});

test("preserva, limpa e aceita ausência da próxima fase planejada", () => {
  const emptyDraft = emptyWorkoutPlanDraft();
  const selected = parseWorkoutPlanDraft({
    ...emptyDraft,
    strategy: {
      ...emptyDraft.strategy,
      nextPhase: "Desenvolvimento",
    },
  });
  assert.ok(selected);

  const reopenedSelected = parseStoredWorkoutPlanPayload(
    JSON.parse(
      JSON.stringify({
        ...selected,
        schemaVersion: 1,
        status: "DRAFT",
        methodGlossary: [],
      }),
    ),
  );
  assert.equal(reopenedSelected?.strategy.nextPhase, "Desenvolvimento");

  const cleared = parseWorkoutPlanDraft({
    ...selected,
    strategy: { ...selected.strategy, nextPhase: "" },
  });
  assert.ok(cleared);
  const reopenedCleared = parseStoredWorkoutPlanPayload({
    ...cleared,
    schemaVersion: 1,
    status: "DRAFT",
    methodGlossary: [],
  });
  assert.equal(reopenedCleared?.strategy.nextPhase, "");

  const workspaceSource = readFileSync(
    new URL(
      "../../components/performance-endurance/performance-workout-workspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(workspaceSource, /<option value="">\{NOT_INFORMED\}<\/option>/u);
  assert.match(workspaceSource, /value=\{draft\.strategy\.nextPhase \?\? ""\}/u);

  const legacy = parseStoredWorkoutPlanPayload({
    ...emptyDraft,
    schemaVersion: 1,
    status: "DRAFT",
    methodGlossary: [],
  });
  assert.ok(legacy);
  assert.equal(legacy.strategy.nextPhase, undefined);
});

test("preserva, limpa e aceita ausência dos focos da periodização", () => {
  assert.ok(PROGRAM_FOCUS_OPTIONS.includes("Força"));
  assert.ok(PROGRAM_FOCUS_OPTIONS.includes("Hipertrofia"));
  assert.ok(PROGRAM_FOCUS_OPTIONS.includes("Resistência muscular"));
  assert.ok(PROGRAM_FOCUS_OPTIONS.includes("Recuperação / regenerativo"));
  assert.ok(PROGRAM_FOCUS_OPTIONS.includes("Velocidade"));

  const emptyDraft = emptyWorkoutPlanDraft();
  const selected = parseWorkoutPlanDraft({
    ...emptyDraft,
    strategy: {
      ...emptyDraft.strategy,
      currentFocus: "Força",
      nextFocus: "Hipertrofia",
    },
  });
  assert.ok(selected);

  const reopenedSelected = parseStoredWorkoutPlanPayload(
    JSON.parse(
      JSON.stringify({
        ...selected,
        schemaVersion: 1,
        status: "DRAFT",
        methodGlossary: [],
      }),
    ),
  );
  assert.equal(reopenedSelected?.strategy.currentFocus, "Força");
  assert.equal(reopenedSelected?.strategy.nextFocus, "Hipertrofia");

  const cleared = parseWorkoutPlanDraft({
    ...selected,
    strategy: {
      ...selected.strategy,
      currentFocus: "",
      nextFocus: "",
    },
  });
  assert.ok(cleared);
  const reopenedCleared = parseStoredWorkoutPlanPayload({
    ...cleared,
    schemaVersion: 1,
    status: "DRAFT",
    methodGlossary: [],
  });
  assert.equal(reopenedCleared?.strategy.currentFocus, "");
  assert.equal(reopenedCleared?.strategy.nextFocus, "");

  const workspaceSource = readFileSync(
    new URL(
      "../../components/performance-endurance/performance-workout-workspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(workspaceSource, /label="Foco atual"/u);
  assert.match(workspaceSource, /label="Próximo foco"/u);
  assert.match(
    workspaceSource,
    /Agora: \{draft\.strategy\.currentFocus\?\.trim\(\) \|\| NOT_INFORMED\}/u,
  );
  assert.match(
    workspaceSource,
    /\{draft\.strategy\.nextFocus\?\.trim\(\) \|\| NOT_INFORMED\}/u,
  );
  assert.match(workspaceSource, /Polimento \(pré-prova\)/u);

  const legacy = parseStoredWorkoutPlanPayload({
    ...emptyDraft,
    schemaVersion: 1,
    status: "DRAFT",
    methodGlossary: [],
  });
  assert.ok(legacy);
  assert.equal(legacy.strategy.currentFocus, undefined);
  assert.equal(legacy.strategy.nextFocus, undefined);
});

test("confirma transição de planejamento sem gerar histórico implícito ou duplicado", () => {
  const emptyDraft = emptyWorkoutPlanDraft();
  const planned = parseWorkoutPlanDraft({
    ...emptyDraft,
    strategy: {
      ...emptyDraft.strategy,
      currentPhase: "Adaptação",
      currentFocus: "Força",
      nextPhase: "Desenvolvimento",
      nextFocus: "Hipertrofia",
    },
  });
  assert.ok(planned);

  const ordinaryDraftSave = parseStoredWorkoutPlanPayload({
    ...planned,
    schemaVersion: 1,
    status: "DRAFT",
    methodGlossary: [],
  });
  assert.ok(ordinaryDraftSave);
  assert.equal(ordinaryDraftSave.strategy.transitions, undefined);

  const transitioned = confirmWorkoutPlanningTransition(planned, {
    effectiveDate: "2026-11-10",
    recordedAt: "2026-11-07T15:30:00.000Z",
  });
  assert.equal(transitioned.strategy.currentPhase, "Desenvolvimento");
  assert.equal(transitioned.strategy.currentFocus, "Hipertrofia");
  assert.equal(transitioned.strategy.nextPhase, "");
  assert.equal(transitioned.strategy.nextFocus, "");
  assert.deepEqual(transitioned.strategy.transitions, [
    {
      effectiveDate: "2026-11-10",
      recordedAt: "2026-11-07T15:30:00.000Z",
      phaseBefore: "Adaptação",
      phaseAfter: "Desenvolvimento",
      focusBefore: "Força",
      focusAfter: "Hipertrofia",
    },
  ]);

  const reopened = parseStoredWorkoutPlanPayload(
    JSON.parse(
      JSON.stringify({
        ...transitioned,
        schemaVersion: 1,
        status: "DRAFT",
        methodGlossary: [],
      }),
    ),
  );
  assert.ok(reopened);
  assert.deepEqual(reopened.strategy.transitions, transitioned.strategy.transitions);

  const repeated = confirmWorkoutPlanningTransition(transitioned, {
    effectiveDate: "2026-11-10",
    recordedAt: "2026-11-07T15:31:00.000Z",
  });
  assert.equal(repeated, transitioned);
  assert.equal(repeated.strategy.transitions?.length, 1);

  const replayedRequest = confirmWorkoutPlanningTransition(
    {
      ...planned,
      strategy: {
        ...planned.strategy,
        transitions: transitioned.strategy.transitions,
      },
    },
    {
      effectiveDate: "2026-11-10",
      recordedAt: "2026-11-07T15:32:00.000Z",
    },
  );
  assert.equal(replayedRequest.strategy.transitions?.length, 1);

  const legacy = parseStoredWorkoutPlanPayload({
    ...emptyDraft,
    schemaVersion: 1,
    status: "DRAFT",
    methodGlossary: [],
  });
  assert.ok(legacy);
  assert.equal(legacy.strategy.transitions, undefined);

  const workspaceSource = readFileSync(
    new URL(
      "../../components/performance-endurance/performance-workout-workspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(workspaceSource, /Confirmar mudança de fase/u);
  assert.match(workspaceSource, /label="Data efetiva"/u);
  assert.match(workspaceSource, /onClick=\{cancelPlanningTransitionConfirmation\}/u);
  assert.match(workspaceSource, /Nenhuma mudança de fase registrada/u);
});
