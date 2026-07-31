import { z } from "zod";

import {
  PERFORMANCE_SERVICE_OPTIONS,
  WORKOUT_START_MODES,
  type StoredWorkoutPlanPayload,
  type TrainingMethodDefinition,
  type WorkoutMethodGlossaryEntry,
  type WorkoutPlanDraft,
} from "./workout-contracts";

const text = z.string().max(5_000);
const shortText = z.string().max(500);
const optionalPositiveInteger = z.number().int().positive().max(365).optional();

const activitySchema = z.object({
  id: z.string().uuid(),
  name: shortText,
  supervision: z.enum(["PROFESSIONAL", "SELF_DIRECTED", ""]),
});
const cycleSchema = z.object({
  id: z.string().uuid(),
  level: z.enum(["MACROCYCLE", "MESOCYCLE", "MICROCYCLE"]),
  name: shortText,
  startDate: z.string().max(10),
  endDate: z.string().max(10),
  objective: text,
  observations: text,
});
const methodSchema = z.object({
  id: z.string().min(1).max(200),
  name: shortText,
  studentExplanation: text,
  executionInstruction: text,
  objective: text,
  professionalObservation: text,
  custom: z.boolean(),
});
const exerciseSchema = z.object({
  id: z.string().uuid(),
  order: z.number().int().positive(),
  name: shortText,
  libraryExerciseId: z.string().uuid().optional(),
  prescription: shortText,
  sets: shortText,
  repetitions: shortText,
  load: shortText,
  intensityType: z.enum(["", "PERCENT_1RM", "RPE", "RIR"]),
  intensityValue: shortText,
  restInterval: shortText,
  cadence: shortText,
  rangeOfMotion: shortText,
  methodId: z.string().max(200),
  observations: text,
  substituteExercise: shortText,
});
const sessionSchema = z.object({
  id: z.string().uuid(),
  name: shortText,
  objective: text,
  observations: text,
  exercises: z.array(exerciseSchema).max(200),
});

export const workoutPlanDraftSchema = z.object({
  service: z.object({
    contractedService: z.enum(PERFORMANCE_SERVICE_OPTIONS).optional(),
    planType: shortText,
    trainingObjective: text,
    primaryModality: shortText,
    otherActivities: z.array(activitySchema).max(30),
  }),
  valences: z.array(shortText).max(50),
  strategy: z.object({
    programName: shortText,
    startDate: z.string().max(10),
    expectedDuration: shortText,
    cycleObjective: text,
    weeklyFrequency: optionalPositiveInteger,
    trainingSplit: text,
    priorities: text,
    restrictions: text,
    macrocycle: text,
    mesocycle: text,
    microcycle: text,
    currentPhase: shortText,
    currentWeek: optionalPositiveInteger,
    observations: text,
    cycles: z.array(cycleSchema).max(100),
  }),
  startMode: z.enum(WORKOUT_START_MODES),
  sessions: z.array(sessionSchema).max(30),
  customMethods: z.array(methodSchema).max(100),
});

export function parseWorkoutPlanDraft(value: unknown): WorkoutPlanDraft | null {
  const result = workoutPlanDraftSchema.safeParse(value);
  return result.success ? result.data : null;
}

export const STANDARD_TRAINING_METHODS: readonly TrainingMethodDefinition[] = [
  ["traditional", "Tradicional", "Execute todas as séries programadas do exercício.", "Complete séries, repetições e intervalos conforme a ficha.", "Desenvolvimento geral conforme a prescrição."],
  ["bi-set", "Bi-set", "Realize dois exercícios em sequência.", "Execute os dois exercícios antes do intervalo indicado.", "Aumentar densidade e estímulo do treino."],
  ["tri-set", "Tri-set", "Realize três exercícios em sequência.", "Conclua os três exercícios antes do intervalo.", "Aumentar densidade e volume do estímulo."],
  ["giant-set", "Giant set", "Realize quatro ou mais exercícios em sequência.", "Complete o bloco antes do intervalo indicado.", "Elevar a densidade do treino."],
  ["drop-set", "Drop set", "Reduza a carga e continue a série.", "Faça as reduções de carga definidas pelo profissional.", "Prolongar o estímulo muscular."],
  ["rest-pause", "Rest-pause", "Use pausas curtas dentro da série.", "Respeite as pausas e retomadas prescritas.", "Acumular repetições com controle de esforço."],
  ["ascending-pyramid", "Pirâmide crescente", "A carga aumenta progressivamente.", "Ajuste carga e repetições em cada série conforme a ficha.", "Progressão de intensidade."],
  ["descending-pyramid", "Pirâmide decrescente", "A carga diminui progressivamente.", "Reduza a carga em cada série conforme a ficha.", "Sustentar volume após série de maior intensidade."],
  ["complete-pyramid", "Pirâmide completa", "A carga aumenta e depois diminui.", "Siga a progressão e a regressão indicadas.", "Combinar progressão de intensidade e volume."],
  ["pre-exhaustion", "Pré-exaustão", "Um exercício isolado antecede o exercício principal.", "Execute a sequência sem alterar a ordem.", "Pré-fatigar o grupo priorizado."],
  ["post-exhaustion", "Pós-exaustão", "Um exercício isolado sucede o exercício principal.", "Execute a sequência na ordem prescrita.", "Prolongar o estímulo do grupo priorizado."],
  ["circuit", "Circuito", "Execute uma sequência de exercícios por estações.", "Complete as estações e pausas conforme a ficha.", "Desenvolver resistência e densidade."],
  ["cluster-set", "Cluster set", "A série é dividida por pausas curtas.", "Respeite os blocos de repetições e micropausas.", "Preservar qualidade em esforços intensos."],
  ["isometry", "Isometria", "Mantenha a posição pelo tempo prescrito.", "Sustente a posição e a respiração conforme orientação.", "Desenvolver controle e força estática."],
  ["emphasized-eccentric", "Excêntrico enfatizado", "Controle especialmente a fase de descida.", "Use o tempo excêntrico indicado na cadência.", "Aumentar controle e estímulo excêntrico."],
  ["emphasized-concentric", "Concêntrico enfatizado", "Execute com intenção na fase de subida.", "Aplique a orientação de velocidade sem perder a técnica.", "Priorizar produção de força concêntrica."],
  ["controlled-tempo", "Tempo controlado", "Siga o tempo indicado em cada fase.", "Use a cadência registrada na ficha.", "Aprimorar controle e tempo sob tensão."],
  ["contrast", "Contraste", "Alterne estímulos de características diferentes.", "Respeite a ordem e as cargas de cada exercício do par.", "Combinar força e velocidade."],
].map(([id, name, studentExplanation, executionInstruction, objective]) => ({
  id,
  name,
  studentExplanation,
  executionInstruction,
  objective,
  professionalObservation: "",
  custom: false,
}));

export function buildWorkoutMethodGlossary(
  draft: WorkoutPlanDraft,
): readonly WorkoutMethodGlossaryEntry[] {
  const usedIds = new Set(
    draft.sessions.flatMap((session) =>
      session.exercises.map((exercise) => exercise.methodId).filter(Boolean),
    ),
  );
  const definitions = [
    ...STANDARD_TRAINING_METHODS,
    ...draft.customMethods,
  ];
  return definitions
    .filter((method) => usedIds.has(method.id))
    .filter(
      (method, index, all) =>
        all.findIndex((candidate) => candidate.id === method.id) === index,
    )
    .map((method) => ({
      methodId: method.id,
      name: method.name,
      studentExplanation: method.studentExplanation || "Não informado",
      executionInstruction: method.executionInstruction || "Não informado",
      objective: method.objective || "Não informado",
      professionalObservation: method.professionalObservation,
    }));
}

export function parseStoredWorkoutPlanPayload(
  value: unknown,
): StoredWorkoutPlanPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (source.schemaVersion !== 1) return null;
  const draft = parseWorkoutPlanDraft(source);
  if (!draft) return null;
  const status = source.status;
  if (status !== "DRAFT" && status !== "FINALIZED") return null;
  return {
    ...draft,
    schemaVersion: 1,
    status,
    methodGlossary: buildWorkoutMethodGlossary(draft),
  };
}

export function emptyWorkoutPlanDraft(): WorkoutPlanDraft {
  return {
    service: {
      planType: "",
      trainingObjective: "",
      primaryModality: "",
      otherActivities: [],
    },
    valences: [],
    strategy: {
      programName: "",
      startDate: "",
      expectedDuration: "",
      cycleObjective: "",
      trainingSplit: "",
      priorities: "",
      restrictions: "",
      macrocycle: "",
      mesocycle: "",
      microcycle: "",
      currentPhase: "",
      observations: "",
      cycles: [],
    },
    startMode: "FREE",
    sessions: [],
    customMethods: [],
  };
}
