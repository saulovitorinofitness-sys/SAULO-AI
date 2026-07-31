import assert from "node:assert/strict";
import test from "node:test";

import { detectPrescriptionChanges } from "./prescription-history";
import type {
  MealPlanRecordDraft,
  MealPlanRecordFood,
  MealPlanRecordMeal,
} from "./record";

function food(
  id: string,
  catalogFoodId: string,
  description: string,
  grams: number,
  householdMeasure = "colher",
  quantity = 1,
) {
  return {
    id,
    catalogFoodId,
    description,
    grams,
    householdMeasure,
    quantity,
  } as MealPlanRecordFood;
}

function meal(
  id: string,
  name: string,
  time: string,
  items: readonly MealPlanRecordFood[],
) {
  return { id, name, time, order: 1, items } as MealPlanRecordMeal;
}

test("detecta todas as ações clínicas auditáveis entre duas prescrições", () => {
  const current = {
    meals: [
      meal("meal-1", "Almoço", "12:00", [
        food("food-1", "rice", "Arroz", 100),
        food("food-2", "beans", "Feijão", 80),
      ]),
    ],
    supplements: [{ id: "supplement-1", description: "Creatina" }],
  } satisfies Pick<MealPlanRecordDraft, "meals" | "supplements">;
  const next = {
    meals: [
      meal("meal-1", "Almoço", "12:30", [
        food("food-1", "potato", "Batata", 120, "unidade", 2),
        food("food-3", "chicken", "Frango", 150),
      ]),
    ],
    supplements: [{ id: "supplement-2", description: "Vitamina D" }],
  } satisfies Pick<MealPlanRecordDraft, "meals" | "supplements">;

  const changes = detectPrescriptionChanges(current, next);
  assert.deepEqual(
    changes.map((change) => change.type).sort(),
    [
      "FOOD_ADDED",
      "FOOD_REMOVED",
      "FOOD_SUBSTITUTED",
      "GRAMS_CHANGED",
      "MEASURE_CHANGED",
      "SUPPLEMENT_ADDED",
      "SUPPLEMENT_REMOVED",
      "TIME_CHANGED",
    ].sort(),
  );
  assert.ok(
    changes.every(
      (change) =>
        change.previousValue !== null || change.currentValue !== null,
    ),
  );
});

