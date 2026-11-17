import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";

import { householdMeasureRepository } from "../food-database/household-measure-repository";
import { foodRepository } from "../food-database/repository";
import { prisma } from "../../lib/database/prisma";
import { GET as getHouseholdMeasures } from "../../app/api/foods/[foodId]/household-measures/route";
import {
  attachConfirmedIbgeMeasures,
  canonicalizeMealPlanDraftFoods,
  createMealPlanFoodFromMaster,
  mealPlanMeasureSelectionId,
  mealPlanMeasureDisplayOptions,
  selectIbgeMeasureForDisplay,
} from "./food-snapshot";
import {
  calculateFoodNutrientsForGrams,
  calculateMealPlanTotals,
  updateMealPlanFoodPortion,
} from "./nutrition-calculations";
import { parseMealPlanRecordDraft } from "./record";

after(async () => {
  await prisma.$disconnect();
});

const requiredQueries = [
  { label: "arroz", query: "arroz" },
  { label: "arroz integral", query: "integral", foodName: "arroz" },
  { label: "feijão", query: "feijão" },
  { label: "banana", query: "banana" },
  { label: "café", query: "café" },
  { label: "leite", query: "leite" },
  { label: "ovo", query: "ovo" },
  { label: "frango", query: "frango" },
  { label: "batata-doce", query: "doce", foodName: "batata" },
  { label: "mandioca", query: "mandioca" },
] as const;

test("carrega somente medidas IBGE confirmadas do alimento TACO correto", async () => {
  const optionIds: string[] = [];
  for (const required of requiredQueries) {
    const result = (await foodRepository.search({
      query: required.query,
      source: "TACO",
      pageSize: 12,
    })).items;
    const foods = "foodName" in required
      ? result.filter((food) => food.normalizedName.includes(required.foodName))
      : result;
    assert.ok(foods.length > 0, `${required.label} deve existir na TACO`);
    for (const food of foods) {
      const options = await householdMeasureRepository.findConfirmedOptionsByFoodId(food.id);
      optionIds.push(...options.map((option) => option.id));
    }
  }
  assert.ok(optionIds.length > 0);

  const rows = await prisma.foodHouseholdMeasureReference.findMany({
    where: { id: { in: optionIds } },
    select: { id: true, foodId: true, matchStatus: true },
  });
  assert.equal(rows.length, new Set(optionIds).size);
  assert.ok(rows.every((row) => row.foodId && row.matchStatus === "CONFIRMED"));
});

test("rótulos usam medida, preparação necessária e equivalência reais", async () => {
  const tacoFoods = await prisma.food.findMany({
    where: {
      source: { kind: "TACO" },
      measureReferences: { some: { matchStatus: "CONFIRMED" } },
    },
    select: { id: true },
  });
  const optionsByFood = await householdMeasureRepository.findConfirmedOptionsByFoodIds(
    tacoFoods.map((food) => food.id),
  );
  const optionIds = [...optionsByFood.values()].flatMap((options) =>
    options.map((option) => option.id),
  );
  const rows = await prisma.foodHouseholdMeasureReference.findMany({
    where: { id: { in: optionIds } },
    select: {
      id: true,
      foodId: true,
      measureName: true,
      preparationCode: true,
      preparationName: true,
      quantityValue: true,
      quantityUnit: true,
    },
  });
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const preparationsByFood = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.foodId) continue;
    const preparations = preparationsByFood.get(row.foodId) ?? new Set<string>();
    preparations.add(row.preparationCode);
    preparationsByFood.set(row.foodId, preparations);
  }

  for (const [foodId, options] of optionsByFood) {
    for (const option of options) {
      const row = rowById.get(option.id);
      assert.ok(row);
      assert.equal(row.foodId, foodId);
      assert.ok(option.label.startsWith(`1 ${row.measureName.toLocaleLowerCase("pt-BR")} — `));
      assert.ok(option.label.endsWith(` ${row.quantityUnit}`));
      if ((preparationsByFood.get(foodId)?.size ?? 0) > 1) {
        assert.ok(option.label.includes(`— ${row.preparationName} —`));
      }
    }
  }
});

test("fallback usa entrada manual em gramas quando não existe vínculo confirmado", async () => {
  const foods = (await foodRepository.search({
    query: "integral",
    source: "TACO",
    pageSize: 20,
  })).items.filter((food) => food.normalizedName.includes("arroz"));
  let fallbackFood = null as (typeof foods)[number] | null;
  for (const food of foods) {
    if (!(await householdMeasureRepository.findConfirmedOptionsByFoodId(food.id)).length) {
      fallbackFood = food;
      break;
    }
  }
  assert.ok(fallbackFood);
  const item = createMealPlanFoodFromMaster(fallbackFood, crypto.randomUUID());
  assert.ok(item);
  assert.deepEqual(mealPlanMeasureDisplayOptions(item), [
    { id: "DIRECT_G", label: "Gramas" },
  ]);
});

test("base em ml oferece prescrição direta em ml sem ocultar o registro histórico em g", () => {
  const options = mealPlanMeasureDisplayOptions({
    prescribedUnit: "g",
    nutritionBasisUnit: "ml",
    standardWeightGrams: 100,
    selectedIbgeMeasureId: undefined,
    ibgeMeasureOptions: [
      {
        id: "copo-ml",
        label: "1 copo — 200 ml",
        measureName: "Copo",
        preparationCode: "PRONTO",
        preparationName: "Pronto para consumo",
        amountPerMeasure: 200,
        unit: "ml",
      },
      {
        id: "colher-g",
        label: "1 colher — 15 g",
        measureName: "Colher",
        preparationCode: "PRONTO",
        preparationName: "Pronto para consumo",
        amountPerMeasure: 15,
        unit: "g",
      },
    ],
  } as unknown as Parameters<typeof mealPlanMeasureDisplayOptions>[0]);

  assert.deepEqual(
    options.map(({ id, label }) => ({ id, label })),
    [
      { id: "DIRECT_G", label: "Gramas" },
      { id: "DIRECT_ML", label: "Mililitros" },
      { id: "copo-ml", label: "Copo" },
    ],
  );
  assert.equal(
    mealPlanMeasureSelectionId({
      prescribedUnit: "g",
    } as Parameters<typeof mealPlanMeasureSelectionId>[0]),
    "DIRECT_G",
  );
});

test("seleção segura permanece persistida e aplica a equivalência em gramas", async () => {
  const foods = (await foodRepository.search({
    query: "Leite, de vaca, integral",
    source: "TACO",
    pageSize: 20,
  })).items;
  const food = foods.find((item) => item.officialName === "Leite, de vaca, integral");
  assert.ok(food);
  const options = await householdMeasureRepository.findConfirmedOptionsByFoodId(food.id);
  assert.ok(options.length > 0);
  const base = createMealPlanFoodFromMaster(food, crypto.randomUUID());
  assert.ok(base);
  const withOptions = { ...base, ibgeMeasureOptions: options };
  const selected = selectIbgeMeasureForDisplay(withOptions, options[0].id);
  assert.ok(selected);
  assert.equal(selected.selectedIbgeMeasureId, options[0].id);
  assert.equal(selected.quantity, 1);
  assert.equal(selected.prescribedAmount, options[0].amountPerMeasure);
  assert.equal(selected.prescribedUnit, options[0].unit);
  if (options[0].unit === "g") {
    assert.equal(selected.grams, options[0].amountPerMeasure);
    assert.notDeepEqual(selected.nutrients, base.nutrients);
  } else {
    assert.equal(selected.grams, 0);
    assert.deepEqual(selected.nutrients, base.nutrients);
  }

  const draft = {
    strategyEntryId: crypto.randomUUID(),
    status: "DRAFT" as const,
    aiDecision: "IDLE" as const,
    meals: [{
      id: crypto.randomUUID(),
      name: "Café da manhã",
      order: 1,
      items: [selected],
    }],
    supplements: [],
  };
  const canonical = canonicalizeMealPlanDraftFoods(
    draft,
    [food],
    new Map([[food.id, options]]),
  );
  const reopened = canonical
    ? parseMealPlanRecordDraft(JSON.parse(JSON.stringify(canonical)))
    : null;
  const reopenedFood = reopened?.meals[0]?.items[0];
  assert.equal(reopenedFood?.selectedIbgeMeasureId, options[0].id);
  assert.equal(reopenedFood?.prescribedAmount, selected.prescribedAmount);
  assert.equal(reopenedFood?.prescribedUnit, selected.prescribedUnit);
  assert.equal(reopenedFood?.grams, selected.grams);
  assert.deepEqual(reopenedFood?.nutrients, selected.nutrients);
});

test("pão francês mantém gramas e recebe medidas confirmadas do crosswalk", async () => {
  const foods = (await foodRepository.search({
    query: "francês",
    source: "TACO",
    pageSize: 20,
  })).items;
  const bread = foods.find((food) => food.officialName === "Pão, trigo, francês");
  assert.ok(bread);
  const options = await householdMeasureRepository.findConfirmedOptionsByFoodId(bread.id);
  assert.equal(options.length, 9);
  const item = createMealPlanFoodFromMaster(bread, crypto.randomUUID());
  assert.ok(item);
  assert.equal(item.standardWeightGrams, 100);
  assert.equal(item.prescribedAmount, 0);
  assert.equal(item.grams, 0);
  assert.equal(item.quantity, 1);
  const display = mealPlanMeasureDisplayOptions({
    ...item,
    ibgeMeasureOptions: options,
  });
  assert.equal(display[0].label, "Gramas");
  assert.equal(display.length, options.length + 1);
});

test("banco, serviço e API preservam medidas; dropdown mostra somente as compatíveis", async () => {
  const expected = [
    { name: "Arroz, integral, cozido", count: 14 },
    { name: "Pão, trigo, francês", count: 9 },
    { name: "Abacaxi, cru", count: 10 },
    { name: "Leite, de vaca, integral", count: 18 },
    { name: "Ovo, de galinha, inteiro, cru", count: 4 },
    { name: "Café, infusão 10%", count: 19 },
  ] as const;

  for (const target of expected) {
    const foods = (await foodRepository.search({
      query: target.name,
      source: "TACO",
      pageSize: 20,
    })).items;
    const food = foods.find((candidate) => candidate.officialName === target.name);
    assert.ok(food, target.name);
    const databaseRows = await prisma.foodHouseholdMeasureReference.findMany({
      where: { foodId: food.id, matchStatus: "CONFIRMED" },
      select: { id: true },
    });
    const serviceOptions = await householdMeasureRepository.findConfirmedOptionsByFoodId(food.id);
    const response = await getHouseholdMeasures(
      new Request(`http://localhost/api/foods/${food.id}/household-measures`),
      { params: Promise.resolve({ foodId: food.id }) },
    );
    const payload = await response.json() as { options: typeof serviceOptions };
    const base = createMealPlanFoodFromMaster(food, crypto.randomUUID());
    assert.ok(base);
    const dropdown = mealPlanMeasureDisplayOptions({
      ...base,
      ibgeMeasureOptions: payload.options,
    });
    const compatibleOptions = serviceOptions.filter(
      (option) => option.unit === base.nutritionBasisUnit,
    );

    assert.equal(databaseRows.length, target.count, target.name);
    assert.equal(serviceOptions.length, databaseRows.length, target.name);
    assert.deepEqual(
      payload.options.map((option) => option.measureId),
      serviceOptions.map((option) => option.measureId),
      target.name,
    );
    assert.equal(dropdown.length, compatibleOptions.length + 1, target.name);
    assert.deepEqual(
      dropdown.slice(1).map((option) => option.id),
      compatibleOptions.map((option) => option.id),
      target.name,
    );
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.ok(serviceOptions.every((option) =>
      option.source === "IBGE" &&
      option.confidence === "CONFIRMED" &&
      Boolean(option.sourceFoodCode) &&
      Boolean(option.linkMethod) &&
      option.quantityValue === option.amountPerMeasure &&
      option.quantityUnit === option.unit,
    ));
  }
});

test("vínculos ambíguos continuam bloqueados e preparações de ovo não se misturam", async () => {
  const blocked = [
    "Arroz, tipo 1, cozido",
    "Banana, prata, crua",
    "Feijão, carioca, cozido",
    "Café, pó, torrado",
  ] as const;
  for (const name of blocked) {
    const foods = (await foodRepository.search({
      query: name,
      source: "TACO",
      pageSize: 20,
    })).items;
    const food = foods.find((candidate) => candidate.officialName === name);
    assert.ok(food, name);
    assert.deepEqual(
      await householdMeasureRepository.findConfirmedOptionsByFoodId(food.id),
      [],
      name,
    );
  }

  const eggCases = [
    ["Ovo, de galinha, inteiro, cru", "1"],
    ["Ovo, de galinha, inteiro, cozido/10minutos", "2"],
    ["Ovo, de galinha, inteiro, frito", "5"],
  ] as const;
  for (const [name, preparationCode] of eggCases) {
    const foods = (await foodRepository.search({
      query: name,
      source: "TACO",
      pageSize: 20,
    })).items;
    const food = foods.find((candidate) => candidate.officialName === name);
    assert.ok(food, name);
    const options = await householdMeasureRepository.findConfirmedOptionsByFoodId(food.id);
    assert.ok(options.length > 0, name);
    assert.deepEqual(
      [...new Set(options.map((option) => option.preparationCode))],
      [preparationCode],
      name,
    );
  }
});

test("abacaxi manual preserva quantidade 1 ao editar 50 g e 100 g", async () => {
  const foods = (await foodRepository.search({
    query: "Abacaxi, cru",
    source: "TACO",
    pageSize: 20,
  })).items;
  const pineapple = foods.find(
    (food) => food.officialName === "Abacaxi, cru",
  );
  assert.ok(pineapple);
  const base = createMealPlanFoodFromMaster(pineapple, crypto.randomUUID());
  assert.ok(base);

  const fiftyGrams = updateMealPlanFoodPortion(base, {
    field: "grams",
    input: "50",
  });
  assert.equal(fiftyGrams.success, true);
  if (!fiftyGrams.success) return;
  assert.equal(fiftyGrams.food.quantity, 1);
  assert.equal(fiftyGrams.food.prescribedAmount, 50);
  assert.equal(fiftyGrams.food.grams, 50);

  const hundredGrams = updateMealPlanFoodPortion(fiftyGrams.food, {
    field: "grams",
    input: "100",
  });
  assert.equal(hundredGrams.success, true);
  if (!hundredGrams.success) return;
  assert.equal(hundredGrams.food.quantity, 1);
  assert.equal(hundredGrams.food.prescribedAmount, 100);
  assert.equal(
    hundredGrams.food.nutrients.energyKcal,
    hundredGrams.food.nutrientsPer100g.energyKcal,
  );

  const reopened = parseMealPlanRecordDraft(
    JSON.parse(JSON.stringify({
      strategyEntryId: crypto.randomUUID(),
      status: "DRAFT",
      aiDecision: "IDLE",
      meals: [{
        id: crypto.randomUUID(),
        name: "Lanche",
        order: 1,
        items: [hundredGrams.food],
      }],
      supplements: [],
    })),
  );
  assert.equal(reopened?.meals[0].items[0].quantity, 1);
  assert.equal(reopened?.meals[0].items[0].prescribedAmount, 100);
  assert.equal(reopened?.meals[0].items[0].grams, 100);
});

test("café em pó não recebe medidas de café preparado", async () => {
  const foods = (await foodRepository.search({
    query: "torrado",
    source: "TACO",
    pageSize: 20,
  })).items;
  const coffeePowder = foods.find(
    (food) => food.officialName === "Café, pó, torrado",
  );
  assert.ok(coffeePowder);
  const options = await householdMeasureRepository.findConfirmedOptionsByFoodId(
    coffeePowder.id,
  );
  assert.deepEqual(options, []);
  const item = createMealPlanFoodFromMaster(coffeePowder, crypto.randomUUID());
  assert.ok(item);
  assert.deepEqual(mealPlanMeasureDisplayOptions(item), [
    { id: "DIRECT_G", label: "Gramas" },
  ]);
});

test("quantidade multiplica medida segura e peso total pode editar a quantidade", async () => {
  const foods = (await foodRepository.search({
    query: "Leite, de vaca, integral",
    source: "TACO",
    pageSize: 20,
  })).items;
  const food = foods.find((item) => item.officialName === "Leite, de vaca, integral");
  assert.ok(food);
  const options = await householdMeasureRepository.findConfirmedOptionsByFoodId(food.id);
  const gramOption = options.find((option) => option.unit === "g");
  assert.ok(gramOption);
  const base = createMealPlanFoodFromMaster(food, crypto.randomUUID());
  assert.ok(base);
  const selected = selectIbgeMeasureForDisplay(
    { ...base, ibgeMeasureOptions: options },
    gramOption.id,
  );
  assert.ok(selected);
  const doubled = updateMealPlanFoodPortion(selected, {
    field: "quantity",
    input: "2",
  });
  assert.equal(doubled.success, true);
  if (!doubled.success) return;
  assert.equal(doubled.food.quantity, 2);
  assert.equal(doubled.food.prescribedAmount, gramOption.amountPerMeasure * 2);
  assert.equal(doubled.food.grams, gramOption.amountPerMeasure * 2);

  const editedWeight = updateMealPlanFoodPortion(doubled.food, {
    field: "grams",
    input: String(gramOption.amountPerMeasure * 1.5),
  });
  assert.equal(editedWeight.success, true);
  if (!editedWeight.success) return;
  assert.equal(editedWeight.food.quantity, 2);
  assert.equal(
    editedWeight.food.prescribedAmount,
    gramOption.amountPerMeasure * 1.5,
  );
});

test("medida em ml não é selecionável contra base em g sem conversão documentada", async () => {
  const reference = await prisma.foodHouseholdMeasureReference.findFirst({
    where: {
      matchStatus: "CONFIRMED",
      quantityUnit: "ml",
      foodId: { not: null },
      food: { source: { kind: "TACO" }, status: "ACTIVE" },
    },
    select: { foodId: true },
  });
  assert.ok(reference?.foodId);
  const food = await foodRepository.findById(reference.foodId);
  assert.ok(food);
  const options = await householdMeasureRepository.findConfirmedOptionsByFoodId(food.id);
  const volumeOption = options.find((option) => option.unit === "ml");
  assert.ok(volumeOption);
  const base = createMealPlanFoodFromMaster(food, crypto.randomUUID());
  assert.ok(base);
  const selected = selectIbgeMeasureForDisplay(
    { ...base, ibgeMeasureOptions: options },
    volumeOption.id,
  );
  assert.equal(selected, null);
  assert.equal(base.prescribedUnit, "g");
  assert.equal(base.nutrients.energyKcal, 0);
});

test("registro antigo de 100 g permanece manual e editável", async () => {
  const foods = (await foodRepository.search({
    query: "francês",
    source: "TACO",
    pageSize: 20,
  })).items;
  const bread = foods.find((food) => food.officialName === "Pão, trigo, francês");
  assert.ok(bread);
  const base = createMealPlanFoodFromMaster(bread, crypto.randomUUID());
  assert.ok(base);
  const legacy = {
    ...base,
    grams: 100,
    quantity: 100,
    prescribedAmount: undefined,
    prescribedUnit: undefined,
    nutrients: calculateFoodNutrientsForGrams(base.nutrientsPer100g, 100),
  };
  const record = attachConfirmedIbgeMeasures(
    {
      meals: [{
        id: crypto.randomUUID(),
        name: "Lanche",
        order: 1,
        items: [legacy],
      }],
    },
    new Map(),
  );
  const reopened = record.meals[0].items[0];
  assert.equal(reopened.selectedIbgeMeasureId, undefined);
  assert.equal(reopened.prescribedAmount, 100);
  assert.equal(reopened.prescribedUnit, "g");
  assert.equal(reopened.quantity, 1);
  const edited = updateMealPlanFoodPortion(reopened, {
    field: "grams",
    input: "75",
  });
  assert.equal(edited.success, true);
  if (!edited.success) return;
  assert.equal(edited.food.prescribedAmount, 75);
  assert.equal(edited.food.grams, 75);
  assert.equal(edited.food.quantity, 1);
});

test("linha mantém medida e quantidade com unidade explícita antes dos nutrientes", async () => {
  const source = await readFile(
    "src/components/meal-plan/meal-plan-foundation-workspace.tsx",
    "utf8",
  );
  const expectedHeader =
    "<span>Alimento</span><span>Medida</span><span>Nº medidas</span><span>Quantidade</span><span>kcal</span><span>P</span><span>C</span><span>L</span><span>Ações</span>";
  assert.ok(source.includes(expectedHeader));
  assert.equal(source.includes("disabled={!food.selectedIbgeMeasureId}"), false);
  assert.equal(source.includes("readOnly={Boolean(food.selectedIbgeMeasureId)}"), false);
  assert.ok(source.includes("Quantidade total prescrita em"));
  assert.ok(source.includes("pendingDirectUnit"));
  assert.ok(source.includes("não foi convertido automaticamente"));
  assert.ok(source.includes('field: "directAmount"'));
});

test("medidas Evonut confirmadas chegam iguais do banco ate o dropdown", async () => {
  const targets = [
    { name: "Arroz, integral, cozido", count: 17, unit: "g" },
    { name: "Pão, trigo, francês", count: 3, unit: "g" },
    { name: "Banana, prata, crua", count: 2, unit: "g" },
    { name: "Leite, de vaca, integral", count: 7, unit: "ml" },
    { name: "Ovo, de galinha, inteiro, cru", count: 1, unit: "g" },
    { name: "Abacaxi, cru", count: 6, unit: "g" },
    { name: "Café, infusão 10%", count: 5, unit: "ml" },
    { name: "Frango, peito, sem pele, cozido", count: 6, unit: "g" },
  ] as const;

  for (const target of targets) {
    const food = await prisma.food.findFirstOrThrow({
      where: {
        officialName: target.name,
        importedFrom: "EVONUT",
        source: { kind: "EVONUT", name: "TACO" },
      },
      select: { id: true },
    });
    const databaseRows = await prisma.foodHouseholdMeasureReference.findMany({
      where: {
        foodId: food.id,
        matchStatus: "CONFIRMED",
        importedFrom: "EVONUT",
        source: { kind: "EVONUT" },
      },
      select: { id: true, quantityUnit: true, linkMethod: true },
    });
    const serviceOptions = await householdMeasureRepository.findConfirmedOptionsByFoodId(food.id);
    const response = await getHouseholdMeasures(
      new Request(`http://localhost/api/foods/${food.id}/household-measures`),
      { params: Promise.resolve({ foodId: food.id }) },
    );
    const payload = await response.json() as { options: typeof serviceOptions };
    const dropdown = mealPlanMeasureDisplayOptions({
      prescribedUnit: target.unit,
      nutritionBasisUnit: target.unit,
      standardWeightGrams: 100,
      ibgeMeasureOptions: payload.options,
    } as unknown as Parameters<typeof mealPlanMeasureDisplayOptions>[0]);

    assert.equal(databaseRows.length, target.count, target.name);
    assert.equal(serviceOptions.length, databaseRows.length, target.name);
    assert.deepEqual(
      payload.options.map((option) => option.measureId).sort(),
      databaseRows.map((row) => row.id).sort(),
      target.name,
    );
    assert.equal(dropdown.length, databaseRows.length + 1, target.name);
    assert.equal(dropdown[0].label, target.unit === "ml" ? "Mililitros" : "Gramas");
    assert.ok(serviceOptions.every((option) =>
      option.source === "EVONUT" &&
      option.confidence === "CONFIRMED" &&
      option.unit === target.unit &&
      option.linkMethod === "EVONUT_SOURCE_AND_CODE",
    ), target.name);
  }
});

test("medida Evonut de outro alimento ou preparacao nao aparece", async () => {
  const foods = await prisma.food.findMany({
    where: {
      officialName: {
        in: [
          "Arroz, integral, cozido",
          "Pão, trigo, francês",
          "Café, infusão 10%",
          "Café, pó, torrado",
        ],
      },
      importedFrom: "EVONUT",
      source: { kind: "EVONUT", name: "TACO" },
    },
    select: { id: true, officialName: true },
  });
  const byName = new Map(foods.map((food) => [food.officialName, food.id]));
  const options = async (name: string) =>
    householdMeasureRepository.findConfirmedOptionsByFoodId(byName.get(name)!);
  const rice = await options("Arroz, integral, cozido");
  const bread = await options("Pão, trigo, francês");
  const coffeeDrink = await options("Café, infusão 10%");
  const coffeePowder = await options("Café, pó, torrado");

  assert.ok(rice.length > 0 && bread.length > 0);
  assert.ok(rice.every((option) => !bread.some((candidate) => candidate.id === option.id)));
  assert.ok(coffeeDrink.length > 0);
  assert.ok(coffeeDrink.every((option) => option.unit === "ml"));
  assert.ok(coffeePowder.every((option) => option.unit === "g"));
  assert.ok(coffeeDrink.every((option) =>
    !coffeePowder.some((candidate) => candidate.id === option.id),
  ));
});

test("alimento Evonut sem medida confirmada mantem somente o fallback", async () => {
  const food = await prisma.food.findFirstOrThrow({
    where: {
      officialName: "Abacaxi congelado - DeMarchi®",
      importedFrom: "EVONUT",
      source: { kind: "EVONUT" },
    },
    select: { id: true },
  });
  const catalogFood = await foodRepository.findById(food.id);
  assert.ok(catalogFood);
  const base = createMealPlanFoodFromMaster(catalogFood, crypto.randomUUID(), {
    allowAnyActiveMasterFood: true,
  });
  assert.ok(base);
  const options = await householdMeasureRepository.findConfirmedOptionsByFoodId(food.id);

  assert.deepEqual(options, []);
  assert.deepEqual(
    mealPlanMeasureDisplayOptions({ ...base, ibgeMeasureOptions: options }),
    [{ id: "DIRECT_G", label: "Gramas" }],
  );
});

test("consulta medidas somente por foodId e evita repeticao na interface", async () => {
  const [repository, component, schema] = await Promise.all([
    readFile("src/features/food-database/household-measure-repository.ts", "utf8"),
    readFile("src/components/meal-plan/meal-plan-foundation-workspace.tsx", "utf8"),
    readFile("prisma/schema/food-database.prisma", "utf8"),
  ]);

  assert.ok(repository.includes("foodId: { in: ids }"));
  assert.ok(schema.includes("@@index([foodId, preparationCode])"));
  assert.ok(component.includes("measureOptionsCache.current.get(foodId)"));
  assert.ok(component.includes("food.ibgeMeasureOptions === undefined"));
});

test("select dos sete alimentos mostra somente nomes e preserva equivalencias internas", async () => {
  const targets = [
    "Abacaxi, cru",
    "Pão, trigo, francês",
    "Arroz, integral, cozido",
    "Leite, de vaca, integral",
    "Banana, prata, crua",
    "Frango, peito, sem pele, cozido",
    "Ovo, de galinha, inteiro, cru",
  ] as const;

  for (const name of targets) {
    const food = await prisma.food.findFirstOrThrow({
      where: {
        officialName: name,
        importedFrom: "EVONUT",
        source: { kind: "EVONUT", name: "TACO" },
      },
      select: { id: true },
    });
    const options = await householdMeasureRepository.findConfirmedOptionsByFoodId(food.id);
    assert.ok(options.length > 0, name);
    const manualUnit = options.every((option) => option.unit === "ml") ? "ml" : "g";
    const dropdown = mealPlanMeasureDisplayOptions({
      prescribedUnit: manualUnit,
      nutritionBasisUnit: manualUnit,
      standardWeightGrams: 100,
      ibgeMeasureOptions: options,
    } as unknown as Parameters<typeof mealPlanMeasureDisplayOptions>[0]);

    assert.deepEqual(
      dropdown.map((option) => option.label),
      [
        manualUnit === "ml" ? "Mililitros" : "Gramas",
        ...options.map((option) => option.measureName),
      ],
      name,
    );
    assert.ok(dropdown.slice(1).every((option) =>
      !option.label.includes("—") &&
      !/\d+\s*(g|ml)$/i.test(option.label),
    ), name);
    assert.deepEqual(
      dropdown.slice(1).map((option) =>
        "amountPerMeasure" in option ? option.amountPerMeasure : null,
      ),
      options.map((option) => option.amountPerMeasure),
      name,
    );
  }
});

test("duas fatias de abacaxi calculam 150 g e todos os nutrientes", async () => {
  const foodRow = await prisma.food.findFirstOrThrow({
    where: {
      officialName: "Abacaxi, cru",
      importedFrom: "EVONUT",
      source: { kind: "EVONUT", name: "TACO" },
    },
    select: { id: true },
  });
  const food = await foodRepository.findById(foodRow.id);
  assert.ok(food);
  const options = await householdMeasureRepository.findConfirmedOptionsByFoodId(food.id);
  const slice = options.find((option) => option.measureName === "Fatia");
  assert.ok(slice);
  const base = createMealPlanFoodFromMaster(food, crypto.randomUUID(), {
    allowAnyActiveMasterFood: true,
  });
  assert.ok(base);
  const selected = selectIbgeMeasureForDisplay(
    { ...base, ibgeMeasureOptions: options },
    slice.id,
  );
  assert.ok(selected);
  const doubled = updateMealPlanFoodPortion(selected, {
    field: "quantity",
    input: "2",
  });
  assert.equal(doubled.success, true);
  if (!doubled.success) return;

  assert.equal(doubled.food.quantity, 2);
  assert.equal(doubled.food.prescribedAmount, 150);
  assert.equal(doubled.food.grams, 150);
  assert.deepEqual(
    doubled.food.nutrients,
    calculateFoodNutrientsForGrams(doubled.food.nutrientsPer100g, 150),
  );
  assert.deepEqual(
    calculateMealPlanTotals([{
      id: crypto.randomUUID(),
      name: "Lanche",
      order: 1,
      items: [doubled.food],
    }]),
    {
      energyKcal: doubled.food.nutrients.energyKcal,
      proteinGrams: doubled.food.nutrients.proteinGrams,
      carbohydratesGrams: doubled.food.nutrients.carbohydratesGrams,
      fatsGrams: doubled.food.nutrients.fatsGrams,
      fiberGrams: doubled.food.nutrients.fiberGrams,
    },
  );
});
