import { z } from "zod";

import { scientificTrainingMethods } from "@/features/scientific-library/mock-data";

import {
  PERFORMANCE_SERVICE_OPTIONS,
  WORKOUT_START_MODES,
  type StoredWorkoutPlanPayload,
  type TrainingMethodDefinition,
  type WeeklyTrainingDivisionEntry,
  type WeeklyTrainingEntryKind,
  type WorkoutMethodGlossaryEntry,
  type WorkoutPlanDraft,
  type WorkoutPlanEnduranceSession,
  type WorkoutPlanEnduranceWeek,
  type WorkoutPlanningTransition,
  type WorkoutProtocolArea,
  type WorkoutProtocolReference,
  type WorkoutProtocolSource,
  type WorkoutWeekday,
} from "./workout-contracts";
import type { ExerciseLibraryItemView } from "./exercise-library-contracts";
import {
  cyclingPlanConfigurationSchema,
  enduranceCycleWeekSchema,
  enduranceSessionSchema,
  runningPlanConfigurationSchema,
} from "./endurance-workout-schemas";
import type { EnduranceSession } from "./endurance-workout-contracts";
import { weekdayFromIsoDate } from "./running-session-editor";

const text = z.string().max(5_000);
const shortText = z.string().max(500);
const optionalPositiveInteger = z.number().int().positive().max(365).optional();
const planningTransitionSchema: z.ZodType<WorkoutPlanningTransition> = z.object({
  effectiveDate: z.iso.date(),
  recordedAt: z.iso.datetime({ offset: true }),
  phaseBefore: shortText.optional(),
  phaseAfter: shortText.optional(),
  focusBefore: shortText.optional(),
  focusAfter: shortText.optional(),
});
export const STANDARD_TRAINING_METHODS: readonly TrainingMethodDefinition[] =
  scientificTrainingMethods.map((method) => ({
    id: method.id,
    name: method.name,
    studentExplanation: method.indication,
    executionInstruction: method.functioning,
    objective: method.objective,
    professionalObservation: method.care,
    custom: false,
  }));
export const LEGACY_TRAINING_METHOD_ALIASES = {
  traditional: "training-method-1",
  "bi-set": "training-method-6",
  "tri-set": "training-method-7",
  "giant-set": "training-method-31",
  "drop-set": "training-method-5",
  "rest-pause": "training-method-11",
  "ascending-pyramid": "training-method-2",
  "descending-pyramid": "training-method-3",
  "complete-pyramid": "training-method-4",
  "pre-exhaustion": "training-method-13",
  "post-exhaustion": "training-method-14",
  circuit: "training-method-10",
  "cluster-set": "training-method-12",
  isometry: "training-method-16",
  "emphasized-eccentric": "training-method-19",
  "emphasized-concentric": "training-method-20",
  "controlled-tempo": "training-method-17",
  contrast: "training-method-39",
} as const satisfies Readonly<Record<string, string>>;
const standardTrainingMethodsById = new Map(
  STANDARD_TRAINING_METHODS.map((method) => [method.id, method]),
);

function normalizedTrainingMethodName(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function resolveScientificTrainingMethodId(methodId: string) {
  if (standardTrainingMethodsById.has(methodId)) return methodId;
  return LEGACY_TRAINING_METHOD_ALIASES[
    methodId as keyof typeof LEGACY_TRAINING_METHOD_ALIASES
  ];
}
const libraryExerciseIdSchema = z.union([
  z.string().uuid(),
  z.string().regex(/^scientific-exercise-[1-9]\d*$/),
]);
const workoutProtocolSources = [
  "SCIENTIFIC_LIBRARY",
] as const satisfies readonly WorkoutProtocolSource[];
const workoutProtocolAreas = [
  "PERFORMANCE",
] as const satisfies readonly WorkoutProtocolArea[];
const workoutWeekdays = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const satisfies readonly WorkoutWeekday[];
const weeklyTrainingEntryKinds = [
  "TRAINING",
  "REST",
  "ACTIVE_RECOVERY",
] as const satisfies readonly WeeklyTrainingEntryKind[];

const workoutProtocolReferenceSchema: z.ZodType<WorkoutProtocolReference> =
  z.object({
    protocolId: z
      .string()
      .regex(/^scientific-protocol-training-[1-9]\d*$/),
    protocolName: z.string().trim().min(1).max(500),
    source: z.enum(workoutProtocolSources),
    version: z.string().max(500).optional(),
    area: z.enum(workoutProtocolAreas),
    professionalNotes: z.string().max(5_000).optional(),
  });

const weeklyTrainingDivisionEntrySchema: z.ZodType<WeeklyTrainingDivisionEntry> =
  z.object({
    weekday: z.enum(workoutWeekdays),
    weeklyOrder: z.number().int().positive().max(7),
    sessionName: z.string().max(500),
    primaryFocus: z.string().trim().min(1).max(500),
    prioritizedGroupsOrCapacities: z
      .array(z.string().trim().min(1).max(500))
      .max(50),
    sessionId: z.string().uuid().optional(),
    kind: z.enum(weeklyTrainingEntryKinds),
    observations: z.string().max(5_000).optional(),
  }).superRefine((entry, context) => {
    if (entry.kind === "TRAINING" && !entry.sessionName.trim()) {
      context.addIssue({
        code: "custom",
        path: ["sessionName"],
        message: "Informe o nome da sessão para o dia de treino.",
      });
    }
  });

const weeklyTrainingDivisionSchema = z
  .array(weeklyTrainingDivisionEntrySchema)
  .max(7)
  .superRefine((entries, context) => {
    const usedOrders = new Set<number>();
    const usedDayOrders = new Set<string>();
    entries.forEach((entry, index) => {
      if (usedOrders.has(entry.weeklyOrder)) {
        context.addIssue({
          code: "custom",
          path: [index, "weeklyOrder"],
          message: "A ordem semanal não pode ser repetida.",
        });
      }
      usedOrders.add(entry.weeklyOrder);

      const dayOrder = `${entry.weekday}:${entry.weeklyOrder}`;
      if (usedDayOrders.has(dayOrder)) {
        context.addIssue({
          code: "custom",
          path: [index, "weekday"],
          message: "O dia e a ordem semanal não podem ser repetidos.",
        });
      }
      usedDayOrders.add(dayOrder);
    });
  });

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
  libraryExerciseId: libraryExerciseIdSchema.optional(),
  libraryExerciseSource: z
    .enum(["SCIENTIFIC_LIBRARY", "LEGACY_EXERCISE_LIBRARY"])
    .optional(),
  prescription: shortText,
  sets: shortText,
  repetitions: shortText,
  load: shortText,
  loadUnit: shortText.default(""),
  rir: shortText.default(""),
  rpe: shortText.default(""),
  intensityType: z.enum(["", "PERCENT_1RM", "RPE", "RIR"]),
  intensityValue: shortText,
  restInterval: shortText,
  cadence: shortText,
  rangeOfMotion: shortText,
  methodId: z.string().max(200),
  observations: text,
  patientInstructions: text.default(""),
  substituteExercise: shortText,
});
const sessionSchema = z.object({
  id: z.string().uuid(),
  name: shortText,
  objective: text,
  estimatedDuration: shortText.default(""),
  observations: text,
  exercises: z.array(exerciseSchema).max(200),
});

function isRunningEnduranceSession(
  session: EnduranceSession,
): session is WorkoutPlanEnduranceSession<"RUNNING"> {
  return session.modality === "RUNNING";
}

function isCyclingEnduranceSession(
  session: EnduranceSession,
): session is WorkoutPlanEnduranceSession<"CYCLING"> {
  return session.modality === "CYCLING";
}

const runningEnduranceSessionSchema = enduranceSessionSchema.refine(
  isRunningEnduranceSession,
);
const cyclingEnduranceSessionSchema = enduranceSessionSchema.refine(
  isCyclingEnduranceSession,
);

const runningEnduranceWeekSchema = enduranceCycleWeekSchema
  .refine((week) =>
    week.sessions.every((session) =>
      runningEnduranceSessionSchema.safeParse(session).success,
    ),
  )
  .transform(
    (week): WorkoutPlanEnduranceWeek<"RUNNING"> => ({
      ...week,
      sessions: week.sessions.filter(isRunningEnduranceSession),
    }),
  );

const cyclingEnduranceWeekSchema = enduranceCycleWeekSchema
  .refine((week) =>
    week.sessions.every((session) =>
      cyclingEnduranceSessionSchema.safeParse(session).success,
    ),
  )
  .transform(
    (week): WorkoutPlanEnduranceWeek<"CYCLING"> => ({
      ...week,
      sessions: week.sessions.filter(isCyclingEnduranceSession),
    }),
  );

const workoutPlanEnduranceSchema = z.strictObject({
  running: z
    .strictObject({
      configuration: runningPlanConfigurationSchema,
      weeks: z.array(runningEnduranceWeekSchema),
    })
    .optional(),
  cycling: z
    .strictObject({
      configuration: cyclingPlanConfigurationSchema,
      weeks: z.array(cyclingEnduranceWeekSchema),
    })
    .optional(),
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
    currentFocus: shortText.optional(),
    nextPhase: shortText.optional(),
    nextFocus: shortText.optional(),
    currentWeek: optionalPositiveInteger,
    observations: text,
    cycles: z.array(cycleSchema).max(100),
    transitions: z.array(planningTransitionSchema).max(500).optional(),
    baseProtocol: workoutProtocolReferenceSchema.optional(),
    weeklyDivision: weeklyTrainingDivisionSchema.optional(),
  }),
  startMode: z.enum(WORKOUT_START_MODES),
  sessions: z.array(sessionSchema).max(30),
  customMethods: z.array(methodSchema).max(100),
  endurance: workoutPlanEnduranceSchema.optional(),
}).superRefine((draft, context) => {
  const sessionIds = new Set(draft.sessions.map((session) => session.id));
  const scientificNames = new Set(
    STANDARD_TRAINING_METHODS.map((method) =>
      normalizedTrainingMethodName(method.name),
    ),
  );
  const customMethodIds = new Set<string>();
  const customMethodNames = new Set<string>();

  draft.customMethods.forEach((method, index) => {
    const normalizedName = normalizedTrainingMethodName(method.name);
    if (
      resolveScientificTrainingMethodId(method.id) ||
      customMethodIds.has(method.id)
    ) {
      context.addIssue({
        code: "custom",
        path: ["customMethods", index, "id"],
        message: "O método personalizado não pode repetir um identificador.",
      });
    }
    if (
      normalizedName &&
      (scientificNames.has(normalizedName) || customMethodNames.has(normalizedName))
    ) {
      context.addIssue({
        code: "custom",
        path: ["customMethods", index, "name"],
        message: "O método personalizado não pode repetir um método existente.",
      });
    }
    customMethodIds.add(method.id);
    if (normalizedName) customMethodNames.add(normalizedName);
  });

  draft.strategy.weeklyDivision?.forEach((entry, index) => {
    if (entry.sessionId && !sessionIds.has(entry.sessionId)) {
      context.addIssue({
        code: "custom",
        path: ["strategy", "weeklyDivision", index, "sessionId"],
        message: "A sessão informada não existe neste plano.",
      });
    }
  });
  draft.sessions.forEach((session, sessionIndex) => {
    session.exercises.forEach((exercise, exerciseIndex) => {
      if (
        exercise.methodId &&
        !resolveScientificTrainingMethodId(exercise.methodId) &&
        !customMethodIds.has(exercise.methodId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["sessions", sessionIndex, "exercises", exerciseIndex, "methodId"],
          message: "O método de treinamento informado não é reconhecido.",
        });
      }
    });
  });
});

export function parseWorkoutPlanDraft(value: unknown): WorkoutPlanDraft | null {
  const result = workoutPlanDraftSchema.safeParse(value);
  if (!result.success) return null;
  return {
    ...result.data,
    ...(result.data.endurance
      ? { endurance: {
          ...result.data.endurance,
          running: result.data.endurance.running
            ? {
                ...result.data.endurance.running,
                weeks: result.data.endurance.running.weeks.map((week) => ({
                  ...week,
                  sessions: week.sessions.map((session) => ({
                    ...session,
                    weekday:
                      weekdayFromIsoDate(session.scheduledDate) ??
                      session.weekday,
                  })),
                })),
              }
            : undefined,
        } }
      : {}),
    sessions: result.data.sessions.map((session) => ({
      ...session,
      exercises: session.exercises.map((exercise) => ({
        ...exercise,
        rir:
          exercise.rir ||
          (exercise.intensityType === "RIR" ? exercise.intensityValue : ""),
        rpe:
          exercise.rpe ||
          (exercise.intensityType === "RPE" ? exercise.intensityValue : ""),
        intensityType:
          exercise.intensityType === "RIR" || exercise.intensityType === "RPE"
            ? ""
            : exercise.intensityType,
        intensityValue:
          exercise.intensityType === "RIR" || exercise.intensityType === "RPE"
            ? ""
            : exercise.intensityValue,
      })),
    })),
  };
}

export interface WorkoutFinalizationIssue {
  readonly path: string;
  readonly message: string;
}

export function validateWorkoutPlanFinalization(
  draft: WorkoutPlanDraft,
  library: readonly ExerciseLibraryItemView[],
): readonly WorkoutFinalizationIssue[] {
  const issues: WorkoutFinalizationIssue[] = [];
  const availableExercises = library.filter((exercise) => exercise.active);
  const runningSessions =
    draft.endurance?.running?.weeks.flatMap((week) => week.sessions) ?? [];

  if (!draft.sessions.length && !runningSessions.length) {
    return [{ path: "sessions", message: "Adicione pelo menos uma sessão de treino." }];
  }

  if (
    draft.service.contractedService === "RUNNING_PLAN" &&
    runningSessions.length === 0
  ) {
    issues.push({
      path: "endurance.running.weeks",
      message: "Adicione pelo menos uma sessão de corrida ao serviço contratado.",
    });
  }

  draft.sessions.forEach((session, sessionIndex) => {
    const sessionPath = `sessions.${sessionIndex}`;
    if (!session.name.trim()) {
      issues.push({ path: `${sessionPath}.name`, message: "Informe o nome da sessão." });
    }
    if (!session.exercises.length) {
      issues.push({
        path: `${sessionPath}.exercises`,
        message: `${session.name.trim() || `Sessão ${sessionIndex + 1}`}: adicione pelo menos um exercício.`,
      });
      return;
    }
    session.exercises.forEach((exercise, exerciseIndex) => {
      const exercisePath = `${sessionPath}.exercises.${exerciseIndex}`;
      if (!exercise.name.trim()) {
        issues.push({ path: `${exercisePath}.name`, message: "Informe o exercício." });
      }
      const libraryExercise = exercise.libraryExerciseId
        ? availableExercises.find(
            (candidate) =>
              candidate.id === exercise.libraryExerciseId &&
              (!exercise.libraryExerciseSource ||
                candidate.sourceKind === exercise.libraryExerciseSource),
          )
        : undefined;
      if (!libraryExercise) {
        issues.push({
          path: `${exercisePath}.libraryExerciseId`,
          message: `${exercise.name.trim() || "Exercício"}: selecione um exercício ativo da biblioteca.`,
        });
        return;
      }
      if (libraryExercise.category === "STRENGTH") {
        if (!exercise.sets.trim()) {
          issues.push({
            path: `${exercisePath}.sets`,
            message: `${exercise.name}: informe as séries.`,
          });
        }
        if (!exercise.repetitions.trim()) {
          issues.push({
            path: `${exercisePath}.repetitions`,
            message: `${exercise.name}: informe as repetições.`,
          });
        }
      }
    });
  });

  return issues;
}

export function buildWorkoutMethodGlossary(
  draft: WorkoutPlanDraft,
): readonly WorkoutMethodGlossaryEntry[] {
  const usedIds = new Set(
    draft.sessions.flatMap((session) =>
      session.exercises.map((exercise) => exercise.methodId).filter(Boolean),
    ),
  );
  const customMethodsById = new Map(
    draft.customMethods.map((method) => [method.id, method]),
  );
  const includedIds = new Set<string>();
  const includedNames = new Set<string>();

  return [...usedIds].flatMap((usedId) => {
    const scientificId = resolveScientificTrainingMethodId(usedId);
    const method = scientificId
      ? standardTrainingMethodsById.get(scientificId)
      : customMethodsById.get(usedId);
    if (!method) return [];

    const normalizedName = normalizedTrainingMethodName(method.name);
    if (
      includedIds.has(scientificId ?? method.id) ||
      includedNames.has(normalizedName)
    ) {
      return [];
    }
    includedIds.add(scientificId ?? method.id);
    includedNames.add(normalizedName);

    return [{
      methodId: usedId,
      name: method.name,
      studentExplanation: method.studentExplanation || "Não informado",
      executionInstruction: method.executionInstruction || "Não informado",
      objective: method.objective || "Não informado",
      professionalObservation: method.professionalObservation,
    }];
  });
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

function optionalPlanningValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function confirmWorkoutPlanningTransition(
  draft: WorkoutPlanDraft,
  input: { readonly effectiveDate: string; readonly recordedAt: string },
): WorkoutPlanDraft {
  if (
    !z.iso.date().safeParse(input.effectiveDate).success ||
    !z.iso.datetime({ offset: true }).safeParse(input.recordedAt).success
  ) {
    throw new Error("WORKOUT_PLAN_TRANSITION_DATE_INVALID");
  }

  const phaseBefore = optionalPlanningValue(draft.strategy.currentPhase);
  const focusBefore = optionalPlanningValue(draft.strategy.currentFocus);
  const plannedPhase = optionalPlanningValue(draft.strategy.nextPhase);
  const plannedFocus = optionalPlanningValue(draft.strategy.nextFocus);
  const phaseChanges = plannedPhase !== undefined && plannedPhase !== phaseBefore;
  const focusChanges = plannedFocus !== undefined && plannedFocus !== focusBefore;

  if (!phaseChanges && !focusChanges) return draft;

  const transition: WorkoutPlanningTransition = {
    effectiveDate: input.effectiveDate,
    recordedAt: input.recordedAt,
    phaseBefore,
    phaseAfter: plannedPhase ?? phaseBefore,
    focusBefore,
    focusAfter: plannedFocus ?? focusBefore,
  };
  const transitions = draft.strategy.transitions ?? [];
  const alreadyRegistered = transitions.some(
    (item) =>
      item.effectiveDate === transition.effectiveDate &&
      item.phaseBefore === transition.phaseBefore &&
      item.phaseAfter === transition.phaseAfter &&
      item.focusBefore === transition.focusBefore &&
      item.focusAfter === transition.focusAfter,
  );

  return {
    ...draft,
    strategy: {
      ...draft.strategy,
      currentPhase: plannedPhase ?? draft.strategy.currentPhase,
      currentFocus:
        plannedFocus !== undefined ? plannedFocus : draft.strategy.currentFocus,
      nextPhase: plannedPhase !== undefined ? "" : draft.strategy.nextPhase,
      nextFocus: plannedFocus !== undefined ? "" : draft.strategy.nextFocus,
      transitions: alreadyRegistered
        ? transitions
        : [...transitions, transition],
    },
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
