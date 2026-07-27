import type {
  AssistedMacronutrientValues,
  MealPlanStatus,
} from "./contracts";

export const MEAL_PLAN_TARGET_TOLERANCES = {
  calories: 0.05,
  carbohydratesGrams: 0.05,
  proteinGrams: 0.05,
  fatsGrams: 0.05,
} as const satisfies Readonly<Record<keyof AssistedMacronutrientValues, number>>;

export type MealPlanAdequacyStatus =
  | "WITHIN_TARGET"
  | "BELOW_TARGET"
  | "ABOVE_TARGET";

export interface MealPlanTargetComparison {
  readonly target: number;
  readonly current: number;
  readonly difference: number;
  readonly adequacyPercentage: number;
  readonly status: MealPlanAdequacyStatus;
}

export function compareMealPlanTarget(
  target: number,
  current: number,
  tolerance: number,
): MealPlanTargetComparison {
  const safeTarget = Math.max(0, target);
  const difference = current - safeTarget;
  const adequacyPercentage =
    safeTarget > 0 ? (current / safeTarget) * 100 : current === 0 ? 100 : 0;
  const lowerLimit = safeTarget * (1 - tolerance);
  const upperLimit = safeTarget * (1 + tolerance);
  const status =
    current < lowerLimit
      ? "BELOW_TARGET"
      : current > upperLimit
        ? "ABOVE_TARGET"
        : "WITHIN_TARGET";

  return {
    target: safeTarget,
    current,
    difference,
    adequacyPercentage,
    status,
  };
}

export function mealPlanStatusAfterEdit(status: string): MealPlanStatus {
  return status === "APPROVED" ? "NEEDS_UPDATE" : "DRAFT";
}
