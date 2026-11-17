import type { NutritionStrategyMealAllocation } from "./strategy-record";

const STANDARD_MEAL_NAMES: Readonly<Record<number, readonly string[]>> = {
  1: ["Refeição"],
  2: ["Desjejum", "Jantar"],
  3: ["Desjejum", "Almoço", "Jantar"],
  4: ["Desjejum", "Almoço", "Lanche da tarde", "Jantar"],
  5: ["Desjejum", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar"],
  6: [
    "Desjejum",
    "Lanche da manhã",
    "Almoço",
    "Lanche da tarde",
    "Jantar",
    "Ceia",
  ],
};

export function resolveMealScheduleName(
  mealCount: number,
  mealNumber: number,
  storedName: string,
) {
  const normalizedStoredName = storedName.trim();
  const meaningfulStoredName = /^refei[cç][aã]o\s+\d+$/iu.test(
    normalizedStoredName,
  )
    ? ""
    : normalizedStoredName;
  return (
    meaningfulStoredName ||
    STANDARD_MEAL_NAMES[mealCount]?.[mealNumber - 1] ||
    `Refeição ${mealNumber}`
  );
}

export function presentMealSchedules(
  meals: readonly NutritionStrategyMealAllocation[],
) {
  return meals.map((meal) => ({
    ...meal,
    name: resolveMealScheduleName(meals.length, meal.mealNumber, meal.name),
  }));
}

export function mealScheduleCorrectionHref(
  patientId: string,
  attendanceId: string,
) {
  return `/pacientes/${encodeURIComponent(patientId)}/estrategia-nutricional?attendanceId=${encodeURIComponent(attendanceId)}&section=daily-distribution&returnTo=meal-plan#daily-meal-distribution`;
}
