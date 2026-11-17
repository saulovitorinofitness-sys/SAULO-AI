import type { WorkoutWeekday } from "./workout-contracts";

export const ENDURANCE_MODALITIES = ["RUNNING", "CYCLING"] as const;

export type EnduranceModality = (typeof ENDURANCE_MODALITIES)[number];

export const ENDURANCE_PRIMARY_UNITS = ["TIME", "DISTANCE"] as const;

export type EndurancePrimaryUnit = (typeof ENDURANCE_PRIMARY_UNITS)[number];

export const ENDURANCE_INTENSITY_METHODS = [
  "NONE",
  "RPE",
  "HEART_RATE",
  "PACE",
  "SPEED",
  "POWER",
  "CADENCE",
  "FREE_GUIDANCE",
] as const;

export type EnduranceIntensityMethod =
  (typeof ENDURANCE_INTENSITY_METHODS)[number];

export const RUNNING_ENVIRONMENTS = [
  "ROAD",
  "TRACK",
  "TREADMILL",
  "TRAIL",
  "MIXED",
  "OTHER",
] as const;

export const ENDURANCE_ENVIRONMENTS = RUNNING_ENVIRONMENTS;

export type RunningEnvironment = (typeof RUNNING_ENVIRONMENTS)[number];

export type CyclingEnvironment = Exclude<RunningEnvironment, "TREADMILL">;

export type EnduranceEnvironment<
  Modality extends EnduranceModality = EnduranceModality,
> = Modality extends "RUNNING" ? RunningEnvironment : CyclingEnvironment;

export type EnduranceNumericTarget =
  | {
      readonly valueType: "SINGLE";
      readonly value: number;
    }
  | {
      readonly valueType: "RANGE";
      readonly minimum: number;
      readonly maximum: number;
    };

export type EnduranceIntensityTarget =
  | {
      readonly type: "NONE";
    }
  | {
      readonly type: "RPE";
      readonly unit: "RPE";
      readonly target: EnduranceNumericTarget;
    }
  | {
      readonly type: "HEART_RATE";
      readonly unit: "BEATS_PER_MINUTE";
      readonly target: EnduranceNumericTarget;
    }
  | {
      readonly type: "PACE";
      readonly unit: "SECONDS_PER_KILOMETER";
      readonly target: EnduranceNumericTarget;
      /** Pace is canonical; speed is only an alternate presentation. */
      readonly preferredDisplay?: "PACE" | "SPEED";
    }
  | {
      readonly type: "POWER";
      readonly unit: "WATTS";
      readonly target: EnduranceNumericTarget;
    }
  | {
      readonly type: "CADENCE";
      readonly unit: "STEPS_PER_MINUTE" | "REVOLUTIONS_PER_MINUTE";
      readonly target: EnduranceNumericTarget;
    }
  | {
      readonly type: "FREE_GUIDANCE";
      readonly guidance: string;
    };

export type EnduranceWeeklyVolumeReference =
  | {
      readonly unit: "TIME";
      readonly durationSeconds: number;
    }
  | {
      readonly unit: "DISTANCE";
      readonly distanceMeters: number;
    };

export interface EnduranceRecentPerformanceReference {
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly recordedAt?: string;
  readonly sourceExecutionId?: string;
  readonly source?: string;
  readonly sourceProvider?: string;
}

export interface RunningTestGoal {
  readonly requiredDistanceMeters: number;
  readonly targetDurationSeconds: number;
  readonly testDate: string;
}

export interface EnduranceAthleteReferenceData {
  readonly comfortableContinuousDurationSeconds?: number;
  readonly currentContinuousDistanceMeters?: number;
  readonly longestRecentDistanceMeters?: number;
  readonly recentPerformance?: EnduranceRecentPerformanceReference;
  readonly comfortablePaceSecondsPerKilometer?: number;
  readonly restingHeartRateBpm?: number;
  readonly knownMaximumHeartRateBpm?: number;
  readonly thresholdHeartRateBpm?: number;
  readonly habitualRpe?: number;
  readonly currentWeeklyVolume?: EnduranceWeeklyVolumeReference;
  readonly recentHistory?: string;
  readonly updatedAt?: string;
}

export const ENDURANCE_ZONE_PROFILE_SOURCES = [
  "TEST",
  "THRESHOLD",
  "KNOWN_MAXIMUM_HEART_RATE",
  "ESTIMATE",
  "WATCH",
  "MANUAL",
] as const;

export type EnduranceZoneProfileSource =
  (typeof ENDURANCE_ZONE_PROFILE_SOURCES)[number];

export const ENDURANCE_ZONE_CODES = ["Z1", "Z2", "Z3", "Z4", "Z5"] as const;

export type EnduranceZoneCode = (typeof ENDURANCE_ZONE_CODES)[number];

export interface EnduranceZoneDefinition {
  readonly name?: string;
  readonly minimumHeartRateBpm?: number;
  readonly maximumHeartRateBpm?: number;
  readonly minimumPaceSecondsPerKilometer?: number;
  readonly maximumPaceSecondsPerKilometer?: number;
  readonly minimumPowerWatts?: number;
  readonly maximumPowerWatts?: number;
  readonly minimumRpe?: number;
  readonly maximumRpe?: number;
  readonly sensationAndBreathingGuidance?: string;
}

export interface EnduranceZoneProfile {
  readonly source: EnduranceZoneProfileSource;
  readonly assessedAt: string;
  readonly zones: Readonly<Record<EnduranceZoneCode, EnduranceZoneDefinition>>;
}

export type EndurancePlanConfiguration<
  Modality extends EnduranceModality = EnduranceModality,
> = {
  readonly modality: Modality;
  readonly primaryObjective: string;
  readonly currentLevel: string;
  readonly startDate: string;
  readonly cycleDurationWeeks: number;
  readonly availableWeekdays: readonly WorkoutWeekday[];
  readonly environment: EnduranceEnvironment<Modality>;
  readonly primaryUnit: EndurancePrimaryUnit;
  readonly primaryIntensityMethod: EnduranceIntensityMethod;
  readonly athleteReferenceData?: EnduranceAthleteReferenceData;
  readonly zoneProfile?: EnduranceZoneProfile;
} & (Modality extends "RUNNING"
  ? {
      readonly generalObservation?: string;
      readonly testGoal?: RunningTestGoal;
      readonly weeklyFrequency?: number;
    }
  : {
      readonly generalObservation: string;
      readonly weeklyFrequency: number;
    });

export const ENDURANCE_PRESCRIPTION_STATUSES = [
  "PLANNED",
  "SCHEDULED",
  "CANCELLED",
] as const;

export type EndurancePrescriptionStatus =
  (typeof ENDURANCE_PRESCRIPTION_STATUSES)[number];

export interface EnduranceSessionBase<
  Modality extends EnduranceModality = EnduranceModality,
> {
  readonly id: string;
  readonly modality: Modality;
  readonly title: string;
  readonly scheduledDate: string;
  readonly weekday?: WorkoutWeekday;
  readonly sessionType: string;
  readonly objective: string;
  readonly environment: EnduranceEnvironment<Modality>;
  readonly primaryUnit: EndurancePrimaryUnit;
  readonly primaryIntensityMethod: EnduranceIntensityMethod;
  readonly estimatedDurationSeconds?: number;
  readonly estimatedDistanceMeters?: number;
  readonly professionalGuidance: string;
  readonly status: EndurancePrescriptionStatus;
}

export type SimpleEndurancePrescription =
  | {
      readonly completionType: "TIME";
      readonly durationSeconds: number;
      readonly intensityTarget: EnduranceIntensityTarget;
      readonly guidance: string;
    }
  | {
      readonly completionType: "DISTANCE";
      readonly distanceMeters: number;
      readonly intensityTarget: EnduranceIntensityTarget;
      readonly guidance: string;
    };

export interface SimpleEnduranceSession extends EnduranceSessionBase {
  readonly sessionKind: "SIMPLE";
  readonly prescription: SimpleEndurancePrescription;
}

export const ENDURANCE_STAGE_TYPES = [
  "WARM_UP",
  "PREPARATION",
  "WORK",
  "RECOVERY",
  "COOL_DOWN",
  "CUSTOM",
] as const;

export type EnduranceStageType = (typeof ENDURANCE_STAGE_TYPES)[number];

export type EnduranceStageCompletion =
  | {
      readonly type: "TIME";
      readonly durationSeconds: number;
    }
  | {
      readonly type: "DISTANCE";
      readonly distanceMeters: number;
    }
  | {
      readonly type: "OPEN_MANUAL";
    };

export interface EnduranceSessionStage {
  readonly id: string;
  readonly order: number;
  readonly name: string;
  readonly type: EnduranceStageType;
  readonly completion: EnduranceStageCompletion;
  readonly intensityTarget?: EnduranceIntensityTarget;
  readonly studentInstruction: string;
}

export interface EnduranceStageBlock {
  readonly blockType: "STAGE";
  readonly id: string;
  readonly order: number;
  readonly stage: EnduranceSessionStage;
}

export interface EnduranceRepeatBlock {
  readonly blockType: "REPEAT";
  readonly id: string;
  readonly order: number;
  readonly repetitions: number;
  readonly includeRecoveryAfterLast: boolean;
  readonly stages: readonly EnduranceSessionStage[];
}

export type EnduranceSessionBlock =
  | EnduranceStageBlock
  | EnduranceRepeatBlock;

export interface StructuredEnduranceSession extends EnduranceSessionBase {
  readonly sessionKind: "STRUCTURED";
  readonly blocks: readonly EnduranceSessionBlock[];
}

export type EnduranceSession =
  | SimpleEnduranceSession
  | StructuredEnduranceSession;

export interface EnduranceCycleWeek {
  readonly id: string;
  readonly weekNumber: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly phase: string;
  readonly objective: string;
  readonly weeklyGuidance: string;
  readonly plannedDurationSeconds?: number;
  readonly estimatedDistanceMeters?: number;
  readonly plannedSessionCount?: number;
  readonly sessions: readonly EnduranceSession[];
}
