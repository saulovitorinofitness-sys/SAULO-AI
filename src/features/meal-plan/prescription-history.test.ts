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

test("histórico registra quantidade e unidade prescritas sem rotular ml como gramas", () => {
  const previousMilk = {
    ...food("food-milk", "milk", "Leite integral", 140, "100 ml"),
    prescribedAmount: 140,
    prescribedUnit: "g" as const,
  };
  const currentMilk = {
    ...previousMilk,
    grams: 250,
    prescribedAmount: 250,
    prescribedUnit: "ml" as const,
  };
  const changes = detectPrescriptionChanges(
    {
      meals: [meal("meal-1", "Café da manhã", "07:00", [previousMilk])],
      supplements: [],
    },
    {
      meals: [meal("meal-1", "Café da manhã", "07:00", [currentMilk])],
      supplements: [],
    },
  );
  const quantityChange = changes.find(
    (change) => change.type === "GRAMS_CHANGED",
  );
  assert.equal(quantityChange?.previousValue, "Leite integral · 140 g · Café da manhã");
  assert.equal(quantityChange?.currentValue, "Leite integral · 250 ml · Café da manhã");
});
