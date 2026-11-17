import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";

import { householdMeasureRepository } from "../food-database/household-measure-repository";
import { foodRepository } from "../food-database/repository";
import { prisma } from "../../lib/database/prisma";
import { calculateReturnRecall, calculateReturnRecallFood } from "./recall-calculation";
import {
  createLocalRecallFoodFromCatalog,
  createRecallFromPreviousPlan,
  createUnselectedRecallFood,
  officialNameAlreadyDefinesPreparation,
  recallMeasureOptions,
  selectRecallMeasure,
} from "./recall-food-selection";

test("reutiliza o plano anterior sem misturar prescrição e consumo relatado", () => {
  let sequence = 0;
  const recall = createRecallFromPreviousPlan(
    {
      entryId: "10000000-0000-4000-8000-000000000001",
      meals: [],
      prescriptionMeals: [
        {
          id: "20000000-0000-4000-8000-000000000001",
          name: "Café da manhã",
          time: "07:00",
          foods: [
            {
              id: "30000000-0000-4000-8000-000000000001",
              catalogFoodId: "40000000-0000-4000-8000-000000000001",
              name: "Pão, trigo, francês",
              catalogSource: "TACO",
              catalogSourceKind: "TACO",
              quantity: 1,
              householdMeasure: "unidade",
              prescribedAmount: 50,
              prescribedUnit: "g",
              measureAmountPerUnit: 50,
              preparation: "Pronto para consumo",
              nutrientsPer100g: {
                energyKcal: 300,
                proteinGrams: 8,
                carbohydratesGrams: 58,
                fatsGrams: 3,
                fiberGrams: 2,
                sodiumMg: 600,
              },
            },
          ],
        },
      ],
    },
    () => `50000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
  );

  const food = recall.meals[0]?.foods[0];
  assert.equal(food?.name, "Pão, trigo, francês");
  assert.equal(food?.previousPlanComparison?.prescribedAmount, 50);
  assert.equal(food?.previousPlanComparison?.status, "");
  assert.equal(
    food?.source === "LOCAL_DATABASE" ? food.officialPreparation : undefined,
    "Pronto para consumo",
  );
  assert.equal(
    calculateReturnRecall(recall).totals,
    undefined,
    "a cópia ainda não confirma que o alimento foi consumido",
  );

  const consumedAsPrescribed = {
    ...recall,
    meals: recall.meals.map((meal) => ({
      ...meal,
      foods: meal.foods.map((item) => ({
        ...item,
        previousPlanComparison: item.previousPlanComparison
          ? { ...item.previousPlanComparison, status: "AS_PRESCRIBED" as const }
          : undefined,
      })),
    })),
  };
  assert.ok(calculateReturnRecall(consumedAsPrescribed).totals);

  const notConsumed = {
    ...recall,
    meals: recall.meals.map((meal) => ({
      ...meal,
      foods: meal.foods.map((item) => ({
        ...item,
        previousPlanComparison: item.previousPlanComparison
          ? { ...item.previousPlanComparison, status: "NOT_CONSUMED" as const }
          : undefined,
      })),
    })),
  };
  assert.equal(calculateReturnRecall(notConsumed).totals, undefined);
});

after(async () => {
  await prisma.$disconnect();
});

async function realTacoFood(name: string, query: string) {
  const result = await foodRepository.search({
    query,
    sourceName: "TACO",
    pageSize: 20,
  });
  const food = result.items.find((candidate) => candidate.officialName === name);
  assert.ok(food, `${name} deve existir na base alimentar ativa`);
  return food;
}

test("busca real por pão francês encontra o cadastro oficial sem exigir o nome da fonte", async () => {
  const result = await foodRepository.search({
    query: "pão francês",
    source: "ALL",
    pageSize: 20,
  });
  const bread = result.items.find(
    (food) => food.officialName === "Pão, trigo, francês",
  );
  assert.ok(bread);
  assert.equal(bread.source.name, "TACO");
  assert.ok(bread.sourceCode);
  assert.ok(bread.nutrients?.energyKcal);

  const sources = await foodRepository.listActiveSourceOptions();
  assert.ok(sources.some((source) => source.label === "TACO"));
  assert.ok(sources.some((source) => source.label === "TBCA"));
  assert.ok(sources.every((source) => source.activeFoods > 0));
});

test("seleção mantém ID, nome e fonte e 1 unidade usa os 50 g cadastrados", async () => {
  const bread = await realTacoFood("Pão, trigo, francês", "pão francês");
  const confirmed =
    await householdMeasureRepository.findConfirmedOptionsByFoodId(bread.id);
  const unit = confirmed.find(
    (option) => option.measureName.toLocaleLowerCase("pt-BR") === "unidade",
  );
  assert.ok(unit);
  assert.equal(unit.amountPerMeasure, 50);
  assert.equal(unit.unit, "g");

  const pending = createUnselectedRecallFood(crypto.randomUUID());
  const selected = createLocalRecallFoodFromCatalog(bread, pending);
  assert.equal(selected.catalogFoodId, bread.id);
  assert.equal(selected.name, bread.officialName);
  assert.equal(selected.catalogSource, bread.source.name);

  const options = recallMeasureOptions(selected, confirmed);
  const selectedUnit = options.find((option) => option.id === unit.id);
  assert.ok(selectedUnit);
  const portion = {
    ...selectRecallMeasure(selected, selectedUnit),
    quantity: 1,
  };
  const calculated = calculateReturnRecallFood(portion);
  assert.ok(calculated);
  assert.equal(calculated.consumedAmount, 50);
  assert.equal(calculated.consumedUnit, "g");
  assert.equal(
    calculated.nutrients.energyKcal,
    (bread.nutrients?.energyKcal ?? 0) * 0.5,
  );
});

test("linha sem seleção e manual sem composição nunca geram nutrientes", () => {
  const unselected = createUnselectedRecallFood(crypto.randomUUID());
  const manual = {
    id: crypto.randomUUID(),
    source: "MANUAL" as const,
    name: "Registro clínico sem composição",
    quantity: 1,
    unit: "porção",
    preparation: "",
    brand: "",
    observations: "",
    consumedWeight: 100,
    consumedWeightUnit: "g" as const,
    nutritionBasis: "NONE" as const,
    compositionStatus: "MANUAL" as const,
  };
  const calculation = calculateReturnRecall({
    dayType: "HABITUAL",
    referenceDate: "",
    meals: [
      {
        id: "meal",
        time: "",
        name: "",
        observations: "",
        foods: [unselected, manual],
      },
    ],
    water: "",
    beverages: "",
    alcohol: "",
    supplements: "",
  });
  assert.equal(calculation.totals, undefined);
  assert.equal(calculation.unselectedFoods, 1);
  assert.deepEqual(calculation.foodsWithoutComposition, [manual.name]);
});

test("composição manual só calcula os valores realmente informados", () => {
  const manual = {
    id: crypto.randomUUID(),
    source: "MANUAL" as const,
    name: "Registro manual calculável",
    quantity: 1,
    unit: "porção",
    preparation: "",
    brand: "",
    observations: "",
    consumedWeight: 50,
    consumedWeightUnit: "g" as const,
    nutritionBasis: "PER_100" as const,
    compositionStatus: "MANUAL_WITH_COMPOSITION" as const,
    nutrients: {
      energyKcal: 200,
      carbohydratesGrams: 20,
      proteinGrams: 10,
      fatsGrams: 8,
      fiberGrams: null,
      sodiumMg: 100,
    },
  };
  const calculated = calculateReturnRecallFood(manual);
  assert.ok(calculated);
  assert.deepEqual(calculated.nutrients, {
    energyKcal: 100,
    carbohydratesGrams: 10,
    proteinGrams: 5,
    fatsGrams: 4,
    fiberGrams: null,
    sodiumMg: 50,
  });
});

test("alimento cujo nome oficial já informa cozido não pede preparo duplicado", async () => {
  const rice = await realTacoFood(
    "Arroz, integral, cozido",
    "arroz integral cozido",
  );
  assert.equal(officialNameAlreadyDefinesPreparation(rice.officialName), true);
  const selected = createLocalRecallFoodFromCatalog(
    rice,
    createUnselectedRecallFood(crypto.randomUUID()),
  );
  assert.match(selected.officialPreparation ?? "", /cozido/i);
});

test("interface usa somente a base local, remove Marca e mantém registro manual explícito", async () => {
  const component = await readFile(
    new URL(
      "../../components/clinical-anamnesis/return-anamnesis.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(component, /Buscar alimento na base alimentar/);
  assert.match(component, /\/api\/foods\?/);
  assert.match(component, /\/household-measures/);
  assert.match(component, /Dado informado manualmente/);
  assert.doesNotMatch(component, /label="Marca"/);
  assert.doesNotMatch(component, /https?:\/\//);
  assert.doesNotMatch(component, /\bIA\b.*(?:fetch|required)/i);
});
