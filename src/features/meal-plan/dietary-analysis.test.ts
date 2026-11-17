import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { calculateMealPlanTargetDeviations, evaluateMealPlanCompletion, mealPlanContentFingerprint, mealPlanTargetDeviationFingerprint } from "./completion-policy";
import { FINAL_NUTRITION_TARGET_TOLERANCE_PERCENT } from "./adequacy-engine";
import { buildNutrientReviewGuidance } from "./adequacy-review-guidance";
import { ageInCompletedYears, deriveDietaryReferenceProfile, dietaryReferenceAgeBand, formatDietaryReferenceClinicalDate, normalizeDietaryReferenceSex, selectDietaryReferences, type DietaryReferenceProfile } from "./dietary-reference";
import { normalizeFoodGroup } from "./food-group-normalization";
import { resolveFoodNutrientForms } from "../food-database/nutrient-forms";
import { EMPTY_FOOD_NUTRIENTS } from "./nutrition-calculations";
import { analyzeMealPlanNutrition } from "./plan-nutrition-analysis";
import { attachMealPlanFoodSubstitution, recalculateMealPlanSubstitutions } from "./substitution-engine";
import { mapMealPlanRecipeNutrients, parseStoredMealPlanPayload, type MealPlanRecordFood, type MealPlanRecordMeal, type MealPlanRecordRecipe } from "./record";

const ids = {
  meal: "10000000-0000-4000-8000-000000000001",
  food: "10000000-0000-4000-8000-000000000002",
  replacement: "10000000-0000-4000-8000-000000000003",
  recipe: "10000000-0000-4000-8000-000000000004",
  snapshot: "10000000-0000-4000-8000-000000000005",
  substitution: "10000000-0000-4000-8000-000000000006",
  user: "10000000-0000-4000-8000-000000000007",
} as const;

const food = (overrides: Partial<MealPlanRecordFood> = {}): MealPlanRecordFood => ({
  itemType: "FOOD", id: ids.food, catalogFoodId: "food-a", description: "Alimento A", foodGroup: "Cereais",
  source: "TACO", sourceName: "TACO", primaryHouseholdMeasure: "colher", standardWeightGrams: 100,
  grams: 100, prescribedAmount: 100, prescribedUnit: "g", householdMeasure: "1 colher", measureOptions: [], quantity: 1,
  nutrientsPer100g: { ...EMPTY_FOOD_NUTRIENTS, energyKcal: 100, proteinGrams: 10, carbohydratesGrams: 15, fatsGrams: 2, fiberGrams: 3, sodiumMg: 0 },
  nutrients: { ...EMPTY_FOOD_NUTRIENTS, energyKcal: 100, proteinGrams: 10, carbohydratesGrams: 15, fatsGrams: 2, fiberGrams: 3, sodiumMg: 0 },
  substitutions: [], ...overrides,
});

const recipe: MealPlanRecordRecipe = {
  itemType: "RECIPE", id: ids.recipe, recipeId: ids.recipe, recipeTitle: "Receita parcial",
  recipeNutritionSnapshotId: ids.snapshot, recipeNutritionSnapshotVersion: 3,
  portion: { kind: "SERVINGS", prescribedServings: 1, recipeServings: 3, description: "1 porção (1/3 da receita)" },
  nutritionCompleteness: "PARTIAL",
  snapshotNutrients: mapMealPlanRecipeNutrients((key) => key === "vitaminCMg" ? null : key === "ironMg" ? 6 : ["energyKcal", "proteinGrams", "carbohydratesGrams", "fatsGrams"].includes(key) ? 30 : 0),
  prescribedNutrients: mapMealPlanRecipeNutrients((key) => key === "vitaminCMg" ? null : key === "ironMg" ? 2 : key === "energyKcal" ? 10 : key === "proteinGrams" ? 10 : key === "carbohydratesGrams" ? 10 : key === "fatsGrams" ? 10 : 0),
  missingNutrients: ["vitaminCMg"], partialNutrients: ["ironMg"],
};

const meals = (items: MealPlanRecordMeal["items"]): readonly MealPlanRecordMeal[] => [{ id: ids.meal, name: "Almoço", order: 1, items }];
const profile = (overrides: Partial<DietaryReferenceProfile> = {}): DietaryReferenceProfile => ({ sex: "FEMALE", ageYears: 30, ageAt: "2026-10-23T12:00:00.000Z", birthDate: "1996-10-23", lifeStage: "NONE", origin: "MASTER_RECORD_AND_ATTENDANCE", ...overrides });

test("seleciona idade na data do atendimento e respeita limites das faixas", () => {
  assert.equal(ageInCompletedYears("2008-10-24", "2026-10-23T12:00:00.000Z"), 17);
  assert.equal(ageInCompletedYears("2008-10-23", "2026-10-23T12:00:00.000Z"), 18);
  assert.equal(dietaryReferenceAgeBand(18), "14_18");
  assert.equal(dietaryReferenceAgeBand(19), "19_30");
  assert.equal(dietaryReferenceAgeBand(70), "51_70");
  assert.equal(dietaryReferenceAgeBand(71), "71_PLUS");
});

test("normaliza o sexo real do cadastro, calcula 34 anos e não presume fase de vida", () => {
  assert.equal(normalizeDietaryReferenceSex("FEMALE"), "FEMALE");
  assert.equal(normalizeDietaryReferenceSex("Feminino"), "FEMALE");
  assert.equal(normalizeDietaryReferenceSex("NOT_INFORMED"), null);
  assert.equal(ageInCompletedYears("1992-07-04", "06/10/2026"), 34);
  const derived = deriveDietaryReferenceProfile({
    patientSex: "FEMALE",
    birthDate: "1992-07-04",
    attendanceDate: "2026-10-06T12:00:00.000Z",
  });
  assert.equal(derived?.ageYears, 34);
  assert.equal(derived?.sex, "FEMALE");
  assert.equal(derived?.lifeStage, "UNKNOWN");
  assert.equal(selectDietaryReferences(derived!), null);
  assert.equal(formatDietaryReferenceClinicalDate("2026-10-06T00:00:00.000Z"), "06/10/2026");
  assert.equal(derived?.ageAt, "2026-10-06T12:00:00.000Z");
});

test("preserva a forma nutricional da fonte sem renomear folato ou vitamina A", () => {
  assert.deepEqual(resolveFoodNutrientForms({
    sourceKind: "EVONUT",
    importedFrom: "EVONUT",
    observations: [
      { nutrientKey: "vitaminAMcg", sourceNutrientName: "Vitamina A (RE)" },
      { nutrientKey: "folateMcg", sourceNutrientName: "Vitamina B9 (Folato)" },
    ],
  }), { vitaminAMcg: "RE", folateMcg: "UNSPECIFIED" });
  assert.deepEqual(resolveFoodNutrientForms({
    sourceKind: "TACO",
    observations: [
      { nutrientKey: "vitaminAMcg", sourceNutrientName: "Vitamina A (RAE)" },
      { nutrientKey: "folateMcg", sourceNutrientName: "Folate, DFE" },
    ],
  }), { vitaminAMcg: "RAE", folateMcg: "DFE" });
});

test("normaliza somente equivalências alimentares explicitamente mapeadas", () => {
  assert.equal(normalizeFoodGroup("Cereais").id, "CEREALS_AND_DERIVATIVES");
  assert.equal(normalizeFoodGroup("Cereais e derivados").id, "CEREALS_AND_DERIVATIVES");
  assert.notEqual(normalizeFoodGroup("Cereais e tubérculos").id, "CEREALS_AND_DERIVATIVES");
  assert.equal(normalizeFoodGroup("Verduras e hortaliças").id, "VEGETABLES_AND_GREENS");
  assert.equal(normalizeFoodGroup("Verduras, hortaliças e legumes").id, "VEGETABLES_AND_GREENS");
  const grouped = analyzeMealPlanNutrition(meals([
    food({ foodGroup: "Cereais" }),
    food({ id: ids.replacement, foodGroup: "Cereais e derivados" }),
  ])).foodGroups[0]!;
  assert.equal(grouped.prescribedItemCount, 2);
  assert.deepEqual(grouped.originalGroups, ["Cereais", "Cereais e derivados"]);
});

test("não presume perfil inválido e identifica tipo/unidade/abrangência de UL", () => {
  assert.equal(selectDietaryReferences(profile({ sex: "MALE", lifeStage: "PREGNANCY" })), null);
  const references = selectDietaryReferences(profile())!;
  assert.deepEqual(references.find((item) => item.nutrient === "ironMg") && (({ referenceType, unit, ulScope }) => ({ referenceType, unit, ulScope }))(references.find((item) => item.nutrient === "ironMg")!), { referenceType: "RDA", unit: "mg", ulScope: "TOTAL_INTAKE" });
  assert.equal(references.find((item) => item.nutrient === "magnesiumMg")?.ulComparison, "NOT_DETERMINABLE");
  assert.equal(references.find((item) => item.nutrient === "sodiumMg")?.upperType, "CDRR");
  assert.equal(references.find((item) => item.nutrient === "vitaminAMcg")?.unit, "mcg RAE");
  assert.equal(references.find((item) => item.nutrient === "folateMcg")?.unit, "mcg DFE");
  assert.equal(references.find((item) => item.nutrient === "vitaminAMcg")?.referenceRequiredForm, "RAE");
  assert.equal(references.find((item) => item.nutrient === "vitaminAMcg")?.ulRequiredForm, "RETINOL");
  assert.equal(references.find((item) => item.nutrient === "folateMcg")?.referenceRequiredForm, "DFE");
  assert.equal(references.find((item) => item.nutrient === "folateMcg")?.ulRequiredForm, "FOLIC_ACID");
  assert.equal(references.find((item) => item.nutrient === "folateMcg")?.ulComparison, "NOT_DETERMINABLE");
  const pregnantAdolescent = selectDietaryReferences(profile({ ageYears: 18, lifeStage: "PREGNANCY" }))!;
  const lactatingAdolescent = selectDietaryReferences(profile({ ageYears: 18, lifeStage: "LACTATION" }))!;
  assert.equal(pregnantAdolescent.find((item) => item.nutrient === "magnesiumMg")?.referenceValue, 400);
  assert.equal(lactatingAdolescent.find((item) => item.nutrient === "magnesiumMg")?.referenceValue, 360);
  assert.equal(selectDietaryReferences(profile({ ageYears: 3 }))?.find((item) => item.nutrient === "sodiumMg")?.referenceValue, 800);
});

test("preserva zero conhecido, parcial e ausência em FOOD + RECIPE", () => {
  const result = analyzeMealPlanNutrition(meals([food(), recipe]));
  assert.equal(result.nutrients.sodiumMg.knownAmount, 0);
  assert.equal(result.nutrients.sodiumMg.coverage, "COMPLETE");
  assert.equal(result.nutrients.ironMg.knownAmount, 2);
  assert.equal(result.nutrients.ironMg.coverage, "PARTIAL");
  assert.equal(result.nutrients.vitaminCMg.knownAmount, null);
  assert.equal(result.nutrients.vitaminCMg.coverage, "ABSENT");
  assert.equal(result.nutrients.energyKcal.knownAmount, 110);
});

test("separa itens completos, subtotais parciais e ausentes e mantém precisão interna", () => {
  const exactFood = food({
    nutrientsPer100g: { ...food().nutrientsPer100g, fiberGrams: 3, vitaminB12Mcg: 2.3904, folateMcg: 100 },
    nutrients: { ...food().nutrients, fiberGrams: 3, vitaminB12Mcg: 2.3904, folateMcg: 100 },
    nutrientForms: { vitaminAMcg: "RAE", folateMcg: "UNSPECIFIED" },
  });
  const partialRecipe = {
    ...recipe,
    snapshotNutrients: { ...recipe.snapshotNutrients, fiberGrams: 6, folateMcg: 300 },
    prescribedNutrients: { ...recipe.prescribedNutrients, fiberGrams: 2, folateMcg: 100 },
    partialNutrients: [...(recipe.partialNutrients ?? []), "fiberGrams", "folateMcg"],
    nutrientForms: { vitaminAMcg: "RE", folateMcg: "UNSPECIFIED" },
  } satisfies MealPlanRecordRecipe;
  const absentRecipe = {
    ...recipe,
    id: "10000000-0000-4000-8000-000000000008",
    snapshotNutrients: { ...recipe.snapshotNutrients, fiberGrams: null },
    prescribedNutrients: { ...recipe.prescribedNutrients, fiberGrams: null },
    missingNutrients: [...recipe.missingNutrients, "fiberGrams"],
  } satisfies MealPlanRecordRecipe;
  const result = analyzeMealPlanNutrition(meals([exactFood, partialRecipe, absentRecipe]));
  assert.deepEqual(
    (({ knownAmount, coverage, completeItemCount, partialItemCount, absentItemCount }) => ({ knownAmount, coverage, completeItemCount, partialItemCount, absentItemCount }))(result.nutrients.fiberGrams),
    { knownAmount: 5, coverage: "PARTIAL", completeItemCount: 1, partialItemCount: 1, absentItemCount: 1 },
  );
  assert.equal(result.nutrients.vitaminB12Mcg.knownAmount, 2.3904);
  assert.ok(Math.abs((result.nutrients.vitaminB12Mcg.knownAmount! / 2.4) * 100 - 99.6) < Number.EPSILON * 100);
  assert.equal(result.nutrients.folateMcg.nutrientForm, "UNSPECIFIED");
  assert.deepEqual(result.nutrients.folateMcg.contributors.slice(0, 2).map((item) => item.nutrientForm), ["UNSPECIFIED", "UNSPECIFIED"]);
});

test("orienta revisão de RDA, AI, parcial, ausente, forma incompatível e UL específico", () => {
  const references = selectDietaryReferences(profile())!;
  const reference = (nutrient: string) => references.find((item) => item.nutrient === nutrient)!;

  const complete = analyzeMealPlanNutrition(meals([food({
    nutrients: { ...food().nutrients, fiberGrams: 3, vitaminB12Mcg: 2.3904, ironMg: 46, sodiumMg: 2_400, folateMcg: 100 },
    nutrientForms: { vitaminAMcg: "RAE", folateMcg: "UNSPECIFIED" },
  })]));
  const b12 = buildNutrientReviewGuidance({ reference: reference("vitaminB12Mcg"), total: complete.nutrients.vitaminB12Mcg, referenceComparable: true, sourceUnit: "mcg" });
  assert.match(b12.summary, /99,6% da RDA/);
  assert.ok(b12.comparison.some((text) => text.includes("não diagnostica deficiência")));
  const fiber = buildNutrientReviewGuidance({ reference: reference("fiberGrams"), total: complete.nutrients.fiberGrams, referenceComparable: true, sourceUnit: "g" });
  assert.ok(fiber.comparison.some((text) => text.includes("não permite classificar a ingestão como inadequada")));
  const iron = buildNutrientReviewGuidance({ reference: reference("ironMg"), total: complete.nutrients.ironMg, referenceComparable: true, sourceUnit: "mg" });
  assert.match(iron.summary, /ultrapassa a UL comparável/i);
  const sodium = buildNutrientReviewGuidance({ reference: reference("sodiumMg"), total: complete.nutrients.sodiumMg, referenceComparable: true, sourceUnit: "mg" });
  assert.match(sodium.summary, /ultrapassa a CDRR comparável/i);

  const partialRecipe = {
    ...recipe,
    snapshotNutrients: { ...recipe.snapshotNutrients, fiberGrams: 113.35365 },
    prescribedNutrients: { ...recipe.prescribedNutrients, fiberGrams: 37.78455 },
    partialNutrients: [...(recipe.partialNutrients ?? []), "fiberGrams"],
  } satisfies MealPlanRecordRecipe;
  const partial = analyzeMealPlanNutrition(meals([partialRecipe]));
  const partialFiber = buildNutrientReviewGuidance({ reference: reference("fiberGrams"), total: partial.nutrients.fiberGrams, referenceComparable: true, sourceUnit: "g" });
  assert.match(partialFiber.summary, /subtotal conhecido.*total permanece parcial/i);
  assert.match(partialFiber.summary, /151,1%/);
  assert.doesNotMatch(partialFiber.summary, /151,1382%/);
  assert.ok(partialFiber.comparison.some((text) => text.includes("total completo pode ser maior")));
  assert.ok(partialFiber.possibleAdjustment.some((text) => text.includes("Receita parcial (Almoço)")));
  assert.ok(partialFiber.possibleAdjustment.some((text) => text.includes("snapshot não identifica um ingrediente responsável")));

  const absent = analyzeMealPlanNutrition(meals([recipe]));
  const vitaminC = buildNutrientReviewGuidance({ reference: reference("vitaminCMg"), total: absent.nutrients.vitaminCMg, referenceComparable: true, sourceUnit: "mg" });
  assert.match(vitaminC.summary, /não há composição conhecida/i);
  assert.ok(vitaminC.possibleAdjustment.some((text) => text.includes("Receita parcial (Almoço)")));
  const folate = buildNutrientReviewGuidance({ reference: reference("folateMcg"), total: complete.nutrients.folateMcg, referenceComparable: false, sourceUnit: "mcg de folato (forma não especificada)" });
  assert.ok(folate.comparison.some((text) => text.includes("documentar o valor em equivalentes de folato dietético (DFE)")));
  assert.ok(folate.comparison.some((text) => text.includes("ácido fólico sintético")));
});

test("detalhes da tabela ocupam todas as colunas e usam controle acessível", () => {
  const source = readFileSync(new URL("../../components/meal-plan/meal-plan-adequacy-tab.tsx", import.meta.url), "utf8");
  assert.ok(source.includes("colSpan={7}"));
  assert.ok(source.includes('aria-expanded={expanded}'));
  assert.ok(source.includes('expanded ? "Ocultar detalhes" : "Ver detalhes"'));
  assert.ok(source.includes("lg:grid-cols-3"));
});

test("contribuintes usam itens ativos, quantidade prescrita e receita sem duplicar ingredientes", () => {
  const prescribedFood = food({
    grams: 50,
    prescribedAmount: 50,
    prescribedUnit: "g",
    householdMeasure: "colher",
    primaryHouseholdMeasure: "100 g",
    nutritionBasisUnit: "g",
    measureOptions: [{ name: "colher", gramsPerUnit: 50 }],
    nutrientsPer100g: { ...food().nutrientsPer100g, ironMg: 10 },
    nutrients: { ...food().nutrients, ironMg: 5 },
  });
  const mixed = analyzeMealPlanNutrition(meals([prescribedFood, recipe]));
  const contributors = mixed.nutrients.ironMg.contributors;
  assert.equal(contributors.length, 2);
  assert.deepEqual(
    (({ itemType, prescribedAmount, prescribedUnit, selectedMeasureLabel, documentedEquivalent, nutritionBasis, nutritionCalculationFactor, quantityCompatibility, knownAmount }) => ({ itemType, prescribedAmount, prescribedUnit, selectedMeasureLabel, documentedEquivalent, nutritionBasis, nutritionCalculationFactor, quantityCompatibility, knownAmount }))(contributors[0]!),
    { itemType: "FOOD", prescribedAmount: 50, prescribedUnit: "g", selectedMeasureLabel: "1 colher", documentedEquivalent: { amount: 50, unit: "g" }, nutritionBasis: { amount: 100, unit: "g" }, nutritionCalculationFactor: 0.5, quantityCompatibility: "COMPATIBLE", knownAmount: 5 },
  );
  assert.equal(contributors[0]!.knownAmount, 10 * (50 / 100));
  assert.deepEqual(
    (({ itemType, prescribedAmount, prescribedUnit, prescribedQuantityLabel, knownAmount }) => ({ itemType, prescribedAmount, prescribedUnit, prescribedQuantityLabel, knownAmount }))(contributors[1]!),
    { itemType: "RECIPE", prescribedAmount: 1, prescribedUnit: "SERVING", prescribedQuantityLabel: "1 porção (1/3 da receita)", knownAmount: 2 },
  );
  assert.equal(mixed.nutrients.ironMg.knownAmount, 7);

  const attached = attachMealPlanFoodSubstitution({
    meals: meals([prescribedFood]), mealId: ids.meal, foodId: ids.food,
    replacement: food({ id: ids.replacement, catalogFoodId: "food-b", description: "Alternativa fora do consumo", nutrients: { ...food().nutrients, ironMg: 99 } }),
    substitutionId: ids.substitution, occurredAt: "2026-10-23T12:00:00.000Z",
  });
  const activeOnly = analyzeMealPlanNutrition(attached).nutrients.ironMg;
  assert.equal(activeOnly.knownAmount, 5);
  assert.ok(!activeOnly.contributors.some((item) => item.itemName === "Alternativa fora do consumo"));
});

test("sinaliza base em ml e prescrição em g sem inventar conversão ou recalcular snapshot", () => {
  const historicalMilk = food({
    description: "Leite em snapshot histórico",
    source: "EVONUT",
    primaryHouseholdMeasure: "100 ml",
    standardWeightGrams: 100,
    nutritionBasisUnit: undefined,
    prescribedAmount: 220,
    prescribedUnit: "g",
    grams: 220,
    householdMeasure: "100 ml",
    measureOptions: [{ name: "100 ml", gramsPerUnit: 100 }],
    ibgeMeasureOptions: [{ id: "10000000-0000-4000-8000-000000000009", label: "1 copo — 200 ml", measureName: "Copo", preparationCode: "", preparationName: "", amountPerMeasure: 200, unit: "ml" }],
    selectedIbgeMeasureId: undefined,
    nutrientsPer100g: { ...food().nutrientsPer100g, energyKcal: 42, proteinGrams: 3.37 },
    nutrients: { ...food().nutrients, energyKcal: 92.4, proteinGrams: 7.414 },
  });
  const result = analyzeMealPlanNutrition(meals([historicalMilk]));
  const contributor = result.nutrients.proteinGrams.contributors[0]!;
  assert.equal(contributor.prescribedAmount, 220);
  assert.equal(contributor.prescribedUnit, "g");
  assert.equal(contributor.selectedMeasureLabel, undefined);
  assert.deepEqual(contributor.nutritionBasis, { amount: 100, unit: "ml" });
  assert.equal(contributor.nutritionCalculationFactor, 2.2);
  assert.equal(contributor.quantityCompatibility, "MISSING_CONVERSION");
  assert.equal(contributor.knownAmount, 7.414);
  assert.equal(result.nutrients.proteinGrams.coverage, "PARTIAL");
  const reopened = parseStoredMealPlanPayload(JSON.parse(JSON.stringify({
    schemaVersion: 9,
    status: "DRAFT",
    aiDecision: "IDLE",
    meals: meals([historicalMilk]),
    supplements: [],
    totals: { energyKcal: 92.4, proteinGrams: 7.414, carbohydratesGrams: 15, fatsGrams: 2, fiberGrams: 3 },
  })));
  assert.ok(reopened);
  const reopenedMilk = reopened.meals[0]!.items[0] as MealPlanRecordFood;
  assert.equal(reopenedMilk.prescribedAmount, 220);
  assert.equal(reopenedMilk.prescribedUnit, "g");
  assert.equal(reopenedMilk.nutrients.energyKcal, 92.4);
  assert.equal(reopenedMilk.nutritionBasisUnit, undefined);
});

test("análise usa a prescrição direta em ml sobre a base em ml", () => {
  const milk = food({
    description: "Leite integral",
    source: "EVONUT",
    primaryHouseholdMeasure: "100 ml",
    standardWeightGrams: 100,
    nutritionBasisUnit: "ml",
    prescribedAmount: 250,
    prescribedUnit: "ml",
    grams: 250,
    householdMeasure: "100 ml",
    nutrientsPer100g: {
      ...food().nutrientsPer100g,
      energyKcal: 64.56,
      proteinGrams: 3.2,
    },
    nutrients: {
      ...food().nutrients,
      energyKcal: 161.4,
      proteinGrams: 8,
    },
  });
  const contributor = analyzeMealPlanNutrition(meals([milk])).nutrients
    .proteinGrams.contributors[0]!;
  assert.equal(contributor.prescribedAmount, 250);
  assert.equal(contributor.prescribedUnit, "ml");
  assert.deepEqual(contributor.nutritionBasis, { amount: 100, unit: "ml" });
  assert.equal(contributor.nutritionCalculationFactor, 2.5);
  assert.equal(contributor.quantityCompatibility, "COMPATIBLE");
  assert.equal(contributor.knownAmount, 8);
});

test("rastreia gordura trans completa, parcial e ausente sem fabricar zero", () => {
  const knownFood = food({
    nutrientsPer100g: { ...food().nutrientsPer100g, transFatsGrams: 0 },
    nutrients: { ...food().nutrients, transFatsGrams: 0 },
  });
  assert.deepEqual(
    (({ knownAmount, coverage }) => ({ knownAmount, coverage }))(
      analyzeMealPlanNutrition(meals([knownFood])).nutrients.transFatsGrams,
    ),
    { knownAmount: 0, coverage: "COMPLETE" },
  );
  const partialRecipe = {
    ...recipe,
    snapshotNutrients: { ...recipe.snapshotNutrients, transFatsGrams: 0.6 },
    prescribedNutrients: { ...recipe.prescribedNutrients, transFatsGrams: 0.2 },
    partialNutrients: [...(recipe.partialNutrients ?? []), "transFatsGrams"],
  } satisfies MealPlanRecordRecipe;
  assert.equal(analyzeMealPlanNutrition(meals([partialRecipe])).nutrients.transFatsGrams.coverage, "PARTIAL");
  const absentRecipe = {
    ...recipe,
    snapshotNutrients: { ...recipe.snapshotNutrients, transFatsGrams: null },
    prescribedNutrients: { ...recipe.prescribedNutrients, transFatsGrams: null },
    missingNutrients: [...recipe.missingNutrients, "transFatsGrams"],
  } satisfies MealPlanRecordRecipe;
  assert.deepEqual(
    (({ knownAmount, coverage }) => ({ knownAmount, coverage }))(
      analyzeMealPlanNutrition(meals([absentRecipe])).nutrients.transFatsGrams,
    ),
    { knownAmount: null, coverage: "ABSENT" },
  );
});

test("alternativa permanece vinculada e fora do total consumido", () => {
  const original = food();
  const replacementMeasure = {
    id: ids.user,
    label: "1 colher de sopa — 25 g",
    measureName: "Colher de sopa",
    preparationCode: "",
    preparationName: "",
    amountPerMeasure: 25,
    unit: "g" as const,
  };
  const replacement = food({
    id: ids.replacement,
    catalogFoodId: "food-b",
    description: "Alimento B",
    grams: 50,
    prescribedAmount: 50,
    quantity: 2,
    householdMeasure: "100 g",
    ibgeMeasureOptions: [replacementMeasure],
    selectedIbgeMeasureId: replacementMeasure.id,
  });
  const attached = attachMealPlanFoodSubstitution({ meals: meals([original]), mealId: ids.meal, foodId: ids.food, replacement, substitutionId: ids.substitution, occurredAt: "2026-10-23T12:00:00.000Z", suggestionReason: "Equivalência energética e de macronutrientes." });
  assert.equal(analyzeMealPlanNutrition(attached).nutrients.energyKcal.knownAmount, 100);
  const attachedFood = attached[0]!.items[0] as MealPlanRecordFood;
  assert.equal(attachedFood.substitutions[0]?.replacementPrescribedAmount, 50);
  assert.equal(
    attachedFood.substitutions[0]?.replacementHouseholdMeasure,
    "1 colher de sopa — 25 g",
  );
  const recalculated = recalculateMealPlanSubstitutions(attachedFood, { ...attachedFood, grams: 200, prescribedAmount: 200 });
  assert.equal(recalculated.substitutions[0]?.replacementPrescribedAmount, 100);
  assert.equal(recalculated.substitutions[0]?.needsProfessionalReview, true);
});

test("micronutriente parcial exige revisão, mas não bloqueia depois do reconhecimento; mudança invalida", () => {
  const currentMeals = meals([food(), recipe]);
  const fingerprint = mealPlanContentFingerprint(currentMeals);
  const review = { reviewedByUserId: ids.user, reviewedByName: "Profissional", reviewedAt: "2026-10-23T12:00:00.000Z", planRevision: 4, contentFingerprint: fingerprint, acknowledgedLimitations: [], statement: "Plano e limitações revisados." };
  const before = evaluateMealPlanCompletion({ meals: currentMeals, planRevision: 4 });
  assert.equal(before.allowed, false);
  assert.ok(before.limitations.some((item) => item.includes("vitaminCMg")));
  assert.equal(evaluateMealPlanCompletion({ meals: currentMeals, planRevision: 4, review }).allowed, true);
  const changed = meals([{ ...food(), grams: 120, prescribedAmount: 120 }]);
  assert.equal(evaluateMealPlanCompletion({ meals: changed, planRevision: 4, review }).allowed, false);
});

test("desvio da meta exige autorização explícita, aceita decisão e invalida quando muda", () => {
  assert.equal(FINAL_NUTRITION_TARGET_TOLERANCE_PERCENT, 5);
  const target = { energyKcal: 2_000, proteinGrams: 100, carbohydratesGrams: 250, fatsGrams: 70 };
  const currentMeals = meals([food()]);
  const review = { reviewedByUserId: ids.user, reviewedByName: "Profissional", reviewedAt: "2026-10-23T12:00:00.000Z", planRevision: 4, contentFingerprint: mealPlanContentFingerprint(currentMeals), acknowledgedLimitations: [], statement: "Revisado." };
  const within = calculateMealPlanTargetDeviations({
    target,
    actual: { energyKcal: 1_900, proteinGrams: 95, carbohydratesGrams: 237.5, fatsGrams: 66.5 },
  });
  assert.equal(within.some((item) => item.outsideTolerance), false);
  assert.equal(evaluateMealPlanCompletion({ meals: currentMeals, planRevision: 4, review, targetDeviations: within }).allowed, true);

  const outside = calculateMealPlanTargetDeviations({
    target,
    actual: { energyKcal: 1_899, proteinGrams: 94, carbohydratesGrams: 237.5, fatsGrams: 66.5 },
  });
  const withoutAuthorization = evaluateMealPlanCompletion({ meals: currentMeals, planRevision: 4, review, targetDeviations: outside });
  assert.equal(withoutAuthorization.allowed, false);
  assert.ok(withoutAuthorization.blockingReasons.some((item) => item.includes("autorize explicitamente")));
  const authorization = {
    authorizedByUserId: ids.user,
    authorizedByName: "Profissional",
    authorizedAt: "2026-10-23T12:05:00.000Z",
    planRevision: 4,
    tolerancePercent: 5,
    deviationFingerprint: mealPlanTargetDeviationFingerprint(outside),
    deviations: outside,
    statement: "Adequação gradual da alimentação.",
  };
  assert.equal(evaluateMealPlanCompletion({ meals: currentMeals, planRevision: 4, review, targetDeviations: outside, targetDeviationAuthorization: authorization }).allowed, true);

  const changed = calculateMealPlanTargetDeviations({
    target,
    actual: { energyKcal: 1_850, proteinGrams: 92, carbohydratesGrams: 230, fatsGrams: 64 },
  });
  assert.equal(evaluateMealPlanCompletion({ meals: currentMeals, planRevision: 4, review, targetDeviations: changed, targetDeviationAuthorization: authorization }).allowed, false);

  const changedStrategy = calculateMealPlanTargetDeviations({
    target: { ...target, energyKcal: 2_100 },
    actual: { energyKcal: 1_899, proteinGrams: 94, carbohydratesGrams: 237.5, fatsGrams: 66.5 },
  });
  assert.equal(evaluateMealPlanCompletion({ meals: currentMeals, planRevision: 4, review, targetDeviations: changedStrategy, targetDeviationAuthorization: authorization }).allowed, false);

  const technicallyInvalidMeals = meals([{ ...food(), prescribedAmount: 0, quantity: 0, grams: 0 }]);
  const invalidMealsResult = evaluateMealPlanCompletion({
    meals: technicallyInvalidMeals,
    planRevision: 4,
    review: {
      ...review,
      contentFingerprint: mealPlanContentFingerprint(technicallyInvalidMeals),
    },
    targetDeviations: outside,
    targetDeviationAuthorization: authorization,
  });
  assert.equal(invalidMealsResult.allowed, false);
  assert.ok(invalidMealsResult.blockingReasons.some((item) => item.includes("Revise quantidade")));

  const invalid = calculateMealPlanTargetDeviations({
    target: { ...target, energyKcal: 0 },
    actual: { energyKcal: 1_900, proteinGrams: 95, carbohydratesGrams: 237.5, fatsGrams: 66.5 },
  });
  const invalidResult = evaluateMealPlanCompletion({ meals: currentMeals, planRevision: 4, review, targetDeviations: invalid, targetDeviationAuthorization: { ...authorization, deviationFingerprint: mealPlanTargetDeviationFingerprint(invalid), deviations: invalid } });
  assert.equal(invalidResult.allowed, false);
  assert.ok(invalidResult.blockingReasons.some((item) => item.includes("comparação técnica")));
});

test("salvar e reabrir preserva perfil, alternativa, snapshot e revisão da versão 9", () => {
  const replacementMeasure = {
    id: ids.user,
    label: "1 colher de sopa — 25 g",
    measureName: "Colher de sopa",
    preparationCode: "",
    preparationName: "",
    amountPerMeasure: 25,
    unit: "g" as const,
  };
  const currentMeals = attachMealPlanFoodSubstitution({
    meals: meals([food(), recipe]), mealId: ids.meal, foodId: ids.food,
    replacement: food({
      id: ids.replacement,
      catalogFoodId: "food-b",
      description: "Alternativa",
      grams: 50,
      prescribedAmount: 50,
      quantity: 2,
      ibgeMeasureOptions: [replacementMeasure],
      selectedIbgeMeasureId: replacementMeasure.id,
    }),
    substitutionId: ids.substitution, occurredAt: "2026-10-23T12:00:00.000Z",
  });
  const currentProfile = profile();
  const fingerprint = mealPlanContentFingerprint(currentMeals);
  const deviations = calculateMealPlanTargetDeviations({
    target: { energyKcal: 100, proteinGrams: 10, carbohydratesGrams: 20, fatsGrams: 10 },
    actual: { energyKcal: 110, proteinGrams: 20, carbohydratesGrams: 25, fatsGrams: 12 },
  });
  const parsed = parseStoredMealPlanPayload(JSON.parse(JSON.stringify({
    schemaVersion: 9,
    status: "APPROVED",
    aiDecision: "IDLE",
    meals: currentMeals,
    supplements: [],
    totals: { energyKcal: 110, proteinGrams: 20, carbohydratesGrams: 25, fatsGrams: 12, fiberGrams: 3 },
    dietaryReferenceProfile: currentProfile,
    dietaryReferences: selectDietaryReferences(currentProfile),
    professionalReview: { reviewedByUserId: ids.user, reviewedByName: "Profissional", reviewedAt: "2026-10-23T12:00:00.000Z", planRevision: 4, contentFingerprint: fingerprint, acknowledgedLimitations: ["vitaminCMg: composição ausente"], statement: "Revisado." },
    targetDeviationAuthorization: { authorizedByUserId: ids.user, authorizedByName: "Profissional", authorizedAt: "2026-10-23T12:01:00.000Z", planRevision: 4, tolerancePercent: 5, deviationFingerprint: mealPlanTargetDeviationFingerprint(deviations), deviations, statement: "Adequação gradual." },
  })));
  assert.ok(parsed);
  assert.deepEqual(parsed.dietaryReferenceProfile, currentProfile);
  assert.equal(parsed.dietaryReferences?.find((item) => item.nutrient === "sodiumMg")?.source.edition, "NASEM DRI Sodium and Potassium (2019)");
  assert.equal(parsed.professionalReview?.contentFingerprint, fingerprint);
  assert.equal(parsed.targetDeviationAuthorization?.statement, "Adequação gradual.");
  assert.equal(parsed.targetDeviationAuthorization?.deviations[0]?.planned, 110);
  const reopenedSubstitution = (parsed.meals[0]!.items[0] as MealPlanRecordFood).substitutions[0];
  assert.equal(reopenedSubstitution?.replacementDescription, "Alternativa");
  assert.equal(reopenedSubstitution?.replacementQuantity, 2);
  assert.equal(reopenedSubstitution?.replacementHouseholdMeasure, "1 colher de sopa — 25 g");
  assert.equal(reopenedSubstitution?.replacementPrescribedAmount, 50);
  assert.equal(reopenedSubstitution?.replacementPrescribedUnit, "g");
  assert.equal(analyzeMealPlanNutrition(parsed.meals).nutrients.energyKcal.knownAmount, 110);
  assert.ok(!analyzeMealPlanNutrition(parsed.meals).nutrients.energyKcal.contributors.some(
    (item) => item.itemName === "Alternativa",
  ));
  assert.equal((parsed.meals[0]!.items[1] as MealPlanRecordRecipe).recipeNutritionSnapshotVersion, 3);
});

test("salvar e reabrir preserva forma e origem parcial da receita", () => {
  const recipeWithForms = {
    ...recipe,
    nutrientForms: { vitaminAMcg: "RE", folateMcg: "UNSPECIFIED" },
    partialNutrients: [...(recipe.partialNutrients ?? []), "fiberGrams"],
  } satisfies MealPlanRecordRecipe;
  const parsed = parseStoredMealPlanPayload(JSON.parse(JSON.stringify({
    schemaVersion: 9,
    status: "DRAFT",
    aiDecision: "IDLE",
    meals: meals([recipeWithForms]),
    supplements: [],
    totals: { energyKcal: 10, proteinGrams: 10, carbohydratesGrams: 10, fatsGrams: 10, fiberGrams: 0 },
  })));
  assert.ok(parsed);
  const reopened = parsed.meals[0]!.items[0] as MealPlanRecordRecipe;
  assert.deepEqual(reopened.nutrientForms, { vitaminAMcg: "RE", folateMcg: "UNSPECIFIED" });
  assert.ok(reopened.partialNutrients.includes("fiberGrams"));
});

test("reabre snapshot histórico sem gordura trans como ausente, sem criar zero", () => {
  const historical = JSON.parse(JSON.stringify({
    schemaVersion: 9,
    status: "DRAFT",
    aiDecision: "IDLE",
    meals: meals([food(), recipe]),
    supplements: [],
    totals: { energyKcal: 110, proteinGrams: 20, carbohydratesGrams: 25, fatsGrams: 12, fiberGrams: 3 },
    dietaryReferenceProfile: profile({ lifeStage: "UNKNOWN" }),
  })) as { meals: Array<{ items: Array<Record<string, unknown>> }> };
  for (const item of historical.meals[0]!.items) {
    if (item.itemType === "RECIPE") {
      delete (item.snapshotNutrients as Record<string, unknown>).transFatsGrams;
      delete (item.prescribedNutrients as Record<string, unknown>).transFatsGrams;
      item.missingNutrients = (item.missingNutrients as string[]).filter((key) => key !== "transFatsGrams");
    } else {
      delete (item.nutrientsPer100g as Record<string, unknown>).transFatsGrams;
      delete (item.nutrients as Record<string, unknown>).transFatsGrams;
    }
  }
  const parsed = parseStoredMealPlanPayload(historical);
  assert.ok(parsed);
  const parsedFood = parsed.meals[0]!.items[0] as MealPlanRecordFood;
  const parsedRecipe = parsed.meals[0]!.items[1] as MealPlanRecordRecipe;
  assert.equal(parsedFood.nutrients.transFatsGrams, null);
  assert.equal(parsedRecipe.snapshotNutrients.transFatsGrams, null);
  assert.ok(parsedRecipe.missingNutrients.includes("transFatsGrams"));
  assert.equal(parsedRecipe.nutritionCompleteness, "PARTIAL");
  assert.equal(parsed.dietaryReferenceProfile?.lifeStage, "UNKNOWN");
});
