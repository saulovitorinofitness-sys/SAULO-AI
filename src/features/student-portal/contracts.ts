export const STUDENT_PORTAL_EMPTY_MESSAGES = {
  diet: "Sua dieta ainda não foi liberada.",
  workout: "Seu treino ainda não foi liberado.",
  assessments: "Suas avaliações ainda não foram liberadas.",
  payments: "Seus pagamentos ainda não foram liberados.",
} as const;

export type StudentPortalContentType =
  | "DIET"
  | "WORKOUT"
  | "ASSESSMENTS"
  | "POSTURAL_MEDIA"
  | "PAYMENTS";

export interface StudentPortalContext {
  readonly userId: string;
  readonly patientId: string;
  readonly masterRecordId: string;
  readonly patientName: string;
  readonly patientCode: string;
}

export interface StudentDietItem {
  readonly id: string;
  readonly name: string;
  readonly portion: string;
  readonly substitutions: readonly string[];
}

export interface StudentDietMeal {
  readonly id: string;
  readonly name: string;
  readonly time?: string;
  readonly orientation?: string;
  readonly items: readonly StudentDietItem[];
}

export interface StudentDietView {
  readonly updatedAt: string;
  readonly meals: readonly StudentDietMeal[];
  readonly orientations: readonly string[];
}

export interface StudentWorkoutExercise {
  readonly id: string;
  readonly name: string;
  readonly sets?: string;
  readonly repetitions?: string;
  readonly load?: string;
  readonly restInterval?: string;
  readonly instruction?: string;
}

export interface StudentWorkoutSession {
  readonly id: string;
  readonly name: string;
  readonly objective?: string;
  readonly estimatedDuration?: string;
  readonly exercises: readonly StudentWorkoutExercise[];
}

export interface StudentWorkoutView {
  readonly updatedAt: string;
  readonly currentPhase?: string;
  readonly currentFocus?: string;
  readonly nextPhase?: string;
  readonly nextFocus?: string;
  readonly journey: readonly {
    readonly effectiveDate: string;
    readonly phaseBefore?: string;
    readonly phaseAfter?: string;
    readonly focusBefore?: string;
    readonly focusAfter?: string;
  }[];
  readonly sessions: readonly StudentWorkoutSession[];
}

export interface StudentAssessmentView {
  readonly id: string;
  readonly kind:
    | "BIOIMPEDANCE"
    | "PERIMETRY"
    | "PHYSICAL_ASSESSMENT"
    | "POSTURAL_ASSESSMENT";
  readonly performedAt: string;
  readonly results: unknown;
}

export interface StudentAssessmentEvolution {
  readonly previousDate: string;
  readonly currentDate: string;
  readonly summary?: string;
}

export interface StudentAssessmentsView {
  readonly items: readonly StudentAssessmentView[];
  readonly posturalEvolution: readonly StudentAssessmentEvolution[];
}

export interface StudentPaymentView {
  readonly id: string;
  readonly services: readonly string[];
  readonly amount: string;
  readonly dueDate?: string;
  readonly status: string;
  readonly receiptId?: string;
}

export interface StudentPortalDashboard {
  readonly student: {
    readonly name: string;
    readonly code: string;
  };
  readonly diet?: StudentDietView;
  readonly workout?: StudentWorkoutView;
  readonly assessments?: StudentAssessmentsView;
  readonly payments?: readonly StudentPaymentView[];
  readonly releases: Readonly<Record<StudentPortalContentType, boolean>>;
}
