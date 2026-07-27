export const MACRONUTRIENT_KCAL_PER_GRAM = {
  carbohydrates: 4,
  protein: 4,
  fats: 9,
} as const;

export type MacronutrientKey = keyof typeof MACRONUTRIENT_KCAL_PER_GRAM;
export type MacronutrientInputMode =
  | "GRAMS_PER_KG"
  | "PERCENTAGE"
  | "GRAMS";
export type MacroAdequacyStatus = "ADEQUATE" | "NEAR_TARGET" | "OUTSIDE_TARGET";

/**
 * Tolerância operacional da Estratégia Nutricional:
 * até 2% da meta é adequado; acima de 2% e até 5% é próximo da meta.
 * A diferença não bloqueia a edição, apenas classifica a distribuição.
 */
export const MACRO_CALORIE_TOLERANCE = {
  adequatePercent: 2,
  nearTargetPercent: 5,
} as const;

export interface MacronutrientCalculation {
  readonly gramsPerKg?: number;
  readonly grams: number;
  readonly kcal: number;
  readonly percentage: number;
}

export interface MacroDistributionValidation {
  readonly plannedCalories: number;
  readonly calculatedCalories: number;
  readonly differenceKcal: number;
  readonly differencePercent: number;
  readonly percentageTotal: number;
  readonly status: MacroAdequacyStatus;
}

function positive(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function nonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculateMacronutrient(
  macronutrient: MacronutrientKey,
  mode: MacronutrientInputMode,
  value: number,
  finalCalories: number,
  weightKg: number | undefined,
): MacronutrientCalculation | undefined {
  if (!positive(value) || !positive(finalCalories)) return undefined;

  const kcalPerGram = MACRONUTRIENT_KCAL_PER_GRAM[macronutrient];
  let grams: number | undefined;

  if (mode === "GRAMS") grams = value;
  if (mode === "PERCENTAGE") {
    grams = (finalCalories * (value / 100)) / kcalPerGram;
  }
  if (mode === "GRAMS_PER_KG" && positive(weightKg)) {
    grams = value * weightKg;
  }

  if (!positive(grams)) return undefined;

  const kcal = grams * kcalPerGram;
  return {
    gramsPerKg: positive(weightKg) ? grams / weightKg : undefined,
    grams,
    kcal,
    percentage: (kcal / finalCalories) * 100,
  };
}

export function calculateCarbohydratesByDifference(
  finalCalories: number,
  proteinKcal: number,
  fatsKcal: number,
  weightKg: number | undefined,
): MacronutrientCalculation | undefined {
  if (!positive(finalCalories)) return undefined;
  const remainingCalories = finalCalories - nonNegative(proteinKcal) - nonNegative(fatsKcal);
  if (!positive(remainingCalories)) return undefined;

  return calculateMacronutrient(
    "carbohydrates",
    "GRAMS",
    remainingCalories / MACRONUTRIENT_KCAL_PER_GRAM.carbohydrates,
    finalCalories,
    weightKg,
  );
}

export function validateMacroDistribution(
  finalCalories: number,
  macros: readonly (MacronutrientCalculation | undefined)[],
): MacroDistributionValidation | undefined {
  if (!positive(finalCalories) || macros.some((macro) => !macro)) {
    return undefined;
  }

  const completeMacros = macros as readonly MacronutrientCalculation[];
  const calculatedCalories = completeMacros.reduce(
    (total, macro) => total + macro.kcal,
    0,
  );
  const differenceKcal = calculatedCalories - finalCalories;
  const differencePercent = (differenceKcal / finalCalories) * 100;
  const absoluteDifferencePercent = Math.abs(differencePercent);
  const status =
    absoluteDifferencePercent <= MACRO_CALORIE_TOLERANCE.adequatePercent
      ? "ADEQUATE"
      : absoluteDifferencePercent <= MACRO_CALORIE_TOLERANCE.nearTargetPercent
        ? "NEAR_TARGET"
        : "OUTSIDE_TARGET";

  return {
    plannedCalories: finalCalories,
    calculatedCalories,
    differenceKcal,
    differencePercent,
    percentageTotal: completeMacros.reduce(
      (total, macro) => total + macro.percentage,
      0,
    ),
    status,
  };
}
