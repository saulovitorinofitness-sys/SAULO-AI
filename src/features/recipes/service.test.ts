import assert from "node:assert/strict";
import test from "node:test";

import type { FrontendAccessSnapshot } from "@/features/mvp";

import { createRecipeService, RecipeServiceError } from "./service";
import { parseRecipeContentSnapshot } from "./recipe-content-snapshot";

const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
const UNIT_A = "10000000-0000-4000-8000-000000000001";
const UNIT_B = "10000000-0000-4000-8000-000000000002";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function session(userId = USER_A): FrontendAccessSnapshot {
  return {
    user: {
      id: userId,
      fullName: "Profissional",
      email: "profissional@example.test",
      roleName: "Administrador",
      status: "ACTIVE",
    },
    grantsAllModules: true,
    allowsNutritionModules: true,
    overrides: [],
  };
}

function completeFood(id = "food-a") {
  const nutrients: Record<string, number | null> = {
    energyKcal: 200,
    carbohydratesGrams: 30,
    sugarsGrams: 5,
    proteinGrams: 20,
    fatsGrams: 6,
    saturatedFatsGrams: 2,
    cholesterolMg: 15,
    monounsaturatedFatsGrams: 1.5,
    polyunsaturatedFatsGrams: 0.8,
    fiberGrams: 4,
    sodiumMg: 100,
    calciumMg: 80,
    ironMg: 2,
    magnesiumMg: 30,
    phosphorusMg: 120,
    potassiumMg: 250,
    zincMg: 1.2,
    copperMg: 0.2,
    manganeseMg: 0.4,
    seleniumMcg: 10,
    vitaminAMcg: 50,
    vitaminCMg: 5,
    vitaminDMcg: 1,
    vitaminEMg: 0.7,
    vitaminKMcg: 3,
    thiamineMg: 0.1,
    riboflavinMg: 0.2,
    niacinMg: 1,
    vitaminB6Mg: 0.15,
    folateMcg: 20,
    vitaminB12Mcg: 0.5,
  };
  return {
    id,
    officialName: `Alimento ${id}`,
    status: "ACTIVE",
    referenceServingUnit: "g",
    source: { kind: "EVONUT", name: "TACO" },
    nutrients,
    nutrientObservations: [
      { nutrientKey: "additional:energyKj", numericValue: 836.8, valueStatus: "NUMERIC" },
      { nutrientKey: "addedSugarsGrams", numericValue: 0, valueStatus: "NUMERIC" },
      { nutrientKey: "transFatsGrams", numericValue: 0, valueStatus: "NUMERIC" },
    ],
  };
}

interface MemoryState {
  recipes: Array<Record<string, unknown>>;
  ingredients: Array<Record<string, unknown>>;
  steps: Array<Record<string, unknown>>;
  snapshots: Array<Record<string, unknown>>;
  foods: Array<ReturnType<typeof completeFood>>;
  measures: Array<Record<string, unknown>>;
  failIngredientCreate: boolean;
}

function memoryDatabase() {
  const state: MemoryState = {
    recipes: [],
    ingredients: [],
    steps: [],
    snapshots: [],
    foods: [completeFood(), completeFood("food-b")],
    measures: [
      { id: "measure-a", foodId: "food-a", active: true, name: "Colher", quantity: 1, grams: 25 },
      { id: "measure-b", foodId: "food-b", active: true, name: "Fatia", quantity: 1, grams: 40 },
    ],
    failIngredientCreate: false,
  };
  let sequence = 0;
  const id = (prefix: string) => `${prefix}-${++sequence}`;

  const fullRecipe = (recipe: Record<string, unknown>) => ({
    ...recipe,
    ingredients: state.ingredients
      .filter((item) => item.recipeId === recipe.id)
      .sort((a, b) => Number(a.position) - Number(b.position)),
    preparationSteps: state.steps
      .filter((item) => item.recipeId === recipe.id)
      .sort((a, b) => Number(a.position) - Number(b.position)),
    nutritionSnapshots: state.snapshots
      .filter((item) => item.recipeId === recipe.id)
      .sort((a, b) => Number(b.version) - Number(a.version)),
  });

  const whereMatches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => row[key] === value);

  const delegates = {
    recipe: {
      async create(args: Record<string, unknown>) {
        const data = args.data as Record<string, unknown>;
        const recipe = { id: id("recipe"), ...data, ingredients: [], preparationSteps: [], nutritionSnapshots: [] };
        state.recipes.push(recipe);
        return fullRecipe(recipe);
      },
      async findFirst(args: Record<string, unknown>) {
        const where = args.where as Record<string, unknown>;
        const recipe = state.recipes.find((item) => whereMatches(item, where));
        return recipe ? fullRecipe(recipe) : null;
      },
      async findMany(args: Record<string, unknown>) {
        const where = args.where as Record<string, unknown>;
        return state.recipes.filter((item) => whereMatches(item, where)).map(fullRecipe);
      },
      async update(args: Record<string, unknown>) {
        const where = args.where as Record<string, unknown>;
        const recipe = state.recipes.find((item) => whereMatches(item, where));
        if (!recipe) throw new Error("recipe missing");
        Object.assign(recipe, args.data as Record<string, unknown>);
        return fullRecipe(recipe);
      },
    },
    food: {
      async findFirst(args: Record<string, unknown>) {
        const where = args.where as Record<string, unknown>;
        return state.foods.find((item) => item.id === where.id && item.status === where.status) ?? null;
      },
    },
    foodHouseholdMeasure: {
      async findFirst(args: Record<string, unknown>) {
        const where = args.where as Record<string, unknown>;
        return state.measures.find((item) => whereMatches(item, where)) ?? null;
      },
    },
    recipeIngredient: {
      async create(args: Record<string, unknown>) {
        const data = args.data as Record<string, unknown>;
        const food = state.foods.find((item) => item.id === data.foodId)!;
        const householdMeasure = state.measures.find((item) => item.id === data.householdMeasureId) ?? null;
        const ingredient = { id: id("ingredient"), ...data, food, householdMeasure };
        state.ingredients.push(ingredient);
        if (state.failIngredientCreate) throw new Error("simulated failure");
        return ingredient;
      },
      async findFirst(args: Record<string, unknown>) {
        const where = args.where as Record<string, unknown>;
        return state.ingredients.find((item) => whereMatches(item, where)) ?? null;
      },
      async update(args: Record<string, unknown>) {
        const where = args.where as Record<string, unknown>;
        const item = state.ingredients.find((entry) => whereMatches(entry, where))!;
        Object.assign(item, args.data as Record<string, unknown>);
        return item;
      },
      async updateMany(args: Record<string, unknown>) {
        const where = args.where as Record<string, unknown>;
        state.ingredients.filter((item) => whereMatches(item, where)).forEach((item) => Object.assign(item, args.data));
        return {};
      },
      async delete(args: Record<string, unknown>) {
        const where = args.where as Record<string, unknown>;
        state.ingredients = state.ingredients.filter((item) => !whereMatches(item, where));
        return {};
      },
      async count(args: Record<string, unknown>) {
        const where = args.where as Record<string, unknown>;
        return state.ingredients.filter((item) => whereMatches(item, where)).length;
      },
    },
    recipePreparationStep: {
      async create(args: Record<string, unknown>) {
        const step = { id: id("step"), ...(args.data as Record<string, unknown>) };
        state.steps.push(step);
        return step;
      },
      async findFirst(args: Record<string, unknown>) {
        const where = args.where as Record<string, unknown>;
        return state.steps.find((item) => whereMatches(item, where)) ?? null;
      },
      async update(args: Record<string, unknown>) {
        const where = args.where as Record<string, unknown>;
        const item = state.steps.find((entry) => whereMatches(entry, where))!;
        Object.assign(item, args.data as Record<string, unknown>);
        return item;
      },
      async updateMany(args: Record<string, unknown>) {
        const where = args.where as Record<string, unknown>;
        state.steps.filter((item) => whereMatches(item, where)).forEach((item) => Object.assign(item, args.data));
        return {};
      },
      async delete(args: Record<string, unknown>) {
        const where = args.where as Record<string, unknown>;
        state.steps = state.steps.filter((item) => !whereMatches(item, where));
        return {};
      },
      async count(args: Record<string, unknown>) {
        const where = args.where as Record<string, unknown>;
        return state.steps.filter((item) => whereMatches(item, where)).length;
      },
    },
    recipeNutritionSnapshot: {
      async aggregate(args: Record<string, unknown>) {
        const where = args.where as Record<string, unknown>;
        const versions = state.snapshots.filter((item) => whereMatches(item, where)).map((item) => Number(item.version));
        return { _max: { version: versions.length ? Math.max(...versions) : null } };
      },
      async create(args: Record<string, unknown>) {
        const snapshot = { id: id("snapshot"), ...(args.data as Record<string, unknown>) };
        state.snapshots.push(snapshot);
        return snapshot;
      },
    },
  };

  const database = {
    ...delegates,
    async $transaction<T>(operation: (transaction: typeof delegates) => Promise<T>) {
      const backup = structuredClone(state);
      try {
        return await operation(delegates);
      } catch (error) {
        Object.assign(state, backup);
        throw error;
      }
    },
  };
  return { database, state };
}

function serviceFixture(userId = USER_A) {
  const memory = memoryDatabase();
  return {
    ...memory,
    service: createRecipeService({
      database: memory.database as never,
      getSession: async () => session(userId),
    }),
  };
}

async function createReadyRecipe(fixture: ReturnType<typeof serviceFixture>) {
  const recipe = await fixture.service.create(
    { businessUnitId: UNIT_A },
    {
      title: "Bolo profissional",
      preparationMethod: "Misture e asse até concluir o preparo.",
      finalYieldAmount: 200,
      finalYieldUnit: "GRAM",
      servings: 2,
      servingSize: 100,
      servingSizeUnit: "GRAM",
    },
  );
  await fixture.service.addIngredient(
    { businessUnitId: UNIT_A },
    recipe.id,
    {
      foodId: "food-a",
      grossQuantity: 100,
      netQuantity: 100,
      quantityUnit: "GRAM",
    },
  );
  return recipe;
}

test("cria rascunho e lista somente proprietário e unidade", async () => {
  const fixture = serviceFixture();
  const created = await fixture.service.create(
    { businessUnitId: UNIT_A },
    { title: "Receita A" },
  );
  assert.equal(created.status, "DRAFT");
  assert.equal(created.ownerUserId, USER_A);
  assert.equal(created.businessUnitId, UNIT_A);
  assert.equal((await fixture.service.list({ businessUnitId: UNIT_A })).length, 1);
  assert.equal((await fixture.service.list({ businessUnitId: UNIT_B })).length, 0);

  const otherUserService = createRecipeService({
    database: fixture.database as never,
    getSession: async () => session(USER_B),
  });
  await assert.rejects(
    () => otherUserService.get({ businessUnitId: UNIT_A }, created.id),
    (error) => error instanceof RecipeServiceError && error.code === "NOT_FOUND",
  );
});

test("recusa alimento inexistente e medida incompatível", async () => {
  const fixture = serviceFixture();
  const recipe = await fixture.service.create({ businessUnitId: UNIT_A }, { title: "Receita A" });
  await assert.rejects(
    () => fixture.service.addIngredient({ businessUnitId: UNIT_A }, recipe.id, {
      foodId: "missing",
      grossQuantity: 100,
      netQuantity: 100,
      quantityUnit: "GRAM",
    }),
    (error) => error instanceof RecipeServiceError && error.code === "NOT_FOUND",
  );
  await assert.rejects(
    () => fixture.service.addIngredient({ businessUnitId: UNIT_A }, recipe.id, {
      foodId: "food-a",
      householdMeasureId: "measure-b",
      householdMeasureQuantity: 1,
      grossQuantity: 40,
      quantityUnit: "GRAM",
    }),
    (error) => error instanceof RecipeServiceError && error.code === "INVALID_INPUT",
  );
});

test("calcula receita completa e cria versões imutáveis de snapshot", async () => {
  const fixture = serviceFixture();
  const recipe = await createReadyRecipe(fixture);
  const first = await fixture.service.calculate({ businessUnitId: UNIT_A }, recipe.id);
  assert.equal(first.complete, true);
  assert.equal(first.snapshotVersion, 1);
  assert.equal(first.total.energyKcal.value, 200);
  assert.equal(first.total.calciumMg.value, 80);
  assert.equal(fixture.state.snapshots[0]?.calciumMg, 80);
  const content = parseRecipeContentSnapshot(
    fixture.state.snapshots[0]?.recipeContentSnapshot,
  );
  assert.ok(content);
  assert.equal(content.title, "Bolo profissional");
  assert.equal(content.ingredients[0]?.foodName, "Alimento food-a");
  assert.equal(content.ingredients[0]?.grossQuantity, 100);
  assert.equal(content.ingredients[0]?.quantityUnit, "GRAM");
  assert.equal(
    content.preparationMethod,
    "Misture e asse até concluir o preparo.",
  );
  assert.deepEqual(content.finalYield, { amount: 200, unit: "GRAM" });
  assert.equal(content.servings, 2);
  const preserved = structuredClone(fixture.state.snapshots[0]);

  const second = await fixture.service.calculate({ businessUnitId: UNIT_A }, recipe.id);
  assert.equal(second.snapshotVersion, 2);
  assert.equal(fixture.state.snapshots.length, 2);
  assert.deepEqual(fixture.state.snapshots[0], preserved);
});

test("persiste e reabre subtotal parcial com estado científico sem exigir rendimento final", async () => {
  const fixture = serviceFixture();
  fixture.state.foods[1].nutrients.sodiumMg = null;
  const recipe = await fixture.service.create(
    { businessUnitId: UNIT_A },
    {
      title: "Panqueca por porções",
      preparationMethod: "Misture e prepare.",
      servings: 3,
    },
  );
  await fixture.service.addIngredient(
    { businessUnitId: UNIT_A },
    recipe.id,
    {
      foodId: "food-a",
      grossQuantity: 100,
      netQuantity: 100,
      quantityUnit: "GRAM",
    },
  );
  await fixture.service.addIngredient(
    { businessUnitId: UNIT_A },
    recipe.id,
    {
      foodId: "food-b",
      grossQuantity: 100,
      netQuantity: 100,
      quantityUnit: "GRAM",
    },
  );

  const result = await fixture.service.calculate({ businessUnitId: UNIT_A }, recipe.id);
  assert.equal(result.complete, false);
  assert.equal(result.calculationStatus, "PARTIAL");
  assert.equal(result.snapshotVersion, 1);
  assert.equal(result.per100, null);
  assert.ok(
    result.perServing?.energyKcal.value !== null &&
      Math.abs(result.perServing.energyKcal.value - 400 / 3) < 1e-9,
  );
  assert.equal(fixture.state.snapshots.length, 1);
  assert.ok(result.pendings.some((pending) => pending.nutrient === "sodiumMg"));

  const reopened = await fixture.service.get({ businessUnitId: UNIT_A }, recipe.id);
  assert.equal(reopened.nutritionSnapshots.length, 1);
  assert.equal(Number(reopened.nutritionSnapshots[0]?.servings), 3);
  assert.equal(reopened.nutritionSnapshots[0]?.finalYieldAmount, null);
  assert.equal(Number(reopened.nutritionSnapshots[0]?.sodiumMg), 100);
  assert.equal(Number(reopened.nutritionSnapshots[0]?.energyKcal), 400);
  const additional = reopened.nutritionSnapshots[0]?.additionalNutrients;
  assert.ok(isRecord(additional));
  const states = additional.nutrientStates;
  assert.ok(isRecord(states));
  assert.equal(
    states.sodiumMg,
    "PARTIAL",
  );

  const listed = await fixture.service.list({ businessUnitId: UNIT_A });
  assert.equal(listed[0]?.nutritionSnapshots[0]?.id, reopened.nutritionSnapshots[0]?.id);
  assert.equal(Number(listed[0]?.nutritionSnapshots[0]?.servings), 3);
});

test("converte kcal do mesmo alimento em kJ quando a fonte não traz kJ explícito", async () => {
  const fixture = serviceFixture();
  fixture.state.foods[0].nutrientObservations =
    fixture.state.foods[0].nutrientObservations.filter(
      (observation) => observation.nutrientKey !== "additional:energyKj",
    );
  const recipe = await createReadyRecipe(fixture);

  const result = await fixture.service.calculate(
    { businessUnitId: UNIT_A },
    recipe.id,
  );

  const energyKj = result.ingredients[0].nutrients.energyKj;
  assert.equal(energyKj.status, "VALUE");
  assert.ok(energyKj.value !== null);
  assert.ok(Math.abs(energyKj.value - 836.8) < 1e-9);
  assert.equal(result.ingredients[0].scientificSource, "TACO");
});

test("calcula formato importado pela equivalência resolvida e preserva medida e porções", async () => {
  const fixture = serviceFixture();
  const recipe = await fixture.service.create(
    { businessUnitId: UNIT_A },
    {
      title: "Receita importada",
      preparationMethod: "Misture e asse.",
      servings: 10,
      servingSize: 50,
      servingSizeUnit: "GRAM",
    },
  );
  await fixture.service.addIngredient(
    { businessUnitId: UNIT_A },
    recipe.id,
    {
      foodId: "food-a",
      grossQuantity: 150,
      netQuantity: 150,
      quantityUnit: "GRAM",
      householdMeasureQuantity: 150,
      householdMeasureDescription: "Gramas",
    },
  );
  Object.assign(fixture.state.ingredients[0], {
    grossQuantity: null,
    netQuantity: null,
    quantityGrams: 150,
  });

  const result = await fixture.service.calculate(
    { businessUnitId: UNIT_A },
    recipe.id,
  );

  assert.equal(result.ingredients[0].grossQuantity, null);
  assert.equal(result.ingredients[0].netQuantity, 150);
  assert.equal(result.total.energyKcal.value, 300);
  assert.equal(result.perServing?.energyKcal.value, 30);
  assert.equal(result.per100, null);
  assert.equal(result.servings, 10);
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
  const content = parseRecipeContentSnapshot(
    fixture.state.snapshots[0]?.recipeContentSnapshot,
  );
  assert.ok(content);
  assert.equal(content.servings, 10);
  assert.equal(content.ingredients[0]?.householdMeasureQuantity, 150);
  assert.equal(content.ingredients[0]?.householdMeasureDescription, "Gramas");
  assert.equal(content.finalYield, null);
});

test("transação restaura integralmente o estado quando a gravação falha", async () => {
  const fixture = serviceFixture();
  const recipe = await fixture.service.create({ businessUnitId: UNIT_A }, { title: "Receita A" });
  fixture.state.failIngredientCreate = true;
  await assert.rejects(() => fixture.service.addIngredient({ businessUnitId: UNIT_A }, recipe.id, {
    foodId: "food-a",
    grossQuantity: 100,
    netQuantity: 100,
    quantityUnit: "GRAM",
  }));
  assert.equal(fixture.state.ingredients.length, 0);
});
