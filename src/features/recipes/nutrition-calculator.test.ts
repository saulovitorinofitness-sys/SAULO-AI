import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateRecipeNutrition,
  RECIPE_NUTRIENT_KEYS,
  type RecipeIngredientCalculationInput,
  type RecipeNutrientValues,
} from "./nutrition-calculator";

function nutrients(
  overrides: Partial<RecipeNutrientValues> = {},
): RecipeNutrientValues {
  return Object.fromEntries(
    RECIPE_NUTRIENT_KEYS.map((key) => [
      key,
      overrides[key] ?? { status: "VALUE", value: 0 },
    ]),
  ) as unknown as RecipeNutrientValues;
}

function ingredient(
  overrides: Partial<RecipeIngredientCalculationInput> = {},
): RecipeIngredientCalculationInput {
  return {
    ingredientId: "ingredient-a",
    foodId: "food-a",
    foodName: "Alimento A",
    source: { kind: "TACO", name: "TACO" },
    nutrientReferenceUnit: "g",
    nutrientsPer100: nutrients({
      energyKcal: { status: "VALUE", value: 200 },
      energyKj: { status: "VALUE", value: 836.8 },
      carbohydratesGrams: { status: "VALUE", value: 30 },
      proteinGrams: { status: "VALUE", value: 20 },
      totalFatsGrams: { status: "VALUE", value: 5 },
      fiberGrams: { status: "VALUE", value: 4 },
      sodiumMg: { status: "VALUE", value: 120 },
    }),
    grossQuantity: 200,
    netQuantity: 150,
    quantityUnit: "g",
    ...overrides,
  };
}

test("calcula proporcionalidade, soma, porção e 100 g sem arredondar", () => {
  const result = calculateRecipeNutrition({
    ingredients: [
      ingredient(),
      ingredient({
        ingredientId: "ingredient-b",
        foodId: "food-b",
        foodName: "Alimento B",
        source: { kind: "EVONUT", name: "TBCA" },
        grossQuantity: 50,
        netQuantity: 50,
        nutrientsPer100: nutrients({
          energyKcal: { status: "VALUE", value: 100 },
          energyKj: { status: "VALUE", value: 418.4 },
          carbohydratesGrams: { status: "VALUE", value: 10 },
          proteinGrams: { status: "VALUE", value: 4 },
          totalFatsGrams: { status: "VALUE", value: 2 },
          fiberGrams: { status: "VALUE", value: 2 },
          sodiumMg: { status: "VALUE", value: 40 },
        }),
      }),
    ],
    finalYield: { amount: 400, unit: "g" },
    servingSize: { amount: 100, unit: "g" },
  });

  assert.equal(result.complete, true);
  assert.equal(result.ingredients[0].nutrients.energyKcal.value, 300);
  assert.equal(result.total.energyKcal.value, 350);
  assert.equal(result.total.proteinGrams.value, 32);
  assert.equal(result.servings, 4);
  assert.equal(result.perServing?.energyKcal.value, 87.5);
  assert.equal(result.per100?.energyKcal.value, 87.5);
  assert.equal(result.ingredients[1].scientificSource, "TBCA");
  assert.equal(result.snapshotDraft?.energyKcal, 350);
});

test("calcula quantidade líquida pela convenção PB dividido pelo fator", () => {
  const result = calculateRecipeNutrition({
    ingredients: [ingredient({ netQuantity: undefined, correctionFactor: 2 })],
    finalYield: { amount: 100, unit: "g" },
    servings: 2,
  });

  assert.equal(result.ingredients[0].netQuantity, 100);
  assert.equal(result.total.energyKcal.value, 200);
  assert.equal(result.servingSize?.amount, 50);
  assert.equal(result.complete, true);
});

test("usa equivalência documentada sem inventar quantidade bruta ou fator de correção", () => {
  const result = calculateRecipeNutrition({
    ingredients: [
      ingredient({
        grossQuantity: undefined,
        netQuantity: undefined,
        resolvedQuantity: 150,
      }),
    ],
    servings: 10,
    servingSize: { amount: 50, unit: "g" },
  });

  assert.equal(result.ingredients[0].grossQuantity, null);
  assert.equal(result.ingredients[0].netQuantity, 150);
  assert.equal(result.total.energyKcal.value, 300);
  assert.equal(result.perServing?.energyKcal.value, 30);
  assert.equal(result.per100, null);
  assert.equal(result.outputStatus.TOTAL, "COMPLETE");
  assert.equal(result.outputStatus.PER_SERVING, "COMPLETE");
  assert.equal(result.outputStatus.PER_100, "UNAVAILABLE");
  assert.ok(
    !result.pendings.some(
      (pending) => pending.code === "MISSING_NET_QUANTITY",
    ),
  );
  assert.ok(
    result.pendings.some(
      (pending) => pending.code === "MISSING_FINAL_YIELD",
    ),
  );
});

test("persiste subtotais parciais e seus estados para fibra, sódio e micronutrientes", () => {
  const result = calculateRecipeNutrition({
    ingredients: [
      ingredient({
        netQuantity: 100,
        nutrientsPer100: nutrients({
          energyKcal: { status: "VALUE", value: 200 },
          fiberGrams: { status: "VALUE", value: 6 },
          sodiumMg: { status: "VALUE", value: 30 },
          calciumMg: { status: "VALUE", value: 80 },
        }),
      }),
      ingredient({
        ingredientId: "ingredient-b",
        foodId: "food-b",
        foodName: "Alimento B",
        grossQuantity: 50,
        netQuantity: 50,
        nutrientsPer100: nutrients({
          energyKcal: { status: "MISSING", value: null },
          fiberGrams: { status: "MISSING", value: null },
          sodiumMg: { status: "MISSING", value: null },
          calciumMg: { status: "MISSING", value: null },
        }),
      }),
    ],
    servings: 2,
  });

  assert.deepEqual(result.total.energyKcal, {
    status: "PARTIAL",
    value: 200,
  });
  assert.deepEqual(result.perServing?.energyKcal, {
    status: "PARTIAL",
    value: 100,
  });
  assert.equal(result.calculationStatus, "PARTIAL");
  assert.equal(result.snapshotDraft?.energyKcal, 200);
  assert.equal(result.snapshotDraft?.fiberGrams, 6);
  assert.equal(result.snapshotDraft?.sodiumMg, 30);
  assert.equal(result.snapshotDraft?.calciumMg, 80);
  assert.equal(
    result.snapshotDraft?.additionalNutrients.nutrientStates.fiberGrams,
    "PARTIAL",
  );
  assert.equal(
    result.snapshotDraft?.additionalNutrients.nutrientStates.calciumMg,
    "PARTIAL",
  );
});

test("preserva zero real, ausência e não aplicável sem convertê-los entre si", () => {
  const result = calculateRecipeNutrition({
    ingredients: [
      ingredient({
        nutrientsPer100: nutrients({
          totalSugarsGrams: { status: "VALUE", value: 0 },
          addedSugarsGrams: { status: "MISSING", value: null },
          transFatsGrams: { status: "NOT_APPLICABLE", value: null },
        }),
      }),
    ],
    finalYield: { amount: 150, unit: "g" },
    servingSize: { amount: 50, unit: "g" },
  });

  assert.deepEqual(result.total.totalSugarsGrams, {
    status: "VALUE",
    value: 0,
  });
  assert.deepEqual(result.total.addedSugarsGrams, {
    status: "MISSING",
    value: null,
  });
  assert.deepEqual(result.total.transFatsGrams, {
    status: "NOT_APPLICABLE",
    value: null,
  });
  assert.equal(result.complete, false);
  assert.ok(
    result.pendings.some(
      (pending) =>
        pending.nutrient === "addedSugarsGrams" &&
        pending.foodId === "food-a" &&
        pending.scientificSource === "TACO" &&
        pending.scientificStatus === "MISSING",
    ),
  );
});

test("propaga formas nutricionais ao snapshot sem converter formas incompatíveis", () => {
  const consistent = calculateRecipeNutrition({
    ingredients: [ingredient({
      nutrientForms: { vitaminAMcg: "RE", folateMcg: "UNSPECIFIED" },
      nutrientsPer100: nutrients({
        vitaminAMcg: { status: "VALUE", value: 120 },
        folateMcg: { status: "VALUE", value: 80 },
      }),
    })],
    servings: 2,
  });
  assert.deepEqual(consistent.snapshotDraft?.additionalNutrients.nutrientForms, {
    vitaminAMcg: "RE",
    folateMcg: "UNSPECIFIED",
  });

  const mixed = calculateRecipeNutrition({
    ingredients: [
      ingredient({ nutrientForms: { vitaminAMcg: "RAE", folateMcg: "DFE" } }),
      ingredient({
        ingredientId: "ingredient-b",
        foodId: "food-b",
        foodName: "Alimento B",
        nutrientForms: { vitaminAMcg: "RE", folateMcg: "FOLIC_ACID" },
      }),
    ],
    servings: 2,
  });
  assert.deepEqual(mixed.snapshotDraft?.additionalNutrients.nutrientForms, {
    vitaminAMcg: "UNSPECIFIED",
    folateMcg: "UNSPECIFIED",
  });
});

test("bloqueia conclusão quando faltam rendimento final ou porção", () => {
  const missingYield = calculateRecipeNutrition({
    ingredients: [ingredient()],
    servingSize: { amount: 50, unit: "g" },
  });
  assert.equal(missingYield.complete, false);
  assert.equal(missingYield.per100, null);
  assert.ok(
    missingYield.pendings.some(
      (pending) => pending.code === "MISSING_FINAL_YIELD",
    ),
  );

  const missingServing = calculateRecipeNutrition({
    ingredients: [ingredient()],
    finalYield: { amount: 150, unit: "g" },
  });
  assert.equal(missingServing.complete, false);
  assert.equal(missingServing.perServing, null);
  assert.ok(
    missingServing.pendings.some(
      (pending) => pending.code === "MISSING_SERVING",
    ),
  );
});
