import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyAssistedWorkoutProposal,
  proposeAssistedWorkoutStructure,
  type AssistedWorkoutApplicationMode,
} from "./assisted-workout";
import type { ExerciseLibraryItemView } from "./exercise-library-contracts";
import { emptyWorkoutPlanDraft } from "./workout-record";

function idFactory() {
  let value = 10;
  return () =>
    `00000000-0000-4000-8000-${String(value++).padStart(12, "0")}`;
}

const library: readonly ExerciseLibraryItemView[] = [
  {
    id: "scientific-exercise-1",
    sourceKind: "SCIENTIFIC_LIBRARY",
    name: "Supino com halteres",
    category: "STRENGTH",
    muscleGroup: "Peitoral",
    equipment: "Halteres e banco",
    description: "Exercício para membros superiores.",
    executionInstructions: "Manter movimento controlado.",
    professionalNotes: "",
    active: true,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  },
  {
    id: "scientific-exercise-common",
    sourceKind: "SCIENTIFIC_LIBRARY",
    name: "Flexão de braços",
    category: "STRENGTH",
    muscleGroup: "Peitoral",
    equipment: "Peso corporal",
    description: "Exercício comum de academia.",
    executionInstructions: "Manter movimento controlado.",
    professionalNotes: "",
    active: true,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  },
  {
    id: "scientific-exercise-2",
    sourceKind: "SCIENTIFIC_LIBRARY",
    name: "Exercício inativo",
    category: "STRENGTH",
    muscleGroup: "Peitoral",
    equipment: "Halteres",
    description: "Não deve entrar na sugestão.",
    executionInstructions: "",
    professionalNotes: "",
    active: false,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  },
  {
    id: "scientific-exercise-machine",
    sourceKind: "SCIENTIFIC_LIBRARY",
    name: "Remada na máquina",
    category: "STRENGTH",
    muscleGroup: "Costas",
    equipment: "Máquina de remada",
    description: "Exercício em aparelho específico.",
    executionInstructions: "Manter movimento controlado.",
    professionalNotes: "",
    active: true,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  },
];

function proposal(
  existingSessionNames: readonly string[] = [],
  availableEquipment: readonly string[] = ["halteres", "banco"],
  weeklyFrequency = 2,
  applicationMode: AssistedWorkoutApplicationMode = "APPEND",
) {
  return proposeAssistedWorkoutStructure({
    context: {
      masterRecordId: "master-fictional",
      patientId: "patient-fictional",
      objective: "Força de membros superiores",
      trainingExperience: "Iniciante",
      practicedModalities: ["Musculação"],
      painAndLimitations: ["Evitar impacto no joelho"],
      physicalAssessments: [
        {
          assessmentId: "assessment-fictional",
          assessmentName: "Avaliação funcional",
          performedAt: "2026-11-01",
          evaluatedCapacity: "Força",
          resultSummary: "Avaliação fictícia",
          sourceRecordId: "record-fictional",
        },
      ],
    },
    contractedService: "STRENGTH_TRAINING",
    primaryModality: "Musculação",
    objective: "Força de membros superiores",
    trainingExperience: "Iniciante",
    weeklyFrequency,
    sessionDuration: "50 min",
    availableEquipment,
    exerciseLibrary: library,
    existingSessionNames,
    applicationMode,
    idFactory: idFactory(),
  });
}

test("sugestão assistida gera sessões editáveis com exercícios ativos e sem carga inventada", () => {
  const generated = proposal();

  assert.equal(generated.sessions.length, 2);
  assert.ok(generated.sessions.every((session) => session.exercises.length > 0));
  assert.ok(
    generated.sessions.every((session) =>
      session.observations.includes("Evitar impacto no joelho"),
    ),
  );
  for (const exercise of generated.sessions.flatMap((session) => session.exercises)) {
    assert.equal(exercise.libraryExerciseId, "scientific-exercise-1");
    assert.equal(exercise.load, "");
    assert.equal(exercise.loadUnit, "");
    assert.equal(exercise.sets, "2");
    assert.equal(exercise.requiredEquipment, "Halteres e banco");
  }
});

test("cancelar a prévia preserva integralmente o rascunho", () => {
  const draft = emptyWorkoutPlanDraft();
  const before = JSON.stringify(draft);

  proposal();

  assert.equal(JSON.stringify(draft), before);
  const workspaceSource = readFileSync(
    new URL(
      "../../components/performance-endurance/performance-workout-workspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(workspaceSource, /Cancelar sugestão/u);
  assert.match(workspaceSource, /setAssistedProposal\(undefined\)/u);
});

test("aplicar acrescenta a sugestão ao Construtor sem apagar sessões existentes", () => {
  const emptyDraft = emptyWorkoutPlanDraft();
  const existingSession = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Treino A",
    objective: "Treino existente",
    estimatedDuration: "40 min",
    observations: "Preservar",
    exercises: [],
  };
  const draft = { ...emptyDraft, sessions: [existingSession] };
  const generated = proposal([existingSession.name]);
  const applied = applyAssistedWorkoutProposal(draft, generated);

  assert.equal(applied.sessions.length, 3);
  assert.equal(applied.sessions[0], existingSession);
  assert.equal(applied.sessions[0].observations, "Preservar");
  assert.equal(applied.sessions[1].name, "Treino B");
  assert.ok(applied.sessions[1].exercises.length > 0);
  assert.match(
    applied.sessions[1].exercises[0]?.observations ?? "",
    /Equipamento previsto: Halteres e banco/u,
  );
  assert.equal(
    applyAssistedWorkoutProposal(applied, generated).sessions.length,
    3,
  );
});

test("com A e B existentes, frequência 5 diferencia acréscimo, nova ficha e cancelamento", () => {
  const emptyDraft = emptyWorkoutPlanDraft();
  const existingSessions = [
    {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Treino A",
      objective: "Sessão fictícia existente A",
      estimatedDuration: "40 min",
      observations: "Preservar A",
      exercises: [],
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      name: "Treino B",
      objective: "Sessão fictícia existente B",
      estimatedDuration: "40 min",
      observations: "Preservar B",
      exercises: [],
    },
  ];
  const draft = { ...emptyDraft, sessions: existingSessions };
  const beforePreview = JSON.stringify(draft);

  const appendProposal = proposal(
    existingSessions.map((session) => session.name),
    ["halteres", "banco"],
    5,
    "APPEND",
  );
  assert.deepEqual(
    appendProposal.sessions.map((session) => session.name),
    ["Treino C", "Treino D", "Treino E", "Treino F", "Treino G"],
  );
  assert.equal(appendProposal.existingSessionCount, 2);
  assert.equal(appendProposal.resultingSessionCount, 7);
  const appendedSessions = applyAssistedWorkoutProposal(
    draft,
    appendProposal,
  ).sessions;
  assert.deepEqual(appendedSessions.slice(0, 2), existingSessions);
  assert.deepEqual(
    appendedSessions.map((session) => session.name),
    [
      "Treino A",
      "Treino B",
      "Treino C",
      "Treino D",
      "Treino E",
      "Treino F",
      "Treino G",
    ],
  );
  assert.equal(
    new Set(appendedSessions.map((session) => session.id)).size,
    appendedSessions.length,
  );

  const replacementProposal = proposal(
    existingSessions.map((session) => session.name),
    ["halteres", "banco"],
    5,
    "REPLACE",
  );
  assert.deepEqual(
    replacementProposal.sessions.map((session) => session.name),
    ["Treino A", "Treino B", "Treino C", "Treino D", "Treino E"],
  );
  assert.equal(replacementProposal.existingSessionCount, 2);
  assert.equal(replacementProposal.resultingSessionCount, 5);
  assert.deepEqual(
    applyAssistedWorkoutProposal(draft, replacementProposal).sessions.map(
      (session) => session.name,
    ),
    ["Treino A", "Treino B", "Treino C", "Treino D", "Treino E"],
  );

  assert.equal(JSON.stringify(draft), beforePreview);
  assert.deepEqual(
    draft.sessions.map((session) => session.name),
    ["Treino A", "Treino B"],
  );
});

test("abrir, imprimir e fechar a prévia usa a proposta em memória sem alterar o rascunho", () => {
  const workspaceSource = readFileSync(
    new URL(
      "../../components/performance-endurance/performance-workout-workspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(workspaceSource, />\s*Prévia de impressão\s*</u);
  assert.match(workspaceSource, /setAssistedPrintPreviewOpen\(true\)/u);
  assert.match(
    workspaceSource,
    /draft: applyAssistedWorkoutProposal\(currentView\.draft, assistedProposal\)/u,
  );
  assert.match(workspaceSource, /documentStatus="Prévia — não finalizado"/u);
  assert.match(workspaceSource, /onClick=\{\(\) => window\.print\(\)\}/u);
  assert.match(workspaceSource, />\s*Imprimir \/ Salvar em PDF\s*</u);
  assert.match(
    workspaceSource,
    /onClick=\{\(\) => setAssistedPrintPreviewOpen\(false\)\}/u,
  );
  assert.match(workspaceSource, />\s*Voltar à sugestão\s*</u);

  const previewButtonIndex = workspaceSource.indexOf("Prévia de impressão");
  const cancelButtonIndex = workspaceSource.indexOf("Cancelar sugestão");
  const applyButtonIndex = workspaceSource.indexOf("Aplicar e substituir sessões");
  assert.ok(previewButtonIndex >= 0);
  assert.ok(cancelButtonIndex > previewButtonIndex);
  assert.ok(applyButtonIndex > cancelButtonIndex);
});

test("dados essenciais ausentes impedem sessões e identificam a pendência", () => {
  const generated = proposeAssistedWorkoutStructure({
    context: {
      masterRecordId: "master-fictional",
      patientId: "patient-fictional",
    },
    exerciseLibrary: library,
    idFactory: idFactory(),
  });

  assert.equal(generated.sessions.length, 0);
  assert.ok(generated.missingInformation.includes("Objetivo do paciente"));
  assert.ok(generated.missingInformation.includes("Experiência de treinamento"));
  assert.ok(
    generated.missingInformation.includes(
      "Frequência semanal — corrija em Estratégia e periodização",
    ),
  );
});

test("frequência corrente da estratégia define a quantidade de sessões", () => {
  const generated = proposal([], [], 3);

  assert.equal(generated.suggestedWeeklyFrequency, "3x por semana");
  assert.equal(generated.sessions.length, 3);

  const workspaceSource = readFileSync(
    new URL(
      "../../components/performance-endurance/performance-workout-workspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    workspaceSource,
    /weeklyFrequency: draft\.strategy\.weeklyFrequency/u,
  );
  assert.doesNotMatch(workspaceSource, /id="assisted-frequency"/u);
});

test("equipamentos em branco não bloqueiam e priorizam opções comuns", () => {
  const generated = proposal([], []);

  assert.equal(generated.sessions.length, 2);
  assert.equal(
    generated.sessions[0]?.exercises[0]?.requiredEquipment,
    "Peso corporal",
  );
  assert.equal(
    generated.sessions
      .flatMap((session) => session.exercises)
      .some((exercise) => exercise.requiredEquipment === "Máquina de remada"),
    false,
  );
  assert.equal(
    generated.missingInformation.some((item) =>
      item.toLocaleLowerCase("pt-BR").includes("equipamento"),
    ),
    false,
  );
});

test("equipamentos informados restringem a sugestão e avisam quando não há opção", () => {
  const filtered = proposal([], ["halteres"]);
  const incompatible = proposal([], ["equipamento inexistente"]);

  assert.ok(filtered.sessions.length > 0);
  assert.ok(
    filtered.sessions
      .flatMap((session) => session.exercises)
      .every((exercise) => exercise.requiredEquipment === "Halteres e banco"),
  );
  assert.equal(incompatible.sessions.length, 0);
  assert.ok(
    incompatible.missingInformation.some((item) =>
      item.includes("filtro de equipamento"),
    ),
  );
});
