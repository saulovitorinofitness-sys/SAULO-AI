import type {
  MealPlanRecordDraft,
  MealPlanRecordFood,
  MealPlanRecordMeal,
  MealPlanRecordSupplement,
} from "./record";

export const PRESCRIPTION_ACTION_TYPES = [
  "FOOD_ADDED",
  "FOOD_REMOVED",
  "FOOD_SUBSTITUTED",
  "GRAMS_CHANGED",
  "MEASURE_CHANGED",
  "TIME_CHANGED",
  "SUPPLEMENT_ADDED",
  "SUPPLEMENT_REMOVED",
] as const;

export type PrescriptionActionType =
  (typeof PRESCRIPTION_ACTION_TYPES)[number];

export const PRESCRIPTION_ACTION_LABELS: Record<
  PrescriptionActionType,
  string
> = {
  FOOD_ADDED: "Alimento adicionado",
  FOOD_REMOVED: "Alimento removido",
  FOOD_SUBSTITUTED: "Alimento substituído",
  GRAMS_CHANGED: "Gramagem alterada",
  MEASURE_CHANGED: "Medida alterada",
  TIME_CHANGED: "Horário alterado",
  SUPPLEMENT_ADDED: "Suplementação incluída",
  SUPPLEMENT_REMOVED: "Suplementação removida",
};

export interface PrescriptionChange {
  readonly type: PrescriptionActionType;
  readonly previousValue: string | null;
  readonly currentValue: string | null;
}

export interface PrescriptionHistoryEntry extends PrescriptionChange {
  readonly id: string;
  readonly occurredAt: string;
  readonly professionalUserId: string;
  readonly professionalName: string;
  readonly clinicalJustification?: string;
}

function foodValue(meal: MealPlanRecordMeal, food: MealPlanRecordFood) {
  return `${food.description} · ${food.grams} g · ${food.quantity} ${food.householdMeasure} · ${meal.name}`;
}

function supplementValue(supplement: MealPlanRecordSupplement) {
  return supplement.description;
}

function mealMap(meals: readonly MealPlanRecordMeal[]) {
  return new Map(meals.map((meal) => [meal.id, meal]));
}

function foodMap(meals: readonly MealPlanRecordMeal[]) {
  return new Map(
    meals.flatMap((meal) =>
      meal.items.map((food) => [food.id, { meal, food }] as const),
    ),
  );
}

function supplementMap(supplements: readonly MealPlanRecordSupplement[]) {
  return new Map(supplements.map((supplement) => [supplement.id, supplement]));
}

export function detectPrescriptionChanges(
  current: Pick<MealPlanRecordDraft, "meals" | "supplements">,
  next: Pick<MealPlanRecordDraft, "meals" | "supplements">,
): readonly PrescriptionChange[] {
  const changes: PrescriptionChange[] = [];
  const currentMeals = mealMap(current.meals);
  const nextMeals = mealMap(next.meals);
  const currentFoods = foodMap(current.meals);
  const nextFoods = foodMap(next.meals);

  for (const [foodId, { meal, food }] of currentFoods) {
    const nextFood = nextFoods.get(foodId);
    if (!nextFood) {
      changes.push({
        type: "FOOD_REMOVED",
        previousValue: foodValue(meal, food),
        currentValue: null,
      });
      continue;
    }
    if (food.catalogFoodId !== nextFood.food.catalogFoodId) {
      changes.push({
        type: "FOOD_SUBSTITUTED",
        previousValue: foodValue(meal, food),
        currentValue: foodValue(nextFood.meal, nextFood.food),
      });
    }
    if (food.grams !== nextFood.food.grams) {
      changes.push({
        type: "GRAMS_CHANGED",
        previousValue: `${food.description} · ${food.grams} g · ${meal.name}`,
        currentValue: `${nextFood.food.description} · ${nextFood.food.grams} g · ${nextFood.meal.name}`,
      });
    }
    if (
      food.householdMeasure !== nextFood.food.householdMeasure ||
      food.quantity !== nextFood.food.quantity
    ) {
      changes.push({
        type: "MEASURE_CHANGED",
        previousValue: `${food.description} · ${food.quantity} ${food.householdMeasure} · ${meal.name}`,
        currentValue: `${nextFood.food.description} · ${nextFood.food.quantity} ${nextFood.food.householdMeasure} · ${nextFood.meal.name}`,
      });
    }
  }

  for (const [foodId, { meal, food }] of nextFoods) {
    if (!currentFoods.has(foodId)) {
      changes.push({
        type: "FOOD_ADDED",
        previousValue: null,
        currentValue: foodValue(meal, food),
      });
    }
  }

  for (const [mealId, meal] of currentMeals) {
    const nextMeal = nextMeals.get(mealId);
    if (nextMeal && meal.time !== nextMeal.time) {
      changes.push({
        type: "TIME_CHANGED",
        previousValue: `${meal.name} · ${meal.time || "Sem horário"}`,
        currentValue: `${nextMeal.name} · ${nextMeal.time || "Sem horário"}`,
      });
    }
  }
  for (const [mealId, meal] of nextMeals) {
    if (!currentMeals.has(mealId) && meal.time) {
      changes.push({
        type: "TIME_CHANGED",
        previousValue: null,
        currentValue: `${meal.name} · ${meal.time}`,
      });
    }
  }

  const currentSupplements = supplementMap(current.supplements);
  const nextSupplements = supplementMap(next.supplements);
  for (const [id, supplement] of currentSupplements) {
    if (!nextSupplements.has(id)) {
      changes.push({
        type: "SUPPLEMENT_REMOVED",
        previousValue: supplementValue(supplement),
        currentValue: null,
      });
    }
  }
  for (const [id, supplement] of nextSupplements) {
    if (!currentSupplements.has(id)) {
      changes.push({
        type: "SUPPLEMENT_ADDED",
        previousValue: null,
        currentValue: supplementValue(supplement),
      });
    }
  }

  return changes;
}

