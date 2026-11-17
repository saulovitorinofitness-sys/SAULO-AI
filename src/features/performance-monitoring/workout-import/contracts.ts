import type { PerformanceModality } from "../contracts";

export const WORKOUT_IMPORT_PROVIDERS = ["APPLE_HEALTH"] as const;

export type WorkoutImportProvider =
  (typeof WORKOUT_IMPORT_PROVIDERS)[number];

/** Neutral workout record produced by a brand-specific reader. */
export interface ParsedWorkoutRecord {
  readonly id: string;
  readonly provider: WorkoutImportProvider;
  readonly externalIdentifier: string;
  readonly modality: PerformanceModality;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly durationSeconds?: number;
  readonly distanceMeters?: number;
}

export interface WorkoutImportResult {
  readonly importedIds: readonly string[];
  readonly duplicateIds: readonly string[];
}

export interface WorkoutImportStore {
  importWorkouts(input: {
    readonly masterRecordId: string;
    readonly importedByUserId: string;
    readonly workouts: readonly ParsedWorkoutRecord[];
  }): Promise<WorkoutImportResult>;
}
