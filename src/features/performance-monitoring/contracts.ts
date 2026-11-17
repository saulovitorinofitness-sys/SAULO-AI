export const PERFORMANCE_MODALITIES = [
  "STRENGTH",
  "RUNNING",
  "CYCLING",
  "OTHER",
] as const;

export type PerformanceModality = (typeof PERFORMANCE_MODALITIES)[number];

export interface PerformanceProfessionalReference {
  readonly id: string;
  readonly fullName: string;
}

/** Points to one session inside an immutable workout-plan version. */
export interface PrescribedWorkoutSessionReference {
  readonly masterRecordId: string;
  readonly workoutPlanEntryId: string;
  readonly workoutPlanVersionId: string;
  readonly sessionId: string;
}

export const WORKOUT_SCHEDULE_STATUSES = [
  "SCHEDULED",
  "RESCHEDULED",
  "COMPLETED",
  "SKIPPED",
  "CANCELLED",
] as const;

export type WorkoutScheduleStatus =
  (typeof WORKOUT_SCHEDULE_STATUSES)[number];

/** Calendar occurrence; the prescribed session remains in the versioned plan. */
export interface WorkoutScheduledSession
  extends PrescribedWorkoutSessionReference {
  readonly id: string;
  readonly title: string;
  readonly modality: PerformanceModality;
  readonly scheduledStartAt: string;
  readonly scheduledEndAt?: string;
  readonly plannedDurationSeconds?: number;
  readonly timeZone: string;
  readonly status: WorkoutScheduleStatus;
  readonly responsibleProfessional: PerformanceProfessionalReference;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const WORKOUT_EXECUTION_STATUSES = [
  "IN_PROGRESS",
  "COMPLETED",
  "ABORTED",
] as const;

export type WorkoutExecutionStatus =
  (typeof WORKOUT_EXECUTION_STATUSES)[number];

export const WORKOUT_EXECUTION_SOURCES = [
  "MANUAL",
  "FILE_IMPORT",
  "DEVICE",
] as const;

export type WorkoutExecutionSource =
  (typeof WORKOUT_EXECUTION_SOURCES)[number];

export const PERFORMANCE_DEVICE_PROVIDERS = [
  "GARMIN",
  "APPLE_HEALTH",
  "COROS",
  "POLAR",
  "MANUAL_FILE",
] as const;

/** Provider identifies the source architecture, not an active integration. */
export type PerformanceDeviceProvider =
  (typeof PERFORMANCE_DEVICE_PROVIDERS)[number];

export interface WorkoutExecutionActorReference {
  readonly id: string;
  readonly kind: "PATIENT" | "PROFESSIONAL";
  readonly fullName: string;
}

export type WorkoutExecutionOrigin =
  | {
      readonly source: "MANUAL";
      readonly actor: WorkoutExecutionActorReference;
    }
  | {
      readonly source: "FILE_IMPORT";
      readonly importArtifactId?: string;
      readonly provider?: PerformanceDeviceProvider;
      readonly externalIdentifier?: string;
      readonly importedBy: WorkoutExecutionActorReference;
    }
  | {
      readonly source: "DEVICE";
      readonly deviceConnectionId: string;
      readonly provider: Exclude<
        PerformanceDeviceProvider,
        "MANUAL_FILE"
      >;
    };

/** Historical fact. Its optional schedule link also permits spontaneous workouts. */
export interface WorkoutExecution {
  readonly id: string;
  readonly scheduledSessionId?: string;
  readonly masterRecordId: string;
  readonly workoutPlanEntryId?: string;
  readonly workoutPlanVersionId?: string;
  readonly sessionId?: string;
  readonly modality: PerformanceModality;
  readonly origin: WorkoutExecutionOrigin;
  readonly actualStartAt: string;
  readonly actualEndAt?: string;
  readonly executedDurationSeconds?: number;
  readonly status: WorkoutExecutionStatus;
  readonly executedRpe?: number;
  readonly notes?: string;
  readonly telemetry?: WorkoutTelemetrySummary;
  readonly exercises?: readonly WorkoutExerciseExecution[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const WORKOUT_LOAD_UNITS = [
  "KILOGRAM",
  "POUND",
  "BODY_WEIGHT",
  "MACHINE_LEVEL",
  "OTHER",
] as const;

export type WorkoutLoadUnit = (typeof WORKOUT_LOAD_UNITS)[number];

export const WORKOUT_SET_STATUSES = [
  "COMPLETED",
  "PARTIAL",
  "NOT_PERFORMED",
] as const;

export type WorkoutSetStatus = (typeof WORKOUT_SET_STATUSES)[number];

export interface WorkoutExerciseExecution {
  readonly id: string;
  readonly workoutExecutionId: string;
  readonly prescribedExerciseId?: string;
  readonly recordedName: string;
  readonly order: number;
  readonly notes?: string;
  readonly sets: readonly WorkoutSetExecution[];
}

export interface WorkoutSetExecution {
  readonly id: string;
  readonly exerciseExecutionId: string;
  readonly setNumber: number;
  readonly repetitions?: number;
  readonly load?: number;
  readonly loadUnit?: WorkoutLoadUnit;
  /** Perceived exertion on the 0-10 scale, when informed. */
  readonly rpe?: number;
  /** Repetitions in reserve, when informed. */
  readonly rir?: number;
  readonly status: WorkoutSetStatus;
}

export const HEART_RATE_ZONES = [
  "ZONE_1",
  "ZONE_2",
  "ZONE_3",
  "ZONE_4",
  "ZONE_5",
] as const;

export type HeartRateZone = (typeof HEART_RATE_ZONES)[number];

export interface HeartRateZoneDuration {
  readonly zone: HeartRateZone;
  readonly durationSeconds: number;
}

export const CADENCE_UNITS = [
  "REVOLUTIONS_PER_MINUTE",
  "STEPS_PER_MINUTE",
] as const;

export type CadenceUnit = (typeof CADENCE_UNITS)[number];

export interface WorkoutCadenceSummary {
  readonly average: number;
  readonly maximum?: number;
  readonly unit: CadenceUnit;
}

/** Compact summary only; high-frequency samples and GPS tracks stay outside it. */
export interface WorkoutTelemetrySummary {
  readonly durationSeconds?: number;
  readonly distanceMeters?: number;
  readonly averagePaceSecondsPerKilometer?: number;
  readonly averageSpeedMetersPerSecond?: number;
  readonly averageHeartRateBpm?: number;
  readonly maximumHeartRateBpm?: number;
  readonly heartRateZoneDurations?: readonly HeartRateZoneDuration[];
  readonly averagePowerWatts?: number;
  readonly maximumPowerWatts?: number;
  readonly cadence?: WorkoutCadenceSummary;
  readonly elevationGainMeters?: number;
  readonly elevationLossMeters?: number;
  readonly caloriesKilocalories?: number;
  /** Accepted only when the source explicitly supplies the value. */
  readonly sourceProvidedVo2MaxMillilitersPerKilogramPerMinute?: number;
}

export const WORKOUT_IMPORT_FORMATS = ["FIT", "TCX", "GPX", "CSV", "XML"] as const;

export type WorkoutImportFormat = (typeof WORKOUT_IMPORT_FORMATS)[number];

export const WORKOUT_IMPORT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "IMPORTED",
  "FAILED",
  "DUPLICATE",
] as const;

export type WorkoutImportStatus =
  (typeof WORKOUT_IMPORT_STATUSES)[number];

export interface WorkoutImportProcessingError {
  readonly code: string;
  readonly message: string;
  readonly recordIndex?: number;
}

/** Metadata only. Original import files are intentionally not retained. */
export interface WorkoutImportArtifact {
  readonly id: string;
  readonly format: WorkoutImportFormat;
  readonly checksumSha256: string;
  readonly externalIdentifier: string;
  readonly parserVersion: string;
  readonly status: WorkoutImportStatus;
  readonly importedAt: string;
  readonly processingErrors: readonly WorkoutImportProcessingError[];
}

export const PERFORMANCE_DEVICE_CONNECTION_STATUSES = [
  "PENDING",
  "ACTIVE",
  "EXPIRED",
  "REVOKED",
  "ERROR",
] as const;

export type PerformanceDeviceConnectionStatus =
  (typeof PERFORMANCE_DEVICE_CONNECTION_STATUSES)[number];

/** The credential reference is opaque; tokens, passwords and secrets are excluded. */
export interface PerformanceDeviceConnection {
  readonly id: string;
  readonly masterRecordId: string;
  readonly provider: PerformanceDeviceProvider;
  readonly externalAthleteIdentifier: string;
  readonly authorizedScopes: readonly string[];
  readonly status: PerformanceDeviceConnectionStatus;
  readonly expiresAt?: string;
  readonly lastSynchronizedAt?: string;
  readonly synchronizationCursor?: string;
  readonly encryptedCredentialReference: string;
}

/** Source-provided wellness only; no readiness or diagnostic inference is implied. */
export interface SourceProvidedWellnessSnapshot {
  readonly id: string;
  readonly masterRecordId: string;
  readonly provider: PerformanceDeviceProvider;
  readonly measuredAt: string;
  readonly sleepDurationSeconds?: number;
  readonly restingHeartRateBpm?: number;
  readonly hrvMilliseconds?: number;
  readonly sourceRecovery?: {
    readonly value: number;
    readonly scaleMinimum?: number;
    readonly scaleMaximum?: number;
  };
}
