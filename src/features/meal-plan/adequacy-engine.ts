export const NUTRITION_ADEQUACY_METRICS = [
  "energyKcal",
  "proteinGrams",
  "carbohydratesGrams",
  "fatsGrams",
  "fiberGrams",
  "waterMl",
] as const;

export const FUTURE_NUTRITION_ADEQUACY_METRICS = [
  "vitamins",
  "minerals",
  "sodiumMg",
  "cholesterolMg",
  "saturatedFatsGrams",
  "transFatsGrams",
  "glycemicIndex",
  "glycemicLoad",
] as const;

export type NutritionAdequacyMetric =
  (typeof NUTRITION_ADEQUACY_METRICS)[number];
export type NutritionAdequacyStatus =
  | "ADEQUATE"
  | "NEAR_TARGET"
  | "OUTSIDE_TARGET";

export type NutritionAdequacyValues = Readonly<
  Record<NutritionAdequacyMetric, number>
>;

export const FINAL_NUTRITION_TARGET_METRICS = [
  "energyKcal",
  "proteinGrams",
  "carbohydratesGrams",
  "fatsGrams",
] as const satisfies readonly NutritionAdequacyMetric[];

export type FinalNutritionTargetMetric =
  (typeof FINAL_NUTRITION_TARGET_METRICS)[number];
export type FinalNutritionTargetValues = Readonly<
  Record<FinalNutritionTargetMetric, number>
>;

export interface NutritionAdequacyThreshold {
  readonly adequateMaximumDeviationPercent: number;
  readonly nearTargetMaximumDeviationPercent: number;
}

export type NutritionAdequacyThresholds = Readonly<
  Record<NutritionAdequacyMetric, NutritionAdequacyThreshold>
>;

export interface NutritionAdequacyMetricResult {
  readonly target: number;
  readonly actual: number;
  readonly absoluteDifference: number;
  readonly percentageDifference: number;
  readonly adherencePercent: number;
  readonly status: NutritionAdequacyStatus;
}

export interface NutritionAdequacyResult {
  readonly overallAdherencePercent: number;
  readonly overallStatus: NutritionAdequacyStatus;
  readonly metrics: Readonly<
    Record<NutritionAdequacyMetric, NutritionAdequacyMetricResult>
  >;
  readonly needsAdjustment: readonly NutritionAdequacyMetric[];
  readonly thresholds: NutritionAdequacyThresholds;
  readonly updatedAt: string;
  readonly calculationVersion: 1;
}

export const FINAL_NUTRITION_TARGET_TOLERANCE_PERCENT = 5;
export const FINAL_NUTRITION_TARGET_TOLERANCE_ORIGIN =
  "Regra de adequação do Plano Alimentar (cálculo v1, vigente desde 27/07/2026)";

const defaultThreshold = {
  adequateMaximumDeviationPercent: FINAL_NUTRITION_TARGET_TOLERANCE_PERCENT,
  nearTargetMaximumDeviationPercent: 10,
} as const;

export const DEFAULT_NUTRITION_ADEQUACY_THRESHOLDS =
  Object.fromEntries(
    NUTRITION_ADEQUACY_METRICS.map((metric) => [
      metric,
      defaultThreshold,
    ]),
  ) as unknown as NutritionAdequacyThresholds;

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function statusForDeviation(
  absolutePercentageDifference: number,
  threshold: NutritionAdequacyThreshold,
): NutritionAdequacyStatus {
  if (
    absolutePercentageDifference <=
    threshold.adequateMaximumDeviationPercent
  ) {
    return "ADEQUATE";
  }
  return absolutePercentageDifference <=
    threshold.nearTargetMaximumDeviationPercent
    ? "NEAR_TARGET"
    : "OUTSIDE_TARGET";
}

function metricResult(
  target: number,
  actual: number,
  threshold: NutritionAdequacyThreshold,
  minimumOnly = false,
): NutritionAdequacyMetricResult {
  const signedDifference = actual - target;
  const percentageDifference =
    target > 0 ? (signedDifference / target) * 100 : actual === 0 ? 0 : 100;
  const absolutePercentageDifference = minimumOnly && percentageDifference >= 0
    ? 0
    : Math.abs(percentageDifference);

  return {
    target: round(target),
    actual: round(actual),
    absoluteDifference: round(Math.abs(signedDifference)),
    percentageDifference: round(percentageDifference),
    adherencePercent: round(Math.max(0, 100 - absolutePercentageDifference)),
    status: statusForDeviation(
      absolutePercentageDifference,
      threshold,
    ),
  };
}

export function nutritionTargetsOutsideTolerance(input: {
  readonly target: FinalNutritionTargetValues;
  readonly actual: FinalNutritionTargetValues;
}) {
  return FINAL_NUTRITION_TARGET_METRICS.filter(
    (metric) =>
      metricResult(
        input.target[metric],
        input.actual[metric],
        defaultThreshold,
      ).status !== "ADEQUATE",
  );
}

export function canFinalizeMealPlanNutrition(input: {
  readonly target: FinalNutritionTargetValues;
  readonly actual: FinalNutritionTargetValues;
}) {
  return nutritionTargetsOutsideTolerance(input).length === 0;
}

export function calculateNutritionAdequacy(input: {
  readonly target: NutritionAdequacyValues;
  readonly actual: NutritionAdequacyValues;
  readonly thresholds?: NutritionAdequacyThresholds;
  readonly updatedAt?: string;
}): NutritionAdequacyResult {
  const thresholds =
    input.thresholds ?? DEFAULT_NUTRITION_ADEQUACY_THRESHOLDS;
  const metrics = Object.fromEntries(
    NUTRITION_ADEQUACY_METRICS.map((metric) => [
      metric,
      metricResult(
        input.target[metric],
        input.actual[metric],
        thresholds[metric],
        metric === "fiberGrams",
      ),
    ]),
  ) as unknown as NutritionAdequacyResult["metrics"];
  const overallAdherencePercent = round(
    NUTRITION_ADEQUACY_METRICS.reduce(
      (sum, metric) => sum + metrics[metric].adherencePercent,
      0,
    ) / NUTRITION_ADEQUACY_METRICS.length,
    1,
  );
  const needsAdjustment = NUTRITION_ADEQUACY_METRICS.filter(
    (metric) => metrics[metric].status !== "ADEQUATE",
  );

  return {
    overallAdherencePercent,
    overallStatus: statusForDeviation(
      100 - overallAdherencePercent,
      defaultThreshold,
    ),
    metrics,
    needsAdjustment,
    thresholds,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    calculationVersion: 1,
  };
}
