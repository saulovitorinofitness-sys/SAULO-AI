export const PERFORMANCE_SERVICE_OPTIONS = [
  "STRENGTH_TRAINING",
  "STRENGTH_FOR_RUNNING",
  "STRENGTH_FOR_CYCLING",
  "STRENGTH_FOR_OTHER_SPORT",
  "RUNNING_PLAN",
  "CYCLING_PLAN",
  "INTEGRATED_COACHING",
  "CUSTOM_FREE_TRAINING",
] as const;

export type PerformanceServiceType =
  (typeof PERFORMANCE_SERVICE_OPTIONS)[number];

export const PERFORMANCE_SERVICE_LABELS: Readonly<
  Record<PerformanceServiceType, string>
> = {
  STRENGTH_TRAINING: "Treino de musculação",
  STRENGTH_FOR_RUNNING: "Musculação complementar para corrida",
  STRENGTH_FOR_CYCLING: "Musculação complementar para ciclismo",
  STRENGTH_FOR_OTHER_SPORT:
    "Musculação complementar para outra modalidade",
  RUNNING_PLAN: "Planilha exclusiva de corrida",
  CYCLING_PLAN: "Planilha exclusiva de ciclismo",
  INTEGRATED_COACHING: "Acompanhamento integrado",
  CUSTOM_FREE_TRAINING: "Treino livre personalizado",
};

export const PHYSICAL_VALENCE_OPTIONS = [
  "Força",
  "Força máxima",
  "Hipertrofia",
  "Resistência muscular",
  "Potência",
  "Velocidade",
  "Agilidade",
  "Equilíbrio",
  "Coordenação",
  "Mobilidade",
  "Flexibilidade",
  "Estabilidade",
  "Resistência cardiorrespiratória",
  "Core",
  "Prevenção de lesões",
  "Exercício corretivo",
] as const;

export const WORKOUT_START_MODES = [
  "FREE",
  "PROTOCOL",
  "PREVIOUS",
  "ASSISTED",
] as const;
export type WorkoutStartMode = (typeof WORKOUT_START_MODES)[number];
export const WORKOUT_START_MODE_LABELS: Readonly<
  Record<WorkoutStartMode, string>
> = {
  FREE: "Modo livre",
  PROTOCOL: "Usar protocolo",
  PREVIOUS: "Usar treino anterior",
  ASSISTED: "Sugestão assistida",
};

export const PROGRAM_PHASE_OPTIONS = [
  "Adaptação",
  "Desenvolvimento",
  "Intensificação",
  "Recuperação",
  "Transição",
  "Polimento",
] as const;

export interface InheritedTrainingFact {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly source:
    | "Cadastro"
    | "Anamnese"
    | "Antropometria"
    | "Bioimpedância"
    | "Perimetria"
    | "Avaliação Postural";
  readonly sourceEntryId?: string;
}

export interface ExternalActivity {
  readonly id: string;
  readonly name: string;
  readonly supervision: "PROFESSIONAL" | "SELF_DIRECTED" | "";
}

export interface PerformanceServiceContext {
  readonly contractedService?: PerformanceServiceType;
  readonly planType: string;
  readonly trainingObjective: string;
  readonly primaryModality: string;
  readonly otherActivities: readonly ExternalActivity[];
}

export interface PeriodizationCycle {
  readonly id: string;
  readonly level: "MACROCYCLE" | "MESOCYCLE" | "MICROCYCLE";
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly objective: string;
  readonly observations: string;
}

export interface WorkoutProgramStrategy {
  readonly programName: string;
  readonly startDate: string;
  readonly expectedDuration: string;
  readonly cycleObjective: string;
  readonly weeklyFrequency?: number;
  readonly trainingSplit: string;
  readonly priorities: string;
  readonly restrictions: string;
  readonly macrocycle: string;
  readonly mesocycle: string;
  readonly microcycle: string;
  readonly currentPhase: string;
  readonly currentWeek?: number;
  readonly observations: string;
  readonly cycles: readonly PeriodizationCycle[];
}

export interface TrainingMethodDefinition {
  readonly id: string;
  readonly name: string;
  readonly studentExplanation: string;
  readonly executionInstruction: string;
  readonly objective: string;
  readonly professionalObservation: string;
  readonly custom: boolean;
}

export interface WorkoutExercise {
  readonly id: string;
  readonly order: number;
  readonly name: string;
  readonly libraryExerciseId?: string;
  readonly prescription: string;
  readonly sets: string;
  readonly repetitions: string;
  readonly load: string;
  readonly intensityType: "" | "PERCENT_1RM" | "RPE" | "RIR";
  readonly intensityValue: string;
  readonly restInterval: string;
  readonly cadence: string;
  readonly rangeOfMotion: string;
  readonly methodId: string;
  readonly observations: string;
  readonly substituteExercise: string;
}

export interface WorkoutSession {
  readonly id: string;
  readonly name: string;
  readonly objective: string;
  readonly observations: string;
  readonly exercises: readonly WorkoutExercise[];
}

export interface WorkoutPlanDraft {
  readonly service: PerformanceServiceContext;
  readonly valences: readonly string[];
  readonly strategy: WorkoutProgramStrategy;
  readonly startMode: WorkoutStartMode;
  readonly sessions: readonly WorkoutSession[];
  readonly customMethods: readonly TrainingMethodDefinition[];
}

export type WorkoutPlanStatus = "DRAFT" | "FINALIZED";

export interface WorkoutMethodGlossaryEntry {
  readonly methodId: string;
  readonly name: string;
  readonly studentExplanation: string;
  readonly executionInstruction: string;
  readonly objective: string;
  readonly professionalObservation: string;
}

export interface StoredWorkoutPlanPayload extends WorkoutPlanDraft {
  readonly schemaVersion: 1;
  readonly status: WorkoutPlanStatus;
  readonly methodGlossary: readonly WorkoutMethodGlossaryEntry[];
}

export interface ExerciseLibraryItemView {
  readonly id: string;
  readonly name: string;
  readonly muscleGroup?: string;
  readonly equipment?: string;
  readonly description?: string;
}

export interface PerformanceWorkoutView {
  readonly patient: {
    readonly id: string;
    readonly name: string;
    readonly code: string;
  };
  readonly masterRecordId: string;
  readonly attendanceId: string;
  readonly entryId?: string;
  readonly status: WorkoutPlanStatus;
  readonly draft: WorkoutPlanDraft;
  readonly inheritedFacts: readonly InheritedTrainingFact[];
  readonly exerciseLibrary: readonly ExerciseLibraryItemView[];
  readonly responsibleProfessional: string;
  readonly updatedAt?: string;
  readonly version: number;
}
