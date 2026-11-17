import assert from "node:assert/strict";
import test from "node:test";

import type { ProfessionalFood } from "@/features/food-database";

import {
  calculateFoodNutrientsForGrams,
  calculateMealPlanTotals,
  EMPTY_FOOD_NUTRIENTS,
  normalizeFoodNutrients,
} from "./nutrition-calculations";
import { detectPrescriptionChanges } from "./prescription-history";
import { parseMealPlanRecordDraft, type MealPlanRecordFood } from "./record";
import {
  chooseReplacementMeasure,
  foodSubstitutionService,
  inferNutritionalFunction,
  rankNutritionalEquivalents,
  replaceMealPlanFood,
} from "./substitution-engine";

function food(
  id: string,
  name: string,
  nutrients: {
    energyKcal: number;
    carbohydratesGrams: number;
    proteinGrams: number;
    fatsGrams: number;
    fiberGrams: number;
  },
  measureGrams = 100,
): ProfessionalFood {
  return {
    id,
    officialName: name,
    normalizedName: name.toLocaleLowerCase("pt-BR"),
    category: "Cereais e tubérculos",
    categoryId: "e96ab2b6-fac9-4874-9907-cc4e2cc110be",
    foodGroup: "Fontes de carboidratos",
    source: {
      id: "62c1673b-af48-439a-82bb-6ad8b99ddf7d",
      kind: "TBCA",
      name: "TBCA",
      origin: "OFFICIAL",
      editable: false,
    },
    referenceServingGrams: 100,
    status: "ACTIVE",
    nutrients: { ...EMPTY_FOOD_NUTRIENTS, ...nutrients },
    householdMeasures: [
      {
        id: `${id}-measure`,
        name: "porção registrada",
        normalizedName: "porcao registrada",
        quantity: 1,
        grams: measureGrams,
        source: "TBCA",
        isDefault: true,
        active: true,
      },
    ],
    synonyms: [],
    createdAt: "2026-07-27T10:00:00.000Z",
    updatedAt: "2026-07-27T10:00:00.000Z",
  };
}

const rice = food(
  "f4d8b866-b7fe-4f8c-934c-e500d6f34052",
  "Arroz branco cozido",
  {
    energyKcal: 130,
    carbohydratesGrams: 28,
    proteinGrams: 2.7,
    fatsGrams: 0.3,
    fiberGrams: 0.4,
  },
);
const sweetPotato = food(
  "5e2b87c2-af63-42b0-bc97-153ee4e98dbd",
  "Batata-doce cozida",
  {
    energyKcal: 86,
    carbohydratesGrams: 20.1,
    proteinGrams: 1.6,
    fatsGrams: 0.1,
    fiberGrams: 3,
  },
  150,
);
const chicken = {
  ...food(
    "01530693-608a-45ef-b382-1d22a1ac311f",
    "Frango grelhado",
    {
      energyKcal: 165,
      carbohydratesGrams: 0,
      proteinGrams: 31,
      fatsGrams: 3.6,
      fiberGrams: 0,
    },
  ),
  category: "Carnes",
  categoryId: "93e3a0f2-d0aa-49e4-b759-e9d38495d50c",
  foodGroup: "Proteínas animais",
};

const cassava = food(
  "ba0b911b-5d9d-41bb-a9f2-a518d4c0594b",
  "Mandioca cozida",
  {
    energyKcal: 125,
    carbohydratesGrams: 30.1,
    proteinGrams: 0.6,
    fatsGrams: 0.3,
    fiberGrams: 1.6,
  },
  100,
);

function storedFood(
  source: ProfessionalFood,
  id: string,
): MealPlanRecordFood {
  const measure = source.householdMeasures[0];
  const nutrientsPer100g = normalizeFoodNutrients(source.nutrients!);
  return {
    id,
    catalogFoodId: source.id,
    description: source.officialName,
    foodGroup: source.foodGroup,
    source: source.source.kind,
    sourceName: source.source.name,
    primaryHouseholdMeasure: measure.name,
    standardWeightGrams: source.referenceServingGrams,
    grams: measure.grams,
    householdMeasure: measure.name,
    measureOptions: [
      { name: measure.name, gramsPerUnit: measure.grams / measure.quantity },
    ],
    quantity: measure.quantity,
    nutrientsPer100g,
    nutrients: calculateFoodNutrientsForGrams(
      nutrientsPer100g,
      measure.grams,
    ),
    substitutions: [],
  };
}

test("ajusta a quantidade da medida registrada para a melhor equivalência", () => {
  const [equivalent] = rankNutritionalEquivalents({
    currentFood: rice,
    currentGrams: 100,
    candidates: [sweetPotato],
  });

  assert.equal(equivalent?.suggestedGrams, 151.2);
  assert.equal(equivalent?.suggestedQuantity, 1.01);
  assert.equal(equivalent?.suggestedHouseholdMeasure, "porção registrada");
  assert.ok(Math.abs((equivalent?.nutrition.energyKcal ?? 0) - 130) < 0.1);
  assert.equal(equivalent?.adjustmentBasis, "REGISTERED_MEASURE");
});

test("recalcula a equivalência quando a quantidade prescrita original muda", () => {
  const [full] = rankNutritionalEquivalents({
    currentFood: rice,
    currentGrams: 100,
    candidates: [sweetPotato],
  });
  const [half] = rankNutritionalEquivalents({
    currentFood: rice,
    currentGrams: 50,
    candidates: [sweetPotato],
  });

  assert.ok(full && half);
  assert.ok(half.suggestedGrams < full.suggestedGrams);
  assert.ok(
    (half.nutrition.energyKcal ?? 0) < (full.nutrition.energyKcal ?? 0),
  );
});

test("restringe candidatos ao mesmo grupo ou categoria alimentar", () => {
  const equivalents = rankNutritionalEquivalents({
    currentFood: rice,
    currentGrams: 100,
    candidates: [chicken, sweetPotato],
  });

  assert.deepEqual(
    equivalents.map((item) => item.food.id),
    [sweetPotato.id],
  );
});

test("não aceita candidato sem energia comparável", () => {
  const incomplete = {
    ...sweetPotato,
    id: "c6f4484a-95be-4abf-a9e6-9e5b57d76671",
    nutrients: {
      ...sweetPotato.nutrients!,
      energyKcal: null,
    },
  };

  assert.deepEqual(
    rankNutritionalEquivalents({
      currentFood: rice,
      currentGrams: 100,
      candidates: [incomplete],
    }),
    [],
  );
});

test("remove alergias e restrições e prioriza preferência registrada", () => {
  const restricted = rankNutritionalEquivalents({
    currentFood: rice,
    currentGrams: 100,
    candidates: [sweetPotato, cassava],
    context: {
      foodPreferences: ["Prefere batata-doce"],
      clinicalRestrictions: ["Mandioca"],
      intolerances: [],
      allergies: [],
      religiousRestrictions: [],
    },
  });

  assert.deepEqual(
    restricted.map((item) => item.food.id),
    [sweetPotato.id],
  );
  assert.ok((restricted[0]?.score.total ?? 0) > 0);

  const allergyFiltered = rankNutritionalEquivalents({
    currentFood: rice,
    currentGrams: 100,
    candidates: [sweetPotato, cassava],
    context: {
      foodPreferences: [],
      clinicalRestrictions: [],
      intolerances: [],
      allergies: ["Batata-doce"],
      religiousRestrictions: [],
    },
  });
  assert.deepEqual(
    allergyFiltered.map((item) => item.food.id),
    [cassava.id],
  );
});

test("score considera objetivo e registra recusa no motivo interno", () => {
  const [equivalent] = rankNutritionalEquivalents({
    currentFood: rice,
    currentGrams: 100,
    candidates: [sweetPotato],
    context: {
      foodPreferences: ["Paciente recusou arroz branco"],
      clinicalRestrictions: [],
      intolerances: [],
      allergies: [],
      religiousRestrictions: [],
    },
    planContext: {
      objective: "WEIGHT_LOSS",
      target: {
        energyKcal: 1_800,
        proteinGrams: 120,
        carbohydratesGrams: 190,
        fatsGrams: 60,
        fiberGrams: 30,
      },
      currentTotals: {
        energyKcal: 1_400,
        proteinGrams: 90,
        carbohydratesGrams: 160,
        fatsGrams: 45,
        fiberGrams: 18,
      },
    },
  });
  assert.ok((equivalent?.score.objective ?? 0) > 0);
  assert.match(equivalent?.suggestionReason ?? "", /Paciente recusou/);
  assert.match(equivalent?.suggestionReason ?? "", /emagrecimento/);
});

test("aceita ausência clínica de carboidrato e fibra em proteínas animais", () => {
  const grilledChicken = {
    ...chicken,
    officialName: "Frango grelhado",
    normalizedName: "frango grelhado",
    nutrients: { ...chicken.nutrients!, carbohydratesGrams: null, fiberGrams: null },
  };
  const grilledBeef = {
    ...chicken,
    id: "ba9a539a-8571-4686-a69d-141822320e9a",
    officialName: "Patinho grelhado",
    normalizedName: "patinho grelhado",
    nutrients: {
      ...chicken.nutrients!,
      energyKcal: 199,
      proteinGrams: 36.1,
      carbohydratesGrams: null,
      fatsGrams: 5,
      fiberGrams: null,
    },
  };
  const [replacement] = rankNutritionalEquivalents({
    currentFood: grilledChicken,
    currentGrams: 100,
    candidates: [grilledBeef],
  });
  assert.equal(replacement?.food.officialName, "Patinho grelhado");
  assert.ok((replacement?.score.total ?? 0) > 0);
});

test("bloqueia preparação incompatível e reconhece funções nutricionais", () => {
  const rawBeef = {
    ...chicken,
    id: "86ea7844-1405-4a66-b22b-925c8f7ef50d",
    officialName: "Patinho cru",
    normalizedName: "patinho cru",
  };
  assert.deepEqual(
    rankNutritionalEquivalents({
      currentFood: { ...chicken, officialName: "Frango grelhado", normalizedName: "frango grelhado" },
      currentGrams: 100,
      candidates: [rawBeef],
    }),
    [],
  );
  assert.equal(inferNutritionalFunction(rice), "STARCH");
  assert.equal(inferNutritionalFunction(chicken), "ANIMAL_PROTEIN");
});

test("preserva a medida pelo nome e usa a melhor disponível como fallback", () => {
  const options = [
    { id: "fatia", label: "Fatia", measureName: "Fatia", preparationCode: "1", preparationName: "Cru", amountPerMeasure: 75, unit: "g" as const },
    { id: "unidade", label: "Unidade", measureName: "Unidade", preparationCode: "1", preparationName: "Cru", amountPerMeasure: 130, unit: "g" as const },
  ];
  assert.equal(chooseReplacementMeasure(options, "unidade", "fatia")?.id, "unidade");
  assert.equal(chooseReplacementMeasure(options, "xícara", "fatia")?.id, "fatia");
  assert.equal(chooseReplacementMeasure(options, "xícara", "copo")?.id, "fatia");
});

test("serviço converte a quantidade equivalente para a medida documentada e recalcula nutrientes", () => {
  const current = storedFood(rice, "f6bff13e-191d-46dd-b68a-57b49297450f");
  const [equivalent] = foodSubstitutionService.rank({
    currentFood: rice,
    currentGrams: current.grams,
    candidates: [sweetPotato],
  });
  assert.ok(equivalent);
  const replacement = foodSubstitutionService.createReplacement({
    current,
    candidate: sweetPotato,
    equivalent,
    replacementId: "1c8c58fc-728a-44f1-a04e-cb99a759e76d",
    measureOptions: [{
      id: "51ebf1a0-859d-4b3f-8a20-8c59a29f82fa",
      label: "Porção registrada",
      measureName: "porção registrada",
      preparationCode: "COZIDO",
      preparationName: "Cozido",
      amountPerMeasure: 150,
      unit: "g",
    }],
  });
  assert.ok(replacement);
  assert.equal(replacement.selectedIbgeMeasureId, "51ebf1a0-859d-4b3f-8a20-8c59a29f82fa");
  assert.ok(
    Math.abs(
      replacement.quantity - equivalent.suggestedGrams / 150,
    ) < 1e-9,
  );
  assert.equal(replacement.grams, equivalent.suggestedGrams);
  assert.ok(
    replacement.nutrients.energyKcal !== null &&
      replacement.nutrientsPer100g.energyKcal !== null &&
      Math.abs(
        replacement.nutrients.energyKcal -
          replacement.nutrientsPer100g.energyKcal *
            (equivalent.suggestedGrams / 100),
      ) < 0.01,
  );
  if (replacement.nutrientsPer100g.potassiumMg === null) {
    assert.equal(replacement.nutrients.potassiumMg, null);
  } else {
    assert.ok(
      replacement.nutrients.potassiumMg !== null &&
        Math.abs(
          replacement.nutrients.potassiumMg -
            replacement.nutrientsPer100g.potassiumMg *
              (equivalent.suggestedGrams / 100),
        ) < 0.01,
    );
  }
  assert.ok(equivalent.suggestionReason.length > 0);
});

test("substituição não usa medida com unidade incompatível nem presume densidade", () => {
  const current = storedFood(rice, "f6bff13e-191d-46dd-b68a-57b49297450f");
  const liquid = {
    ...sweetPotato,
    id: "3c0f9e57-d964-4d4e-8f1b-267884dcdf31",
    referenceServingUnit: "ml" as const,
  };
  const [equivalent] = rankNutritionalEquivalents({
    currentFood: rice,
    currentGrams: current.grams,
    candidates: [liquid],
  });
  assert.ok(equivalent);
  const replacement = foodSubstitutionService.createReplacement({
    current,
    candidate: liquid,
    equivalent,
    replacementId: "bb28b47a-50f7-453e-b02d-b8c1557fb0e2",
    measureOptions: [{
      id: "51ebf1a0-859d-4b3f-8a20-8c59a29f82fa",
      label: "Medida apenas em gramas",
      measureName: "porção",
      preparationCode: "COZIDO",
      preparationName: "Cozido",
      amountPerMeasure: 150,
      unit: "g",
    }],
  });

  assert.ok(replacement);
  assert.equal(replacement.selectedIbgeMeasureId, undefined);
  assert.equal(replacement.prescribedUnit, "ml");
  assert.equal(replacement.prescribedAmount, equivalent.suggestedGrams);
});

test("registro reabre substituição de fonte Evonut com auditoria interna", () => {
  const evonutFood: MealPlanRecordFood = {
    ...storedFood(sweetPotato, "1c8c58fc-728a-44f1-a04e-cb99a759e76d"),
    source: "EVONUT",
    substitutions: [{
      id: "51ebf1a0-859d-4b3f-8a20-8c59a29f82fa",
      replacedFoodId: rice.id,
      replacedDescription: rice.officialName,
      replacementFoodId: sweetPotato.id,
      replacementDescription: sweetPotato.officialName,
      occurredAt: "2026-08-04T15:30:00.000Z",
      responsibleUser: "Saulo Xavier Vitorino",
      suggestionReason: "Mesmo grupo alimentar.",
    }],
  };
  const parsed = parseMealPlanRecordDraft({
    strategyEntryId: "35eab5d6-4dbd-4017-b9c7-bc4aa4bb1d9a",
    status: "DRAFT",
    aiDecision: "IDLE",
    meals: [{
      id: "4bd3b5ec-e3ca-42b3-a43a-8442f06f1284",
      name: "Almoço",
      order: 1,
      items: [evonutFood],
    }],
    supplements: [],
  });
  assert.equal(parsed?.meals[0].items[0].source, "EVONUT");
  assert.equal(
    parsed?.meals[0].items[0].substitutions[0].responsibleUser,
    "Saulo Xavier Vitorino",
  );
  assert.equal(
    parsed?.meals[0].items[0].substitutions[0].suggestionReason,
    "Mesmo grupo alimentar.",
  );
});

test("substitui somente o alimento escolhido e preserva refeição e demais itens", () => {
  const riceRecord = storedFood(
    rice,
    "f6bff13e-191d-46dd-b68a-57b49297450f",
  );
  const chickenRecord = storedFood(
    chicken,
    "a8ef77fd-985f-48cf-9d8b-1c53efae146e",
  );
  const replacement = storedFood(
    sweetPotato,
    "1c8c58fc-728a-44f1-a04e-cb99a759e76d",
  );
  const meals = [
    {
      id: "4bd3b5ec-e3ca-42b3-a43a-8442f06f1284",
      name: "Almoço",
      order: 1,
      time: "12:30",
      items: [riceRecord, chickenRecord],
    },
  ];
  const beforeTotals = calculateMealPlanTotals(meals);
  const next = replaceMealPlanFood({
    meals,
    mealId: meals[0].id,
    foodId: riceRecord.id,
    replacement,
    substitutionId: "51ebf1a0-859d-4b3f-8a20-8c59a29f82fa",
    occurredAt: "2026-07-31T15:00:00.000Z",
    responsibleUser: "Saulo Xavier Vitorino",
    suggestionReason: "Mesmo grupo alimentar.",
  });
  const afterTotals = calculateMealPlanTotals(next);

  assert.equal(meals[0].items[0], riceRecord);
  assert.equal(next[0].name, meals[0].name);
  assert.equal(next[0].time, meals[0].time);
  assert.equal(next[0].items[1], chickenRecord);
  assert.equal(next[0].items[0].id, riceRecord.id);
  assert.equal(next[0].items[0].catalogFoodId, sweetPotato.id);
  assert.equal(next[0].items[0].substitutions.length, 1);
  assert.equal(
    next[0].items[0].substitutions[0].responsibleUser,
    "Saulo Xavier Vitorino",
  );
  assert.equal(
    next[0].items[0].substitutions[0].suggestionReason,
    "Mesmo grupo alimentar.",
  );
  assert.notDeepEqual(afterTotals, beforeTotals);

  const changes = detectPrescriptionChanges(
    { meals, supplements: [] },
    { meals: next, supplements: [] },
  );
  assert.ok(changes.some((change) => change.type === "FOOD_SUBSTITUTED"));

  const reopened = parseMealPlanRecordDraft(
    JSON.parse(
      JSON.stringify({
        strategyEntryId: "35eab5d6-4dbd-4017-b9c7-bc4aa4bb1d9a",
        status: "DRAFT",
        aiDecision: "APPROVED",
        meals: next,
        supplements: [],
      }),
    ),
  );
  assert.equal(reopened?.meals[0].items.length, 2);
  assert.equal(reopened?.meals[0].items[0].catalogFoodId, sweetPotato.id);
  assert.equal(reopened?.aiDecision, "APPROVED");
});

test("cancelar não altera nenhum item do plano", () => {
  const meals = [
    {
      id: "4bd3b5ec-e3ca-42b3-a43a-8442f06f1284",
      name: "Almoço",
      order: 1,
      time: "12:30",
      items: [
        storedFood(rice, "f6bff13e-191d-46dd-b68a-57b49297450f"),
      ],
    },
  ];

  assert.equal(meals.length, 1);
  assert.equal(meals[0].items.length, 1);
  assert.equal(meals[0].items[0].catalogFoodId, rice.id);
});

test("a substituição preserva os estados da prévia assistida", () => {
  for (const aiDecision of [
    "SUGGESTION_GENERATED",
    "APPROVED",
    "REJECTED",
  ] as const) {
    const parsed = parseMealPlanRecordDraft({
      strategyEntryId: "35eab5d6-4dbd-4017-b9c7-bc4aa4bb1d9a",
      status: "DRAFT",
      aiDecision,
      meals: [
        {
          id: "4bd3b5ec-e3ca-42b3-a43a-8442f06f1284",
          name: "Almoço",
          order: 1,
          time: "12:30",
          items: [
            storedFood(
              sweetPotato,
              "f6bff13e-191d-46dd-b68a-57b49297450f",
            ),
          ],
        },
      ],
      supplements: [],
    });
    assert.equal(parsed?.aiDecision, aiDecision);
  }
});
