import type {
  ExerciseLibraryItemView,
  PerformanceServiceType,
  WeeklyTrainingDivisionEntry,
  WorkoutExercise,
  WorkoutPlanDraft,
  WorkoutProfessionalContext,
  WorkoutProtocolReference,
  WorkoutSession,
} from "./workout-contracts";

export interface AssistedWorkoutProposalInput {
  readonly context: WorkoutProfessionalContext;
  readonly contractedService?: PerformanceServiceType;
  readonly primaryModality?: string;
  readonly objective?: string;
  readonly trainingExperience?: string;
  readonly weeklyFrequency?: number | string;
  readonly sessionDuration?: string;
  readonly availableEquipment?: readonly string[];
  readonly exerciseLibrary?: readonly ExerciseLibraryItemView[];
  readonly existingSessionNames?: readonly string[];
  readonly applicationMode?: AssistedWorkoutApplicationMode;
  readonly idFactory?: () => string;
}

export type AssistedWorkoutApplicationMode = "APPEND" | "REPLACE";

export interface AssistedWorkoutExercise extends WorkoutExercise {
  readonly requiredEquipment: string;
}

export interface AssistedWorkoutSession
  extends Omit<WorkoutSession, "exercises"> {
  readonly exercises: readonly AssistedWorkoutExercise[];
}

export interface AssistedWorkoutProposal {
  readonly applicationMode: AssistedWorkoutApplicationMode;
  readonly existingSessionCount: number;
  readonly resultingSessionCount: number;
  readonly recognizedObjective?: string;
  readonly suggestedWeeklyFrequency?: string;
  readonly sessionDuration?: string;
  readonly availableEquipment: readonly string[];
  readonly sessions: readonly AssistedWorkoutSession[];
  readonly suggestedWeeklyDivision: readonly WeeklyTrainingDivisionEntry[];
  readonly priorities: readonly string[];
  readonly careAndLimitations: readonly string[];
  readonly suggestedBaseProtocol?: WorkoutProtocolReference;
  readonly professionalRationales: readonly string[];
  readonly missingInformation: readonly string[];
  readonly coherenceAlerts: readonly string[];
  readonly status: "REQUIRES_PROFESSIONAL_CONFIRMATION";
}

const serviceModalityKeywords: Readonly<
  Partial<Record<PerformanceServiceType, readonly string[]>>
> = {
  STRENGTH_TRAINING: ["musculacao", "forca"],
  STRENGTH_FOR_RUNNING: ["corrida"],
  STRENGTH_FOR_CYCLING: ["ciclismo", "bicicleta", "bike"],
  RUNNING_PLAN: ["corrida"],
  CYCLING_PLAN: ["ciclismo", "bicicleta", "bike"],
};

function normalizedValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function uniqueValues(values: readonly (string | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function routineDetail(routine: string | undefined, labels: readonly string[]) {
  if (!routine?.trim()) return undefined;
  for (const part of routine.split(" · ").map((value) => value.trim())) {
    const label = labels.find((candidate) => part.startsWith(`${candidate}:`));
    if (label) return part.slice(label.length + 1).trim() || undefined;
  }
  return undefined;
}

function parsedFrequency(value: number | string | undefined) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1 && value <= 7
      ? value
      : undefined;
  }
  const parsed = value?.match(/\b([1-7])\b/u)?.[1];
  return parsed ? Number(parsed) : undefined;
}

function parsedDurationMinutes(value: string | undefined) {
  if (!value?.trim()) return undefined;
  const hours = value.match(/(\d+(?:[.,]\d+)?)\s*h/iu)?.[1];
  const minutes = value.match(/(\d+)\s*min/iu)?.[1];
  const plainMinutes = value.match(/^\s*(\d+)\s*$/u)?.[1];
  const total =
    (hours ? Number(hours.replace(",", ".")) * 60 : 0) +
    (minutes ? Number(minutes) : 0) +
    (plainMinutes ? Number(plainMinutes) : 0);
  return total > 0 && total <= 300 ? Math.round(total) : undefined;
}

function serviceMatchesModality(
  service: PerformanceServiceType | undefined,
  modality: string | undefined,
) {
  if (!service || !modality?.trim()) return undefined;
  const keywords = serviceModalityKeywords[service];
  if (!keywords) return undefined;
  const normalizedModality = normalizedValue(modality);
  return keywords.some((keyword) => normalizedModality.includes(keyword));
}

function registeredModalitiesMatchPrimary(
  registeredModalities: readonly string[],
  primaryModality: string | undefined,
) {
  if (!registeredModalities.length || !primaryModality?.trim()) return undefined;
  const primary = normalizedValue(primaryModality);
  return registeredModalities.some((modality) => {
    const registered = normalizedValue(modality);
    return registered.includes(primary) || primary.includes(registered);
  });
}

function matchesAvailableEquipment(
  exercise: ExerciseLibraryItemView,
  availableEquipment: readonly string[],
) {
  const required = normalizedValue(exercise.equipment);
  if (!required) return false;
  return availableEquipment.some((equipment) => {
    const available = normalizedValue(equipment);
    return available && (required.includes(available) || available.includes(required));
  });
}

const conventionalGymEquipmentPriority = [
  "peso corporal",
  "halter",
  "banco",
  "barra",
  "elastico",
  "colchonete",
  "polia",
];

function conventionalGymPriority(exercise: ExerciseLibraryItemView) {
  const equipment = normalizedValue(exercise.equipment);
  const priority = conventionalGymEquipmentPriority.findIndex((term) =>
    equipment.includes(term),
  );
  return priority >= 0 ? priority : conventionalGymEquipmentPriority.length;
}

function conflictsWithLimitations(
  exercise: ExerciseLibraryItemView,
  limitations: readonly string[],
) {
  const safetyText = normalizedValue(
    [
      exercise.name,
      exercise.description,
      exercise.executionInstructions,
      exercise.professionalNotes,
    ].join(" "),
  );
  const relevantTerms = limitations.flatMap((limitation) =>
    normalizedValue(limitation)
      .split(/[^a-z0-9]+/u)
      .filter((term) => term.length >= 5),
  );
  return relevantTerms.some((term) => safetyText.includes(term));
}

function suggestedSessionName(
  index: number,
  existingNames: Set<string>,
) {
  for (let offset = 0; offset < 26; offset += 1) {
    const name = `Treino ${String.fromCharCode(65 + ((index + offset) % 26))}`;
    if (!existingNames.has(normalizedValue(name))) {
      existingNames.add(normalizedValue(name));
      return name;
    }
  }
  const fallback = `Treino sugerido ${index + 1}`;
  existingNames.add(normalizedValue(fallback));
  return fallback;
}

function suggestedExercise(
  exercise: ExerciseLibraryItemView,
  order: number,
  experience: string,
  idFactory: () => string,
): AssistedWorkoutExercise {
  const beginner = normalizedValue(experience).includes("inician");
  return {
    id: idFactory(),
    order,
    name: exercise.name,
    libraryExerciseId: exercise.id,
    libraryExerciseSource: exercise.sourceKind,
    prescription: "",
    sets: beginner ? "2" : "3",
    repetitions: beginner ? "10-12" : "8-12",
    load: "",
    loadUnit: "",
    rir: "",
    rpe: "",
    intensityType: "",
    intensityValue: "",
    restInterval: "60-90 s",
    cadence: "",
    rangeOfMotion: "",
    methodId: "",
    observations: "",
    patientInstructions: exercise.executionInstructions,
    substituteExercise: "",
    requiredEquipment: exercise.equipment.trim() || "Não informado",
  };
}

export function proposeAssistedWorkoutStructure(
  input: AssistedWorkoutProposalInput,
): AssistedWorkoutProposal {
  const { context } = input;
  const applicationMode = input.applicationMode ?? "APPEND";
  const existingSessionCount = input.existingSessionNames?.length ?? 0;
  const recognizedObjective =
    input.objective?.trim() || context.objective?.trim() || undefined;
  const trainingExperience =
    input.trainingExperience?.trim() || context.trainingExperience?.trim() || undefined;
  const explicitWeeklyFrequency = parsedFrequency(input.weeklyFrequency);
  const suggestedWeeklyFrequency =
    explicitWeeklyFrequency !== undefined
      ? `${explicitWeeklyFrequency}x por semana`
      : undefined;
  const sessionDuration =
    input.sessionDuration?.trim() ||
    (context.sessionDurationMinutes !== undefined
      ? `${context.sessionDurationMinutes} min`
      : routineDetail(context.trainingRoutine, [
          "Duração registrada",
          "Duração",
        ]));
  const weeklyFrequency =
    explicitWeeklyFrequency ?? parsedFrequency(suggestedWeeklyFrequency);
  const durationMinutes = parsedDurationMinutes(sessionDuration);
  const availableEquipment = uniqueValues(input.availableEquipment ?? []);
  const careAndLimitations = uniqueValues([
    ...(context.painAndLimitations ?? []),
    ...(context.relevantInjuries ?? []),
    ...(context.relevantContraindications ?? []),
    ...(context.relevantPosturalFindings ?? []),
  ]);
  const suggestedWeeklyDivision =
    context.previousWorkoutPlan?.weeklyDivision ?? [];
  const priorities = uniqueValues([
    recognizedObjective,
    ...suggestedWeeklyDivision.flatMap(
      (entry) => entry.prioritizedGroupsOrCapacities,
    ),
  ]);
  const missingInformation: string[] = [];
  const coherenceAlerts: string[] = [];
  const professionalRationales: string[] = [];

  if (!recognizedObjective) missingInformation.push("Objetivo do paciente");
  if (!trainingExperience) missingInformation.push("Experiência de treinamento");
  if (!weeklyFrequency) {
    missingInformation.push(
      "Frequência semanal — corrija em Estratégia e periodização",
    );
  }
  if (!durationMinutes) missingInformation.push("Duração disponível por sessão");
  if (!context.practicedModalities?.length) {
    professionalRationales.push(
      "Modalidades praticadas não informadas; revisar a coerência da sugestão com a modalidade principal.",
    );
  }
  if (!context.physicalAssessments?.length) {
    professionalRationales.push(
      "Avaliações físicas estruturadas não disponíveis para esta sugestão.",
    );
  }
  if (!suggestedWeeklyDivision.length) {
    professionalRationales.push(
      "Sem divisão semanal anterior confirmada; a prévia usa somente a frequência informada.",
    );
  }
  if (careAndLimitations.length) {
    professionalRationales.push(
      "Dores, limitações e cuidados registrados foram preservados para revisão em todas as sessões sugeridas.",
    );
  }

  const serviceCompatibility = serviceMatchesModality(
    input.contractedService,
    input.primaryModality,
  );
  if (serviceCompatibility === false) {
    coherenceAlerts.push(
      "Revisar coerência entre serviço contratado e modalidade principal.",
    );
  }
  const registeredModalityCompatibility = registeredModalitiesMatchPrimary(
    context.practicedModalities ?? [],
    input.primaryModality,
  );
  if (registeredModalityCompatibility === false) {
    coherenceAlerts.push(
      "Revisar coerência entre modalidades registradas e modalidade principal.",
    );
  }

  const suggestedBaseProtocol =
    coherenceAlerts.length === 0 ? context.activeProtocol : undefined;
  if (!context.activeProtocol) {
    professionalRationales.push(
      "Nenhum protocolo-base ativo foi incorporado à sugestão.",
    );
  }

  const safeActiveExercises = (input.exerciseLibrary ?? []).filter(
    (exercise) =>
      exercise.active &&
      !conflictsWithLimitations(exercise, careAndLimitations),
  );
  const conventionalExercises = safeActiveExercises.filter(
    (exercise) =>
      conventionalGymPriority(exercise) <
      conventionalGymEquipmentPriority.length,
  );
  const compatibleExercises = availableEquipment.length
    ? safeActiveExercises.filter((exercise) =>
        matchesAvailableEquipment(exercise, availableEquipment),
      )
    : [...(conventionalExercises.length
        ? conventionalExercises
        : safeActiveExercises
      )].sort(
        (left, right) =>
          conventionalGymPriority(left) - conventionalGymPriority(right) ||
          left.name.localeCompare(right.name, "pt-BR"),
      );
  if (!compatibleExercises.length) {
    missingInformation.push(
      availableEquipment.length
        ? "Exercícios ativos compatíveis com o filtro de equipamento e as limitações informadas"
        : "Exercícios ativos compatíveis com as limitações informadas",
    );
  }

  const essentialMissing = [
    !recognizedObjective,
    !trainingExperience,
    !weeklyFrequency,
    !durationMinutes,
    !compatibleExercises.length,
  ].some(Boolean);
  const idFactory = input.idFactory ?? (() => crypto.randomUUID());
  const existingNames = new Set(
    (applicationMode === "APPEND" ? input.existingSessionNames ?? [] : []).map(
      normalizedValue,
    ),
  );
  const exercisesPerSession = durationMinutes
    ? durationMinutes <= 35
      ? 3
      : durationMinutes <= 55
        ? 4
        : 5
    : 0;
  const sessions: AssistedWorkoutSession[] = [];

  if (!essentialMissing && weeklyFrequency && trainingExperience) {
    for (let sessionIndex = 0; sessionIndex < weeklyFrequency; sessionIndex += 1) {
      const exerciseCount = Math.min(
        exercisesPerSession,
        compatibleExercises.length,
      );
      const exercises = Array.from({ length: exerciseCount }, (_, index) =>
        compatibleExercises[
          (sessionIndex * exercisesPerSession + index) %
            compatibleExercises.length
        ],
      ).map((exercise, index) =>
        suggestedExercise(exercise, index + 1, trainingExperience, idFactory),
      );
      sessions.push({
        id: idFactory(),
        name: suggestedSessionName(sessionIndex, existingNames),
        objective: recognizedObjective ?? "",
        estimatedDuration: sessionDuration ?? "",
        observations: careAndLimitations.length
          ? `Cuidados informados: ${careAndLimitations.join(" · ")}. Revisar exercícios e parâmetros antes de aplicar.`
          : "Revisar exercícios e parâmetros antes de aplicar.",
        exercises,
      });
    }
  }

  return {
    applicationMode,
    existingSessionCount,
    resultingSessionCount:
      applicationMode === "APPEND"
        ? existingSessionCount + sessions.length
        : sessions.length,
    recognizedObjective,
    suggestedWeeklyFrequency,
    sessionDuration,
    availableEquipment,
    sessions,
    suggestedWeeklyDivision,
    priorities,
    careAndLimitations,
    suggestedBaseProtocol,
    professionalRationales,
    missingInformation,
    coherenceAlerts,
    status: "REQUIRES_PROFESSIONAL_CONFIRMATION",
  };
}

export function applyAssistedWorkoutProposal(
  draft: WorkoutPlanDraft,
  proposal: AssistedWorkoutProposal,
): WorkoutPlanDraft {
  const existingIds = new Set(
    proposal.applicationMode === "APPEND"
      ? draft.sessions.map((session) => session.id)
      : [],
  );
  const newSessions = proposal.sessions.filter(
    (session) => !existingIds.has(session.id),
  );
  if (!newSessions.length) return draft;
  const appliedSessions: WorkoutSession[] = newSessions.map((session) => ({
    ...session,
    exercises: session.exercises.map(
      ({ requiredEquipment, ...exercise }): WorkoutExercise => ({
        ...exercise,
        observations: [
          exercise.observations.trim(),
          requiredEquipment.trim()
            ? `Equipamento previsto: ${requiredEquipment.trim()}`
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
      }),
    ),
  }));
  return {
    ...draft,
    sessions:
      proposal.applicationMode === "REPLACE"
        ? appliedSessions
        : [...draft.sessions, ...appliedSessions],
  };
}
