import { z } from "zod";

import {
  ENDURANCE_INTENSITY_METHODS,
  ENDURANCE_MODALITIES,
  ENDURANCE_PRESCRIPTION_STATUSES,
  ENDURANCE_PRIMARY_UNITS,
  ENDURANCE_STAGE_TYPES,
  ENDURANCE_ZONE_PROFILE_SOURCES,
  RUNNING_ENVIRONMENTS,
  type CyclingEnvironment,
  type EnduranceAthleteReferenceData,
  type EnduranceCycleWeek,
  type EnduranceIntensityTarget,
  type EnduranceNumericTarget,
  type EndurancePlanConfiguration,
  type EnduranceRecentPerformanceReference,
  type EnduranceRepeatBlock,
  type EnduranceSession,
  type EnduranceSessionBase,
  type EnduranceSessionBlock,
  type EnduranceSessionStage,
  type EnduranceStageBlock,
  type EnduranceStageCompletion,
  type EnduranceWeeklyVolumeReference,
  type EnduranceZoneDefinition,
  type EnduranceZoneProfile,
  type RunningEnvironment,
  type RunningTestGoal,
  type SimpleEndurancePrescription,
  type SimpleEnduranceSession,
  type StructuredEnduranceSession,
} from "./endurance-workout-contracts";
import type { WorkoutWeekday } from "./workout-contracts";

const requiredText = z.string().trim().min(1).max(5_000);
const optionalText = requiredText.optional();
const finiteNumber = z.number().finite();
const positiveNumber = finiteNumber.positive();
const positiveInteger = positiveNumber.int();
const rpeNumber = finiteNumber.min(0).max(10);
const isoDate = z.iso.date();
const isoDateTime = z.iso.datetime({ offset: true });

const workoutWeekdays = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const satisfies readonly WorkoutWeekday[];

const cyclingEnvironments = [
  "ROAD",
  "TRACK",
  "TRAIL",
  "MIXED",
  "OTHER",
] as const satisfies readonly CyclingEnvironment[];

function addRangeIssue(
  minimum: number | undefined,
  maximum: number | undefined,
  path: string,
  context: z.RefinementCtx,
) {
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    context.addIssue({
      code: "custom",
      path: [path],
      message: "O valor mínimo não pode ser maior que o valor máximo.",
    });
  }
}

const singleNumericTargetSchema = z.strictObject({
  valueType: z.literal("SINGLE"),
  value: finiteNumber,
});

const rangeNumericTargetSchema = z
  .strictObject({
    valueType: z.literal("RANGE"),
    minimum: finiteNumber,
    maximum: finiteNumber,
  })
  .superRefine((range, context) => {
    addRangeIssue(range.minimum, range.maximum, "maximum", context);
  });

export const enduranceNumericTargetSchema: z.ZodType<EnduranceNumericTarget> =
  z.discriminatedUnion("valueType", [
    singleNumericTargetSchema,
    rangeNumericTargetSchema,
  ]);

const positiveSingleNumericTargetSchema = z.strictObject({
  valueType: z.literal("SINGLE"),
  value: positiveNumber,
});

const positiveRangeNumericTargetSchema = z
  .strictObject({
    valueType: z.literal("RANGE"),
    minimum: positiveNumber,
    maximum: positiveNumber,
  })
  .superRefine((range, context) => {
    addRangeIssue(range.minimum, range.maximum, "maximum", context);
  });

const positiveNumericTargetSchema: z.ZodType<EnduranceNumericTarget> =
  z.discriminatedUnion("valueType", [
    positiveSingleNumericTargetSchema,
    positiveRangeNumericTargetSchema,
  ]);

const rpeSingleTargetSchema = z.strictObject({
  valueType: z.literal("SINGLE"),
  value: rpeNumber,
});

const rpeRangeTargetSchema = z
  .strictObject({
    valueType: z.literal("RANGE"),
    minimum: rpeNumber,
    maximum: rpeNumber,
  })
  .superRefine((range, context) => {
    addRangeIssue(range.minimum, range.maximum, "maximum", context);
  });

export const enduranceRpeTargetSchema = z.strictObject({
  type: z.literal("RPE"),
  unit: z.literal("RPE"),
  target: z.discriminatedUnion("valueType", [
    rpeSingleTargetSchema,
    rpeRangeTargetSchema,
  ]),
});

export const enduranceNoIntensityTargetSchema = z.strictObject({
  type: z.literal("NONE"),
});

export const enduranceHeartRateTargetSchema = z.strictObject({
  type: z.literal("HEART_RATE"),
  unit: z.literal("BEATS_PER_MINUTE"),
  target: positiveNumericTargetSchema,
});

export const endurancePaceTargetSchema = z.strictObject({
  type: z.literal("PACE"),
  unit: z.literal("SECONDS_PER_KILOMETER"),
  target: positiveNumericTargetSchema,
  preferredDisplay: z.enum(["PACE", "SPEED"]).optional(),
});

export const endurancePowerTargetSchema = z.strictObject({
  type: z.literal("POWER"),
  unit: z.literal("WATTS"),
  target: positiveNumericTargetSchema,
});

export const enduranceCadenceTargetSchema = z.strictObject({
  type: z.literal("CADENCE"),
  unit: z.enum(["STEPS_PER_MINUTE", "REVOLUTIONS_PER_MINUTE"]),
  target: positiveNumericTargetSchema,
});

export const enduranceFreeGuidanceTargetSchema = z.strictObject({
  type: z.literal("FREE_GUIDANCE"),
  guidance: requiredText,
});

export const enduranceIntensityTargetSchema: z.ZodType<EnduranceIntensityTarget> =
  z.discriminatedUnion("type", [
    enduranceNoIntensityTargetSchema,
    enduranceRpeTargetSchema,
    enduranceHeartRateTargetSchema,
    endurancePaceTargetSchema,
    endurancePowerTargetSchema,
    enduranceCadenceTargetSchema,
    enduranceFreeGuidanceTargetSchema,
  ]);

export const enduranceModalitySchema = z.enum(ENDURANCE_MODALITIES);
export const endurancePrimaryUnitSchema = z.enum(ENDURANCE_PRIMARY_UNITS);
export const enduranceIntensityMethodSchema = z.enum(
  ENDURANCE_INTENSITY_METHODS,
);
export const runningEnvironmentSchema: z.ZodType<RunningEnvironment> = z.enum(
  RUNNING_ENVIRONMENTS,
);
export const cyclingEnvironmentSchema: z.ZodType<CyclingEnvironment> = z.enum(
  cyclingEnvironments,
);
export const enduranceEnvironmentSchema = z.union([
  runningEnvironmentSchema,
  cyclingEnvironmentSchema,
]);
export const endurancePrescriptionStatusSchema = z.enum(
  ENDURANCE_PRESCRIPTION_STATUSES,
);
export const enduranceStageTypeSchema = z.enum(ENDURANCE_STAGE_TYPES);
export const enduranceZoneProfileSourceSchema = z.enum(
  ENDURANCE_ZONE_PROFILE_SOURCES,
);

export const enduranceWeeklyVolumeReferenceSchema: z.ZodType<EnduranceWeeklyVolumeReference> =
  z.discriminatedUnion("unit", [
    z.strictObject({
      unit: z.literal("TIME"),
      durationSeconds: positiveNumber,
    }),
    z.strictObject({
      unit: z.literal("DISTANCE"),
      distanceMeters: positiveNumber,
    }),
  ]);

export const enduranceRecentPerformanceReferenceSchema: z.ZodType<EnduranceRecentPerformanceReference> =
  z.strictObject({
    distanceMeters: positiveNumber,
    durationSeconds: positiveNumber,
    recordedAt: isoDateTime.optional(),
    sourceExecutionId: z.string().uuid().optional(),
    source: optionalText,
    sourceProvider: optionalText,
  });

export const runningTestGoalSchema: z.ZodType<RunningTestGoal> =
  z.strictObject({
    requiredDistanceMeters: positiveNumber,
    targetDurationSeconds: positiveNumber,
    testDate: isoDate,
  });

export const enduranceAthleteReferenceDataSchema: z.ZodType<EnduranceAthleteReferenceData> =
  z.strictObject({
    comfortableContinuousDurationSeconds: positiveNumber.optional(),
    currentContinuousDistanceMeters: positiveNumber.optional(),
    longestRecentDistanceMeters: positiveNumber.optional(),
    recentPerformance: enduranceRecentPerformanceReferenceSchema.optional(),
    comfortablePaceSecondsPerKilometer: positiveNumber.optional(),
    restingHeartRateBpm: positiveNumber.optional(),
    knownMaximumHeartRateBpm: positiveNumber.optional(),
    thresholdHeartRateBpm: positiveNumber.optional(),
    habitualRpe: rpeNumber.optional(),
    currentWeeklyVolume: enduranceWeeklyVolumeReferenceSchema.optional(),
    recentHistory: optionalText,
    updatedAt: isoDateTime.optional(),
  });

export const enduranceZoneDefinitionSchema: z.ZodType<EnduranceZoneDefinition> =
  z
    .strictObject({
      name: optionalText,
      minimumHeartRateBpm: positiveNumber.optional(),
      maximumHeartRateBpm: positiveNumber.optional(),
      minimumPaceSecondsPerKilometer: positiveNumber.optional(),
      maximumPaceSecondsPerKilometer: positiveNumber.optional(),
      minimumPowerWatts: positiveNumber.optional(),
      maximumPowerWatts: positiveNumber.optional(),
      minimumRpe: rpeNumber.optional(),
      maximumRpe: rpeNumber.optional(),
      sensationAndBreathingGuidance: optionalText,
    })
    .superRefine((zone, context) => {
      addRangeIssue(
        zone.minimumHeartRateBpm,
        zone.maximumHeartRateBpm,
        "maximumHeartRateBpm",
        context,
      );
      addRangeIssue(
        zone.minimumPaceSecondsPerKilometer,
        zone.maximumPaceSecondsPerKilometer,
        "maximumPaceSecondsPerKilometer",
        context,
      );
      addRangeIssue(
        zone.minimumPowerWatts,
        zone.maximumPowerWatts,
        "maximumPowerWatts",
        context,
      );
      addRangeIssue(
        zone.minimumRpe,
        zone.maximumRpe,
        "maximumRpe",
        context,
      );
    });

export const enduranceZoneProfileSchema: z.ZodType<EnduranceZoneProfile> =
  z.strictObject({
    source: enduranceZoneProfileSourceSchema,
    assessedAt: isoDate,
    zones: z.strictObject({
      Z1: enduranceZoneDefinitionSchema,
      Z2: enduranceZoneDefinitionSchema,
      Z3: enduranceZoneDefinitionSchema,
      Z4: enduranceZoneDefinitionSchema,
      Z5: enduranceZoneDefinitionSchema,
    }),
  });

const endurancePlanConfigurationShape = {
  primaryObjective: requiredText,
  currentLevel: requiredText,
  startDate: isoDate,
  cycleDurationWeeks: positiveInteger,
  availableWeekdays: z.array(z.enum(workoutWeekdays)).max(7),
  primaryUnit: endurancePrimaryUnitSchema,
  primaryIntensityMethod: enduranceIntensityMethodSchema,
  athleteReferenceData: enduranceAthleteReferenceDataSchema.optional(),
  zoneProfile: enduranceZoneProfileSchema.optional(),
};

export const runningPlanConfigurationSchema = z
  .strictObject({
    ...endurancePlanConfigurationShape,
    modality: z.literal("RUNNING"),
    environment: runningEnvironmentSchema,
    weeklyFrequency: positiveInteger.optional(),
    generalObservation: requiredText.optional(),
    testGoal: runningTestGoalSchema.optional(),
  }) satisfies z.ZodType<EndurancePlanConfiguration<"RUNNING">>;

export const cyclingPlanConfigurationSchema = z
  .strictObject({
    ...endurancePlanConfigurationShape,
    modality: z.literal("CYCLING"),
    environment: cyclingEnvironmentSchema,
    weeklyFrequency: positiveInteger,
    generalObservation: requiredText,
  }) satisfies z.ZodType<EndurancePlanConfiguration<"CYCLING">>;

export const endurancePlanConfigurationSchema = z.discriminatedUnion(
  "modality",
  [runningPlanConfigurationSchema, cyclingPlanConfigurationSchema],
) satisfies z.ZodType<EndurancePlanConfiguration>;

export const enduranceStageCompletionSchema: z.ZodType<EnduranceStageCompletion> =
  z.discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("TIME"),
      durationSeconds: positiveNumber,
    }),
    z.strictObject({
      type: z.literal("DISTANCE"),
      distanceMeters: positiveNumber,
    }),
    z.strictObject({
      type: z.literal("OPEN_MANUAL"),
    }),
  ]);

export const enduranceSessionStageSchema: z.ZodType<EnduranceSessionStage> =
  z.strictObject({
    id: z.string().uuid(),
    order: positiveInteger,
    name: requiredText,
    type: enduranceStageTypeSchema,
    completion: enduranceStageCompletionSchema,
    intensityTarget: enduranceIntensityTargetSchema.optional(),
    studentInstruction: requiredText,
  });

export const enduranceStageBlockSchema = z
  .strictObject({
    blockType: z.literal("STAGE"),
    id: z.string().uuid(),
    order: positiveInteger,
    stage: enduranceSessionStageSchema,
  }) satisfies z.ZodType<EnduranceStageBlock>;

export const enduranceRepeatBlockSchema = z
  .strictObject({
    blockType: z.literal("REPEAT"),
    id: z.string().uuid(),
    order: positiveInteger,
    repetitions: positiveInteger,
    includeRecoveryAfterLast: z.boolean().default(false),
    stages: z.array(enduranceSessionStageSchema).min(1),
  }) satisfies z.ZodType<EnduranceRepeatBlock>;

export const enduranceSessionBlockSchema = z.discriminatedUnion("blockType", [
    enduranceStageBlockSchema,
    enduranceRepeatBlockSchema,
  ]) satisfies z.ZodType<EnduranceSessionBlock>;

export const simpleEndurancePrescriptionSchema: z.ZodType<SimpleEndurancePrescription> =
  z.discriminatedUnion("completionType", [
    z.strictObject({
      completionType: z.literal("TIME"),
      durationSeconds: positiveNumber,
      intensityTarget: enduranceIntensityTargetSchema,
      guidance: requiredText,
    }),
    z.strictObject({
      completionType: z.literal("DISTANCE"),
      distanceMeters: positiveNumber,
      intensityTarget: enduranceIntensityTargetSchema,
      guidance: requiredText,
    }),
  ]);

const enduranceSessionBaseShape = {
  id: z.string().uuid(),
  title: requiredText,
  scheduledDate: isoDate,
  weekday: z.enum(workoutWeekdays).optional(),
  sessionType: requiredText,
  objective: requiredText,
  primaryUnit: endurancePrimaryUnitSchema,
  primaryIntensityMethod: enduranceIntensityMethodSchema,
  estimatedDurationSeconds: positiveNumber.optional(),
  estimatedDistanceMeters: positiveNumber.optional(),
  professionalGuidance: requiredText,
  status: endurancePrescriptionStatusSchema,
};

export const runningEnduranceSessionBaseSchema = z
  .strictObject({
    ...enduranceSessionBaseShape,
    modality: z.literal("RUNNING"),
    environment: runningEnvironmentSchema,
  }) satisfies z.ZodType<EnduranceSessionBase<"RUNNING">>;

export const cyclingEnduranceSessionBaseSchema = z
  .strictObject({
    ...enduranceSessionBaseShape,
    modality: z.literal("CYCLING"),
    environment: cyclingEnvironmentSchema,
  }) satisfies z.ZodType<EnduranceSessionBase<"CYCLING">>;

export const enduranceSessionBaseSchema = z.discriminatedUnion("modality", [
  runningEnduranceSessionBaseSchema,
  cyclingEnduranceSessionBaseSchema,
]) satisfies z.ZodType<EnduranceSessionBase>;

const runningSimpleEnduranceSessionSchema = z.strictObject({
  ...runningEnduranceSessionBaseSchema.shape,
  sessionKind: z.literal("SIMPLE"),
  prescription: simpleEndurancePrescriptionSchema,
});

const cyclingSimpleEnduranceSessionSchema = z.strictObject({
  ...cyclingEnduranceSessionBaseSchema.shape,
  sessionKind: z.literal("SIMPLE"),
  prescription: simpleEndurancePrescriptionSchema,
});

export const simpleEnduranceSessionSchema = z.union([
  runningSimpleEnduranceSessionSchema,
  cyclingSimpleEnduranceSessionSchema,
]) satisfies z.ZodType<SimpleEnduranceSession>;

const runningStructuredEnduranceSessionSchema = z.strictObject({
  ...runningEnduranceSessionBaseSchema.shape,
  sessionKind: z.literal("STRUCTURED"),
  blocks: z.array(enduranceSessionBlockSchema).min(1),
});

const cyclingStructuredEnduranceSessionSchema = z.strictObject({
  ...cyclingEnduranceSessionBaseSchema.shape,
  sessionKind: z.literal("STRUCTURED"),
  blocks: z.array(enduranceSessionBlockSchema).min(1),
});

export const structuredEnduranceSessionSchema = z.union([
  runningStructuredEnduranceSessionSchema,
  cyclingStructuredEnduranceSessionSchema,
]) satisfies z.ZodType<StructuredEnduranceSession>;

export const enduranceSessionSchema = z.union([
  runningSimpleEnduranceSessionSchema,
  runningStructuredEnduranceSessionSchema,
  cyclingSimpleEnduranceSessionSchema,
  cyclingStructuredEnduranceSessionSchema,
]) satisfies z.ZodType<EnduranceSession>;

export const enduranceCycleWeekSchema: z.ZodType<EnduranceCycleWeek> = z
  .strictObject({
    id: z.string().uuid(),
    weekNumber: positiveInteger,
    startDate: isoDate,
    endDate: isoDate,
    phase: requiredText,
    objective: requiredText,
    weeklyGuidance: requiredText,
    plannedDurationSeconds: positiveNumber.optional(),
    estimatedDistanceMeters: positiveNumber.optional(),
    plannedSessionCount: positiveInteger.optional(),
    sessions: z.array(enduranceSessionSchema),
  })
  .superRefine((week, context) => {
    if (week.startDate > week.endDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "A data inicial não pode ser posterior à data final.",
      });
    }
  });
