import { z } from "zod";

export const EXERCISE_CATEGORY_OPTIONS = [
  "STRENGTH",
  "RUNNING",
  "CYCLING",
  "MOBILITY",
  "STRETCHING",
  "CORRECTIVE",
  "OTHER",
] as const;

export type ExerciseCategory =
  (typeof EXERCISE_CATEGORY_OPTIONS)[number];

export type ExerciseCatalogSource =
  | "SCIENTIFIC_LIBRARY"
  | "LEGACY_EXERCISE_LIBRARY";

export const EXERCISE_CATEGORY_LABELS: Readonly<
  Record<ExerciseCategory, string>
> = {
  STRENGTH: "Musculação",
  RUNNING: "Corrida",
  CYCLING: "Ciclismo",
  MOBILITY: "Mobilidade",
  STRETCHING: "Alongamento",
  CORRECTIVE: "Corretivo",
  OTHER: "Outro",
};

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).optional().default("");

export const exerciseLibraryDraftSchema = z.object({
  name: z.string().trim().min(2).max(180),
  category: z.enum(EXERCISE_CATEGORY_OPTIONS).default("OTHER"),
  muscleGroup: optionalText(120),
  equipment: optionalText(120),
  description: optionalText(1000),
  executionInstructions: optionalText(2000),
  professionalNotes: optionalText(2000),
  active: z.boolean().default(true),
});

export type ExerciseLibraryDraft = z.infer<
  typeof exerciseLibraryDraftSchema
>;

export interface ExerciseLibraryItemView extends ExerciseLibraryDraft {
  readonly id: string;
  readonly sourceKind?: ExerciseCatalogSource;
  readonly modality?: string;
  readonly movementPattern?: string;
  readonly classifications?: readonly string[];
  readonly tags?: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ExerciseLibrarySearchResult {
  readonly items: readonly ExerciseLibraryItemView[];
  readonly total: number;
}

export function normalizeExerciseName(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}
