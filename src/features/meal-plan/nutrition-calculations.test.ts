import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateFoodNutrientsForGrams,
  calculateMealPlanNutritionTotals,
  calculateMealPlanTotals,
  calculatePrescribedRecipeNutrients,
  compareMealEnergyTarget,
  compareMealPlanNutrition,
  EMPTY_FOOD_NUTRIENTS,
  formatRecipePortionDescription,
  parsePositiveMealPlanDecimal,
  nutritionForGrams,
  updateMealPlanFoodPortion,
  updateMealPlanRecipePortion,
} from "./nutrition-calculations";
import {
  mapMealPlanRecipeNutrients,
  parseMealPlanRecordDraft,
  type MealPlanRecordFood,
  type MealPlanRecordRecipe,
} from "./record";

const per100g = {
  energyKcal: 200,
  proteinGrams: 20,
  carbohydratesGrams: 30,
  fatsGrams: 5,
  fiberGrams: 4,
};
const fullPer100g = { ...EMPTY_FOOD_NUTRIENTS, ...per100g };
const editableFood: MealPlanRecordFood = {
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
  measureOptions: [
    { name: "porção", gramsPerUnit: 150 },
    { name: "colher", gramsPerUnit: 25 },
  ],
  quantity: 1,
  nutrientsPer100g: fullPer100g,
  nutrients: calculateFoodNutrientsForGrams(fullPer100g, 150),
  substitutions: [],
};

const partialPancakeSnapshot = mapMealPlanRecipeNutrients((key) => ({
  energyKcal: 511.084283,
  proteinGrams: 22.736262,
  carbohydratesGrams: 78.345638,
  fatsGrams: 13.4519,
}[key] ?? null));

const partialPancakeMissingNutrients = [
  "fiberGrams",
  "sugarsGrams",
  "cholesterolMg",
  "saturatedFatsGrams",
  "monounsaturatedFatsGrams",
  "polyunsaturatedFatsGrams",
  "sodiumMg",
  "calciumMg",
  "ironMg",
  "magnesiumMg",
  "phosphorusMg",
  "potassiumMg",
  "zincMg",
  "copperMg",
  "manganeseMg",
  "seleniumMcg",
  "vitaminAMcg",
  "vitaminCMg",
  "vitaminDMcg",
  "vitaminEMg",
  "vitaminKMcg",
  "thiamineMg",
  "riboflavinMg",
  "niacinMg",
  "vitaminB6Mg",
  "folateMcg",
  "vitaminB12Mcg",
] as const satisfies MealPlanRecordRecipe["missingNutrients"];

const partialPancake: MealPlanRecordRecipe = {
  itemType: "RECIPE",
  id: "52fcde6d-1e7d-4f7a-ae9e-2767b9f61192",
  recipeId: "1cdd7fb0-1c28-4806-b0a4-cde55f9457ec",
  recipeTitle: "Panqueca de aveia e banana (Evonut)",
  recipeNutritionSnapshotId: "a70c1333-144b-4496-b4d7-f9fd8799ec7b",
  recipeNutritionSnapshotVersion: 2,
  portion: {
    kind: "SERVINGS",
    prescribedServings: 1,
    recipeServings: 3,
    description: "1 porção (1/3 da receita)",
  },
  nutritionCompleteness: "PARTIAL",
  snapshotNutrients: partialPancakeSnapshot,
  prescribedNutrients: calculatePrescribedRecipeNutrients(
    partialPancakeSnapshot,
    1,
    3,
  ),
  missingNutrients: partialPancakeMissingNutrients,
};

test("recalcula todos os nutrientes pela quantidade em gramas", () => {
  assert.deepEqual(nutritionForGrams(per100g, 150), {
    energyKcal: 300,
    proteinGrams: 30,
    carbohydratesGrams: 45,
    fatsGrams: 7.5,
    fiberGrams: 6,
  });
});

test("descreve a porção da receita pela fração sem presumir peso", () => {
  assert.equal(formatRecipePortionDescription(1, 3), "1 porção (1/3 da receita)");
  assert.equal(formatRecipePortionDescription(2, 4), "2 porções (1/2 da receita)");
  assert.equal(formatRecipePortionDescription(0.5, 3), "0,5 porções (16,67% da receita)");
});

test("preserva macros completos e demais ausências da receita no plano", () => {
  const totals = calculateMealPlanNutritionTotals([{
    id: "meal-a",
    name: "Lanche da manhã",
    order: 1,
    items: [partialPancake],
  }]);

  assert.equal(totals.values.energyKcal, 170.36);
  assert.equal(totals.values.proteinGrams, 7.58);
  assert.equal(totals.values.carbohydratesGrams, 26.12);
  assert.equal(totals.values.fatsGrams, 4.48);
  assert.equal(totals.nutritionCompleteness, "PARTIAL");
  assert.deepEqual(totals.missingNutrients, partialPancakeMissingNutrients);
  assert.equal(totals.missingContributions.length, 27);
});

test("agrega subtotais conhecidos da receita sem apresentá-los como completos", () => {
  const snapshot = mapMealPlanRecipeNutrients((key) => ({
    energyKcal: 511.084283,
    proteinGrams: 22.736262,
    carbohydratesGrams: 78.345638,
    fatsGrams: 13.4519,
    fiberGrams: 9.27,
    sodiumMg: 114.27,
    calciumMg: 50,
  }[key] ?? null));
  const partialNutrients = [
    "fiberGrams",
    "sodiumMg",
    "calciumMg",
  ] as const;
  const recipe: MealPlanRecordRecipe = {
    ...partialPancake,
    recipeNutritionSnapshotVersion: 3,
    snapshotNutrients: snapshot,
    prescribedNutrients: calculatePrescribedRecipeNutrients(snapshot, 1, 3),
    missingNutrients: partialPancakeMissingNutrients.filter(
      (key) =>
        key !== "fiberGrams" && key !== "sodiumMg" && key !== "calciumMg",
    ),
    partialNutrients,
  };
  const totals = calculateMealPlanNutritionTotals([{
    id: "meal-a",
    name: "Lanche da manhã",
    order: 1,
    items: [recipe],
  }]);

  assert.equal(totals.values.fiberGrams, 3.09);
  assert.ok(
    recipe.prescribedNutrients.sodiumMg !== null &&
      Math.abs(recipe.prescribedNutrients.sodiumMg - 38.09) < 1e-9,
  );
  assert.deepEqual(totals.partialNutrients, partialNutrients);
  assert.ok(!totals.missingNutrients.includes("fiberGrams"));
  assert.ok(!totals.missingNutrients.includes("sodiumMg"));
  assert.equal(totals.nutritionCompleteness, "PARTIAL");
});

test("editar a quantidade recalcula nutrientes e mantém a descrição fracionária", () => {
  const result = updateMealPlanRecipePortion(partialPancake, "2");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.recipe.portion.description, "2 porções (2/3 da receita)");
  assert.ok(
    result.recipe.prescribedNutrients.energyKcal !== null &&
      Math.abs(result.recipe.prescribedNutrients.energyKcal - 340.7228553333333) < 1e-9,
  );
  assert.equal(result.recipe.prescribedNutrients.fiberGrams, null);
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

test("aceita vírgula e ponto e rejeita vazio, zero, negativo e texto", () => {
  assert.equal(parsePositiveMealPlanDecimal("1,5", 1_000).success, true);
  assert.equal(parsePositiveMealPlanDecimal("100.5", 10_000).success, true);
  assert.equal(parsePositiveMealPlanDecimal("", 1_000).success, false);
  assert.equal(parsePositiveMealPlanDecimal("0", 1_000).success, false);
  assert.equal(parsePositiveMealPlanDecimal("-1", 1_000).success, false);
  assert.equal(parsePositiveMealPlanDecimal("abc", 1_000).success, false);
});

test("edita quantidade e gramagem com recálculo imediato", () => {
  const referenceFood = {
    ...editableFood,
    grams: 100,
    householdMeasure: "100 g",
    measureOptions: [{ name: "100 g", gramsPerUnit: 100 }],
    nutrients: calculateFoodNutrientsForGrams(fullPer100g, 100),
  };
  for (const [input, expectedQuantity] of [
    ["0,25", 0.25],
    ["0,5", 0.5],
    ["0,75", 0.75],
    ["1", 1],
    ["1,5", 1.5],
    ["2", 2],
    ["3", 3],
    ["5", 5],
  ] as const) {
    const result = updateMealPlanFoodPortion(referenceFood, {
      field: "quantity",
      input,
    });
    assert.equal(result.success, true);
    if (!result.success) continue;
    assert.equal(result.food.quantity, expectedQuantity);
    assert.equal(result.food.grams, expectedQuantity * 100);
  }

  const halfPortion = updateMealPlanFoodPortion(
    referenceFood,
    { field: "quantity", input: "0,5" },
  );
  assert.equal(halfPortion.success, true);
  if (!halfPortion.success) return;
  assert.equal(halfPortion.food.quantity, 0.5);
  assert.equal(halfPortion.food.grams, 50);
  assert.equal(halfPortion.food.nutrients.energyKcal, 100);
  assert.equal(halfPortion.food.nutrients.proteinGrams, 10);
  assert.equal(halfPortion.food.nutrients.carbohydratesGrams, 15);
  assert.equal(halfPortion.food.nutrients.fatsGrams, 2.5);

  const quantity = updateMealPlanFoodPortion(editableFood, {
    field: "quantity",
    input: "1,5",
  });
  assert.equal(quantity.success, true);
  if (!quantity.success) return;
  assert.equal(quantity.food.quantity, 1.5);
  assert.equal(quantity.food.grams, 225);
  assert.equal(quantity.food.nutrients.energyKcal, 450);

  const grams = updateMealPlanFoodPortion(quantity.food, {
    field: "grams",
    input: "100.5",
  });
  assert.equal(grams.success, true);
  if (!grams.success) return;
  assert.equal(grams.food.grams, 100.5);
  assert.equal(grams.food.quantity, 0.67);
  assert.equal(grams.food.nutrients.energyKcal, 201);
  assert.equal(editableFood.quantity, 1);
  assert.equal(editableFood.grams, 150);
});

test("entrada em gramas preserva a quantidade informada ao editar o peso", () => {
  const manualFood: MealPlanRecordFood = {
    ...editableFood,
    description: "Abacaxi, cru",
    householdMeasure: "100 g",
    selectedIbgeMeasureId: undefined,
    prescribedAmount: 50,
    prescribedUnit: "g",
    quantity: 1,
    grams: 50,
    nutrients: calculateFoodNutrientsForGrams(fullPer100g, 50),
  };

  const migrated = updateMealPlanFoodPortion(manualFood, {
    field: "grams",
    input: "50",
  });
  assert.equal(migrated.success, true);
  if (!migrated.success) return;
  assert.equal(migrated.food.quantity, 1);
  assert.equal(migrated.food.prescribedAmount, 50);
  assert.equal(migrated.food.grams, 50);
  assert.equal(migrated.food.nutrients.energyKcal, 100);

  const changed = updateMealPlanFoodPortion(migrated.food, {
    field: "grams",
    input: "100",
  });
  assert.equal(changed.success, true);
  if (!changed.success) return;
  assert.equal(changed.food.quantity, 1);
  assert.equal(changed.food.prescribedAmount, 100);
  assert.equal(changed.food.grams, 100);
  assert.equal(changed.food.nutrients.energyKcal, 200);
});

test("banana alterada de 75 g para 100 g recalcula todos os nutrientes", () => {
  const banana: MealPlanRecordFood = {
    ...editableFood,
    description: "Banana, prata, crua",
    householdMeasure: "100 g",
    primaryHouseholdMeasure: "100 g",
    measureOptions: [{ name: "100 g", gramsPerUnit: 100 }],
    selectedIbgeMeasureId: undefined,
    prescribedAmount: 75,
    prescribedUnit: "g",
    quantity: 1,
    grams: 75,
    nutrients: calculateFoodNutrientsForGrams(fullPer100g, 75),
  };

  const result = updateMealPlanFoodPortion(banana, {
    field: "grams",
    input: "100",
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.food.quantity, 1);
  assert.equal(result.food.grams, 100);
  assert.equal(result.food.prescribedAmount, 100);
  assert.deepEqual(result.food.nutrients, fullPer100g);

  const reopened = parseMealPlanRecordDraft(JSON.parse(JSON.stringify({
    strategyEntryId: "35eab5d6-4dbd-4017-b9c7-bc4aa4bb1d9a",
    status: "DRAFT",
    aiDecision: "IDLE",
    meals: [{
      id: "03649e8f-201f-4404-ab3e-803d757aff3a",
      name: "Lanche",
      order: 1,
      items: [result.food],
    }],
    supplements: [],
  })));
  assert.equal(reopened?.meals[0].items.length, 1);
  assert.equal(reopened?.meals[0].items[0].grams, 100);
  assert.equal(reopened?.meals[0].items[0].prescribedAmount, 100);
  assert.equal(reopened?.meals[0].items[0].quantity, 1);
});

test("quantidade manual em gramas não cria ciclo nem altera o peso", () => {
  const manualFood: MealPlanRecordFood = {
    ...editableFood,
    householdMeasure: "100 g",
    selectedIbgeMeasureId: undefined,
    prescribedAmount: 100,
    prescribedUnit: "g",
    quantity: 1,
    grams: 100,
    nutrients: calculateFoodNutrientsForGrams(fullPer100g, 100),
  };
  const result = updateMealPlanFoodPortion(manualFood, {
    field: "quantity",
    input: "2",
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.food.quantity, 2);
  assert.equal(result.food.grams, 100);
  assert.equal(result.food.prescribedAmount, 100);
  assert.equal(result.food.nutrients.energyKcal, 200);
});

test("correção manual do peso preserva medida caseira e quantidade", () => {
  const householdFood: MealPlanRecordFood = {
    ...editableFood,
    prescribedAmount: 75,
    prescribedUnit: "g",
    selectedIbgeMeasureId: "51ebf1a0-859d-4b3f-8a20-8c59a29f82fa",
    ibgeMeasureOptions: [{
      id: "51ebf1a0-859d-4b3f-8a20-8c59a29f82fa",
      label: "Unidade",
      measureName: "Unidade",
      preparationCode: "CRU",
      preparationName: "Cru",
      amountPerMeasure: 75,
      unit: "g",
    }],
    quantity: 1,
    grams: 75,
    nutrients: calculateFoodNutrientsForGrams(fullPer100g, 75),
  };

  const corrected = updateMealPlanFoodPortion(householdFood, {
    field: "grams",
    input: "100",
  });
  assert.equal(corrected.success, true);
  if (!corrected.success) return;
  assert.equal(corrected.food.selectedIbgeMeasureId, householdFood.selectedIbgeMeasureId);
  assert.equal(corrected.food.quantity, 1);
  assert.equal(corrected.food.grams, 100);
  assert.equal(corrected.food.nutrients.energyKcal, 200);

  const doubled = updateMealPlanFoodPortion(corrected.food, {
    field: "quantity",
    input: "2",
  });
  assert.equal(doubled.success, true);
  if (!doubled.success) return;
  assert.equal(doubled.food.quantity, 2);
  assert.equal(doubled.food.grams, 150);
});

test("Evonut por 100 ml recalcula volume, macros e micronutrientes sem recarregar", () => {
  const volumeFood: MealPlanRecordFood = {
    ...editableFood,
    source: "EVONUT",
    sourceName: "Evonut",
    primaryHouseholdMeasure: "100 ml",
    householdMeasure: "100 ml",
    prescribedAmount: 200,
    prescribedUnit: "ml",
    selectedIbgeMeasureId: "51ebf1a0-859d-4b3f-8a20-8c59a29f82fa",
    ibgeMeasureOptions: [{
      id: "51ebf1a0-859d-4b3f-8a20-8c59a29f82fa",
      label: "Copo",
      measureName: "Copo",
      preparationCode: "PRONTO",
      preparationName: "Pronto para consumo",
      amountPerMeasure: 200,
      unit: "ml",
    }],
    quantity: 1,
    grams: 200,
    nutrientsPer100g: {
      ...fullPer100g,
      calciumMg: 120,
    },
    nutrients: calculateFoodNutrientsForGrams(
      { ...fullPer100g, calciumMg: 120 },
      200,
    ),
  };
  const doubled = updateMealPlanFoodPortion(volumeFood, {
    field: "quantity",
    input: "2",
  });
  assert.equal(doubled.success, true);
  if (!doubled.success) return;
  assert.equal(doubled.food.prescribedAmount, 400);
  assert.equal(doubled.food.grams, 400);
  assert.equal(doubled.food.nutrients.energyKcal, 800);
  assert.equal(doubled.food.nutrients.calciumMg, 480);

  const manual = updateMealPlanFoodPortion(
    { ...doubled.food, selectedIbgeMeasureId: undefined },
    { field: "grams", input: "250" },
  );
  assert.equal(manual.success, true);
  if (!manual.success) return;
  assert.equal(manual.food.quantity, 2);
  assert.equal(manual.food.prescribedAmount, 250);
  assert.equal(manual.food.grams, 250);
  assert.equal(manual.food.nutrients.energyKcal, 500);
  assert.equal(manual.food.nutrients.calciumMg, 300);
});

test("não converte prescrição em g contra base em ml sem conversão documentada", () => {
  const historicalMilk: MealPlanRecordFood = {
    ...editableFood,
    source: "EVONUT",
    sourceName: "IBGE",
    primaryHouseholdMeasure: "100 ml",
    standardWeightGrams: 100,
    prescribedAmount: 220,
    prescribedUnit: "g",
    grams: 220,
    householdMeasure: "100 ml",
    nutrientsPer100g: { ...fullPer100g, energyKcal: 42 },
    nutrients: { ...fullPer100g, energyKcal: 92.4 },
  };
  const edited = updateMealPlanFoodPortion(historicalMilk, {
    field: "grams",
    input: "240",
  });
  assert.equal(edited.success, false);
  if (edited.success) return;
  assert.match(edited.message, /base em ml.*prescrição está em g/i);
  assert.equal(historicalMilk.prescribedAmount, 220);
  assert.equal(historicalMilk.nutrients.energyKcal, 92.4);
});

test("troca para prescrição direta em ml somente com nova quantidade e mantém no reabrir", () => {
  const historicalMilk: MealPlanRecordFood = {
    ...editableFood,
    source: "EVONUT",
    sourceName: "IBGE",
    primaryHouseholdMeasure: "100 ml",
    nutritionBasisUnit: "ml",
    standardWeightGrams: 100,
    prescribedAmount: 140,
    prescribedUnit: "g",
    grams: 140,
    householdMeasure: "100 ml",
    nutrientsPer100g: { ...fullPer100g, energyKcal: 64.56 },
    nutrients: { ...fullPer100g, energyKcal: 90.38 },
  };

  const withoutNewAmount = updateMealPlanFoodPortion(historicalMilk, {
    field: "grams",
    input: "140",
  });
  assert.equal(withoutNewAmount.success, false);
  assert.equal(historicalMilk.prescribedUnit, "g");
  assert.equal(historicalMilk.prescribedAmount, 140);

  const prescribedInMl = updateMealPlanFoodPortion(historicalMilk, {
    field: "directAmount",
    input: "250",
    unit: "ml",
  });
  assert.equal(prescribedInMl.success, true);
  if (!prescribedInMl.success) return;
  assert.equal(prescribedInMl.food.prescribedAmount, 250);
  assert.equal(prescribedInMl.food.prescribedUnit, "ml");
  assert.equal(prescribedInMl.food.quantity, 1);
  assert.equal(prescribedInMl.food.selectedIbgeMeasureId, undefined);
  assert.equal(prescribedInMl.food.nutrients.energyKcal, 161.4);

  const reopened = parseMealPlanRecordDraft(
    JSON.parse(
      JSON.stringify({
        strategyEntryId: "35eab5d6-4dbd-4017-b9c7-bc4aa4bb1d9a",
        status: "DRAFT",
        aiDecision: "IDLE",
        meals: [
          {
            id: crypto.randomUUID(),
            name: "Café da manhã",
            order: 1,
            items: [prescribedInMl.food],
          },
        ],
        supplements: [],
      }),
    ),
  );
  assert.ok(reopened);
  const reopenedFood = reopened.meals[0]?.items[0];
  assert.ok(reopenedFood && "prescribedUnit" in reopenedFood);
  assert.equal(reopenedFood.prescribedUnit, "ml");
  assert.equal(reopenedFood.prescribedAmount, 250);
  assert.equal(reopenedFood.nutrients.energyKcal, 161.4);
});

test("seleciona somente medida existente e recalcula refeição e dia", () => {
  const changed = updateMealPlanFoodPortion(editableFood, {
    field: "householdMeasure",
    value: "colher",
  });
  assert.equal(changed.success, true);
  if (!changed.success) return;
  assert.equal(changed.food.householdMeasure, "colher");
  assert.equal(changed.food.grams, 25);

  const meal = {
    id: "03649e8f-201f-4404-ab3e-803d757aff3a",
    name: "Almoço",
    order: 1,
    items: [changed.food],
  };
  const totals = calculateMealPlanTotals([meal]);
  assert.equal(totals.energyKcal, 50);
  assert.equal(totals.proteinGrams, 5);
  assert.equal(
    updateMealPlanFoodPortion(editableFood, {
      field: "householdMeasure",
      value: "medida inexistente",
    }).success,
    false,
  );
});

test("reabre a porção editada sem alterar valores ou duplicar o item", () => {
  const edited = updateMealPlanFoodPortion(editableFood, {
    field: "grams",
    input: "100,5",
  });
  assert.equal(edited.success, true);
  if (!edited.success) return;

  const reopened = parseMealPlanRecordDraft(
    JSON.parse(
      JSON.stringify({
        strategyEntryId: "35eab5d6-4dbd-4017-b9c7-bc4aa4bb1d9a",
        status: "DRAFT",
        aiDecision: "REJECTED",
        meals: [
          {
            id: "03649e8f-201f-4404-ab3e-803d757aff3a",
            name: "Almoço",
            order: 1,
            items: [edited.food],
          },
        ],
        supplements: [],
      }),
    ),
  );
  const item = reopened?.meals[0].items[0];
  assert.equal(reopened?.meals[0].items.length, 1);
  assert.equal(item?.id, editableFood.id);
  assert.equal(item?.quantity, 0.67);
  assert.equal(item?.grams, 100.5);
  assert.equal(item?.householdMeasure, "porção");
  assert.equal(reopened?.aiDecision, "REJECTED");
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

test("compara a energia realizada com a meta prevista da refeição", () => {
  assert.equal(compareMealEnergyTarget(400, 392), "ADEQUATE");
  assert.equal(compareMealEnergyTarget(400, 370), "NEAR_TARGET");
  assert.equal(compareMealEnergyTarget(400, 300), "OUTSIDE_TARGET");
});
