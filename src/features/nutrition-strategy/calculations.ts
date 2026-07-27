import type { MacronutrientTarget } from "./contracts";
import {
  calculateMacronutrient,
  MACRONUTRIENT_KCAL_PER_GRAM,
} from "@/lib/nutrition";

export { MACRONUTRIENT_KCAL_PER_GRAM };

export function calculateMacroTarget(
  calories: number,
  percentage: number,
  kcalPerGram: number,
): MacronutrientTarget {
  const result = calculateMacronutrient(
    kcalPerGram === MACRONUTRIENT_KCAL_PER_GRAM.fats
      ? "fats"
      : "carbohydrates",
    "PERCENTAGE",
    percentage,
    calories,
    undefined,
  );

  return {
    percentage: result?.percentage ?? 0,
    grams: Math.round((result?.grams ?? 0) * 10) / 10,
  };
}

export function macroPercentageTotal(values: readonly number[]) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

export function hasValidMacroPercentageTotal(values: readonly number[]) {
  return values.every((value) => Number.isFinite(value) && value >= 0 && value <= 100)
    && Math.abs(macroPercentageTotal(values) - 100) < 0.001;
}
