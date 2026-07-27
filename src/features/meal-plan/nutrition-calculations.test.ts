import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateFoodNutrientsForGrams,
  calculateMealPlanTotals,
  compareMealPlanNutrition,
  EMPTY_FOOD_NUTRIENTS,
  nutritionForGrams,
} from "./nutrition-calculations";

const per100g = {
  energyKcal: 200,
  proteinGrams: 20,
  carbohydratesGrams: 30,
  fatsGrams: 5,
  fiberGrams: 4,
};
const fullPer100g = { ...EMPTY_FOOD_NUTRIENTS, ...per100g };

test("recalcula todos os nutrientes pela quantidade em gramas", () => {
  assert.deepEqual(nutritionForGrams(per100g, 150), {
    energyKcal: 300,
    proteinGrams: 30,
    carbohydratesGrams: 45,
    fatsGrams: 7.5,
    fiberGrams: 6,
  });
});

test("recalcula micronutrientes conhecidos e preserva ausências", () => {
  const result = calculateFoodNutrientsForGrams(
    {
      ...EMPTY_FOOD_NUTRIENTS,
      sodiumMg: 120,
      calciumMg: 80,
      ironMg: 2,
      vitaminAMcg: 40,
      vitaminCMg: null,
    },
    150,
  );

  assert.equal(result.sodiumMg, 180);
  assert.equal(result.calciumMg, 120);
  assert.equal(result.ironMg, 3);
  assert.equal(result.vitaminAMcg, 60);
  assert.equal(result.vitaminCMg, null);
});

test("soma os alimentos de todas as refeições", () => {
  const totals = calculateMealPlanTotals([
    {
      id: "03649e8f-201f-4404-ab3e-803d757aff3a",
      name: "Almoço",
      order: 1,
      items: [
        {
          id: "8509660d-4947-40e1-b408-1d83ad02bb67",
          catalogFoodId: "food-a",
          description: "Alimento A",
          foodGroup: "Grupo",
          source: "TACO",
          sourceName: "TACO",
          primaryHouseholdMeasure: "porção",
          standardWeightGrams: 100,
          grams: 150,
          householdMeasure: "porção",
          measureOptions: [{ name: "porção", gramsPerUnit: 150 }],
          quantity: 1,
          nutrientsPer100g: fullPer100g,
          nutrients: calculateFoodNutrientsForGrams(fullPer100g, 150),
          substitutions: [],
        },
      ],
    },
  ]);

  assert.equal(totals.energyKcal, 300);
  assert.equal(totals.proteinGrams, 30);
  assert.equal(totals.fiberGrams, 6);
});

test("classifica compatível, acima e abaixo com tolerância técnica", () => {
  const result = compareMealPlanNutrition(per100g, {
    energyKcal: 202,
    proteinGrams: 25,
    carbohydratesGrams: 20,
    fatsGrams: 5,
    fiberGrams: 4,
  });

  assert.equal(result.energyKcal, "COMPATIBLE");
  assert.equal(result.proteinGrams, "ABOVE");
  assert.equal(result.carbohydratesGrams, "BELOW");
  assert.equal(result.fatsGrams, "COMPATIBLE");
});
