import assert from "node:assert/strict";
import test from "node:test";

import type { ProfessionalFood } from "@/features/food-database";

import {
  canonicalizeMealPlanDraftFoods,
  createMealPlanFoodFromMaster,
  diagnoseMealPlanDraftFoodCanonicalization,
  selectIbgeMeasureForDisplay,
} from "./food-snapshot";
import {
  calculateMealPlanTotals,
  EMPTY_FOOD_NUTRIENTS,
  updateMealPlanFoodPortion,
} from "./nutrition-calculations";
import {
  parseMealPlanRecordDraft,
  type MealPlanRecordDraft,
} from "./record";

const food: ProfessionalFood = {
  id: "4ff48dc8-9532-44d5-a599-c327be55434a",
  officialName: "Arroz integral cozido",
  normalizedName: "arroz integral cozido",
  description: "Arroz integral preparado sem óleo.",
  category: "Cereais e tubérculos",
  categoryId: "dc2e261d-9604-452c-a45f-bf53bc9b2d7d",
  foodGroup: "Cereais",
  source: {
    id: "d4b1e37b-e51d-4cd3-8864-e0c70d34728d",
    kind: "TBCA",
    name: "TBCA",
    version: "7.2",
    origin: "OFFICIAL",
    editable: false,
  },
  sourceCode: "BRC0001",
  referenceServingGrams: 100,
  status: "ACTIVE",
  nutrients: {
    ...EMPTY_FOOD_NUTRIENTS,
    energyKcal: 124,
    proteinGrams: 2.6,
    carbohydratesGrams: 25.8,
    fatsGrams: 1,
    fiberGrams: 2.7,
    sodiumMg: 1,
    ironMg: 0.3,
  },
  householdMeasures: [
    {
      id: "dd107457-5cb5-4f88-9ebf-25bd54a7051a",
      name: "colher de servir",
      normalizedName: "colher de servir",
      quantity: 1,
      grams: 45,
      source: "TBCA",
      isDefault: true,
      active: true,
    },
  ],
  synonyms: ["arroz marrom"],
  createdAt: "2026-07-27T10:00:00.000Z",
  updatedAt: "2026-07-27T10:00:00.000Z",
};

const draft: MealPlanRecordDraft = {
  strategyEntryId: "8bd60bc7-5f36-4b2b-9782-813884fc9f19",
  status: "DRAFT",
      aiDecision: "IDLE",
      supplements: [],
      meals: [
    {
      id: "0dde6733-90c2-4dc7-acac-a79f5155030f",
      name: "Almoço",
      order: 1,
      items: [
        {
          id: "3e8ab848-c09c-4d33-b2f7-6fccda22bcdc",
          catalogFoodId: food.id,
          description: "Nome adulterado",
          foodGroup: "Grupo adulterado",
          source: "CLINIC_SV",
          sourceName: "Fonte adulterada",
          primaryHouseholdMeasure: "porção",
          standardWeightGrams: 999,
          grams: 90,
          householdMeasure: "colher de servir",
          measureOptions: [],
          quantity: 2,
          nutrientsPer100g: EMPTY_FOOD_NUTRIENTS,
          nutrients: EMPTY_FOOD_NUTRIENTS,
          substitutions: [],
        },
      ],
    },
  ],
};

test("reconstrói o snapshot a partir do catálogo e mantém a prescrição", () => {
  const result = canonicalizeMealPlanDraftFoods(draft, [food]);
  const item = result?.meals[0]?.items[0];

  assert.equal(item?.description, food.officialName);
  assert.equal(item?.source, "TBCA");
  assert.equal(item?.sourceVersion, "7.2");
  assert.equal(item?.quantity, 2);
  assert.equal(item?.grams, 90);
  assert.equal(item?.nutrients.energyKcal, 111.6);
  assert.equal(item?.nutrients.sodiumMg, 0.9);
});

test("canonicalização preserva ml e recalcula pela base em ml", () => {
  const milk: ProfessionalFood = {
    ...food,
    id: "7d958d3f-76a0-4bfd-942b-7e576635a961",
    officialName: "Leite integral",
    normalizedName: "leite integral",
    source: {
      ...food.source,
      kind: "EVONUT",
      name: "Evonut",
      origin: "OFFICIAL",
    },
    sourceCode: "MILK-ML",
    referenceServingUnit: "ml",
    householdMeasures: [],
    nutrients: {
      ...food.nutrients!,
      energyKcal: 64.56,
      proteinGrams: 3.2,
    },
  };
  const initial = createMealPlanFoodFromMaster(milk, crypto.randomUUID(), {
    allowAnyActiveMasterFood: true,
  });
  assert.ok(initial);
  const prescribed = updateMealPlanFoodPortion(initial, {
    field: "directAmount",
    input: "250",
    unit: "ml",
  });
  assert.equal(prescribed.success, true);
  if (!prescribed.success) return;

  const canonical = canonicalizeMealPlanDraftFoods(
    {
      strategyEntryId: "8bd60bc7-5f36-4b2b-9782-813884fc9f19",
      status: "DRAFT",
      aiDecision: "IDLE",
      meals: [
        {
          id: "0dde6733-90c2-4dc7-acac-a79f5155030f",
          name: "Café da manhã",
          order: 1,
          items: [prescribed.food],
        },
      ],
      supplements: [],
    },
    [milk],
  );
  const reopened = canonical
    ? parseMealPlanRecordDraft(JSON.parse(JSON.stringify(canonical)))
    : null;
  const reopenedMilk = reopened?.meals[0]?.items[0];
  assert.ok(reopenedMilk && "prescribedUnit" in reopenedMilk);
  assert.equal(reopenedMilk.prescribedAmount, 250);
  assert.equal(reopenedMilk.prescribedUnit, "ml");
  assert.equal(reopenedMilk.nutritionBasisUnit, "ml");
  assert.equal(reopenedMilk.nutrients.energyKcal, 161.4);
  assert.equal(reopenedMilk.nutrients.proteinGrams, 8);
});

test("rejeita alimento ausente no catálogo definitivo", () => {
  assert.equal(canonicalizeMealPlanDraftFoods(draft, []), null);
});

test("rejeita medida caseira incompatível com o alimento", () => {
  const incompatible: MealPlanRecordDraft = {
    ...draft,
    meals: draft.meals.map((meal) => ({
      ...meal,
      items: meal.items.map((item) => ({
        ...item,
        householdMeasure: "medida inexistente",
      })),
    })),
  };

  assert.equal(canonicalizeMealPlanDraftFoods(incompatible, [food]), null);
  assert.deepEqual(
    diagnoseMealPlanDraftFoodCanonicalization(incompatible, [food]),
    [
      {
        code: "HOUSEHOLD_MEASURE_NOT_FOUND",
        mealId: draft.meals[0].id,
        foodId: draft.meals[0].items[0].id,
        catalogFoodId: food.id,
        householdMeasure: "medida inexistente",
        allowedHouseholdMeasures: ["colher de servir"],
      },
    ],
  );
});

test("normaliza medida legada inalterada, mas não aceita o mesmo rótulo em item novo", () => {
  const legacy: MealPlanRecordDraft = {
    ...draft,
    meals: draft.meals.map((meal) => ({
      ...meal,
      items: meal.items.map((item) => ({
        ...item,
        householdMeasure: "porção",
      })),
    })),
  };

  assert.equal(canonicalizeMealPlanDraftFoods(legacy, [food]), null);
  const normalized = canonicalizeMealPlanDraftFoods(
    legacy,
    [food],
    new Map(),
    legacy.meals,
  );
  assert.equal(
    normalized?.meals[0].items[0].householdMeasure,
    "colher de servir",
  );
});

test("recupera medida derivada de prévia V2 local sem flexibilizar plano manual", () => {
  const recovered: MealPlanRecordDraft = {
    ...draft,
    aiDecision: "SUGGESTION_GENERATED",
    smartGenerationVersion: 2,
    meals: draft.meals.map((meal) => ({
      ...meal,
      vetPercentage: 30,
      plannedEnergyKcal: 550.8,
      items: meal.items.map((item) => ({
        ...item,
        primaryHouseholdMeasure: "2 colher de servir",
        householdMeasure: "2 colher de servir",
      })),
    })),
  };

  const canonical = canonicalizeMealPlanDraftFoods(recovered, [food]);
  assert.ok(canonical);
  assert.equal(
    canonical.meals[0].items[0].householdMeasure,
    "colher de servir",
  );
  assert.equal(canonical.meals[0].vetPercentage, 30);
  assert.equal(canonical.meals[0].plannedEnergyKcal, 550.8);
  assert.equal(
    canonicalizeMealPlanDraftFoods(
      { ...recovered, aiDecision: "IDLE", smartGenerationVersion: undefined },
      [food],
    ),
    null,
  );
});

test("mantém 100 g como referência analítica sem prescrever 100 g automaticamente", () => {
  const tacoFood: ProfessionalFood = {
    ...food,
    source: {
      ...food.source,
      kind: "TACO",
      name: "TACO",
      version: "4ª edição",
    },
    sourceCode: "1",
    referenceServingUnit: "g",
    householdMeasures: [],
  };
  const item = createMealPlanFoodFromMaster(
    tacoFood,
    "3e8ab848-c09c-4d33-b2f7-6fccda22bcdc",
  );

  assert.ok(item);
  assert.equal(item.source, "TACO");
  assert.equal(item.standardWeightGrams, 100);
  assert.equal(item.grams, 0);
  assert.equal(item.prescribedAmount, 0);
  assert.equal(item.prescribedUnit, "g");
  assert.equal(item.quantity, 1);
  assert.equal(item.householdMeasure, "100 g");
  assert.equal(item.nutrients.energyKcal, 0);
  assert.equal(item.nutrients.proteinGrams, 0);
  assert.equal(item.nutrients.carbohydratesGrams, 0);
  assert.equal(item.nutrients.fatsGrams, 0);

  const meal = {
    id: "0dde6733-90c2-4dc7-acac-a79f5155030f",
    name: "Almoço",
    order: 1,
    items: [item],
  };
  assert.deepEqual(calculateMealPlanTotals([meal]), {
    energyKcal: 0,
    proteinGrams: 0,
    carbohydratesGrams: 0,
    fatsGrams: 0,
    fiberGrams: 0,
  });

  const editedItem = {
    ...item,
    quantity: 0.5,
    grams: 50,
    prescribedAmount: 50,
    prescribedUnit: "g" as const,
    nutrients: {
      ...item.nutrients,
      energyKcal: 62,
      proteinGrams: 1.3,
      carbohydratesGrams: 12.9,
      fatsGrams: 0.5,
      fiberGrams: 1.35,
    },
  };
  const canonical = canonicalizeMealPlanDraftFoods(
    {
      strategyEntryId: "8bd60bc7-5f36-4b2b-9782-813884fc9f19",
      status: "DRAFT",
      aiDecision: "IDLE",
      meals: [{ ...meal, items: [editedItem] }],
      supplements: [],
    },
    [tacoFood],
  );
  const reopened = canonical
    ? parseMealPlanRecordDraft(JSON.parse(JSON.stringify(canonical)))
    : null;

  assert.equal(reopened?.meals[0].items[0].quantity, 0.5);
  assert.equal(reopened?.meals[0].items[0].grams, 50);
  assert.equal(reopened?.meals[0].items[0].nutrients.energyKcal, 62);
});

test("não insere fonte externa ao Banco Mestre TACO no seletor", () => {
  assert.equal(
    createMealPlanFoodFromMaster(
      { ...food, referenceServingUnit: "g" },
      "3e8ab848-c09c-4d33-b2f7-6fccda22bcdc",
    ),
    null,
  );
});

test("selecionar medida em ml recalcula alimento Evonut com referência por volume", () => {
  const evonut = {
    ...food,
    source: {
      ...food.source,
      kind: "EVONUT" as const,
      name: "Evonut",
    },
    referenceServingUnit: "ml",
  };
  const base = createMealPlanFoodFromMaster(
    evonut,
    "3e8ab848-c09c-4d33-b2f7-6fccda22bcdc",
    { allowAnyActiveMasterFood: true },
  );
  assert.ok(base);
  const option = {
    id: "51ebf1a0-859d-4b3f-8a20-8c59a29f82fa",
    label: "Copo",
    measureName: "Copo",
    preparationCode: "PRONTO",
    preparationName: "Pronto para consumo",
    amountPerMeasure: 200,
    unit: "ml" as const,
  };
  const selected = selectIbgeMeasureForDisplay(
    { ...base, ibgeMeasureOptions: [option] },
    option.id,
  );
  assert.ok(selected);
  assert.equal(selected.prescribedAmount, 200);
  assert.equal(selected.grams, 200);
  assert.equal(selected.nutrients.energyKcal, 248);
  assert.equal(selected.nutrients.ironMg, 0.6);
});

test("reabre rascunho persistido quando a medida IBGE não possui preparação", () => {
  const base = createMealPlanFoodFromMaster(
    { ...food, referenceServingUnit: "g" },
    "3e8ab848-c09c-4d33-b2f7-6fccda22bcdc",
    { allowAnyActiveMasterFood: true },
  );
  assert.ok(base);

  const reopened = parseMealPlanRecordDraft({
    strategyEntryId: "8bd60bc7-5f36-4b2b-9782-813884fc9f19",
    status: "DRAFT",
    aiDecision: "SUGGESTION_GENERATED",
    supplements: [],
    meals: [
      {
        id: "0dde6733-90c2-4dc7-acac-a79f5155030f",
        name: "Almoço",
        order: 1,
        time: "12:00",
        items: [
          {
            ...base,
            ibgeMeasureOptions: [
              {
                id: "51ebf1a0-859d-4b3f-8a20-8c59a29f82fa",
                label: "Colher de servir",
                measureName: "Colher de servir",
                preparationCode: "",
                preparationName: "",
                amountPerMeasure: 45,
                unit: "g",
              },
            ],
          },
        ],
      },
    ],
  });

  assert.ok(reopened);
  assert.equal(
    reopened.meals[0].items[0].ibgeMeasureOptions?.[0].preparationCode,
    "",
  );
});
