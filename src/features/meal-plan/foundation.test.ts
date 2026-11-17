import assert from "node:assert/strict";
import test from "node:test";

import { assembleMealPlanView } from "./foundation-view";
import { generateAssistedMealPlanPreview } from "./assisted-generation";
import { EMPTY_FOOD_NUTRIENTS, calculateMealPlanTotals } from "./nutrition-calculations";
import { parseMealPlanRecordDraft } from "./record";
import type { MealPlanStrategyInheritance } from "@/features/nutrition-strategy";
import type { ProfessionalFood } from "@/features/food-database";

const strategy: MealPlanStrategyInheritance = {
  sourceStrategyId: "a3eec247-7fcb-4bde-bad4-f4f180641fcc",
  patientId: "d914f474-013d-4a92-b764-25006f7c24e8",
  masterRecordId: "7d83fe02-8229-43af-8b67-4df1fde8c2a9",
  attendanceId: "52935d43-5756-440f-b9ac-e87c77ef9c72",
  objective: "WEIGHT_LOSS",
  secondaryObjectives: [],
  method: "STANDARD",
  protocol: "MIFFLIN_ST_JEOR",
  totalEnergyExpenditureKcal: 2_250,
  caloriesKcal: 1_800,
  proteinGrams: 150,
  proteinPercentage: 33.3,
  carbohydratesGrams: 195,
  carbohydratesPercentage: 43.3,
  fatsGrams: 60,
  fatsPercentage: 30,
  fiberGrams: 30,
  waterMl: 2800,
  mealCount: 2,
  mealDistribution: [
    {
      mealNumber: 1,
      name: "Desjejum",
      time: "07:00",
      vetPercentage: 50,
      plannedCaloriesKcal: 900,
    },
    {
      mealNumber: 2,
      name: "Jantar",
      time: "19:00",
      vetPercentage: 50,
      plannedCaloriesKcal: 900,
    },
  ],
  supplementation: [],
  clinicalObservations: "",
  calorieAdjustmentPercentage: -20,
  status: "APPROVED",
  approvedAt: "2026-07-26T10:10:00.000Z",
  approvedByUserId: "1b3620c9-c43d-4f26-a39c-a98e9131b8ae",
};

test("aceita somente a estrutura vazia de refeições desta Sprint", () => {
  const draft = parseMealPlanRecordDraft({
    strategyEntryId: strategy.sourceStrategyId,
    status: "DRAFT",
    meals: [
      {
        id: "1b6f3ccb-03d1-4ad2-b7b3-fbff89f77576",
        name: "Refeição 1",
        order: 1,
        items: [],
      },
    ],
  });

  assert.equal(draft?.meals.length, 1);
  assert.equal(
    parseMealPlanRecordDraft({
      strategyEntryId: strategy.sourceStrategyId,
      status: "DRAFT",
      meals: [
        {
          id: "1b6f3ccb-03d1-4ad2-b7b3-fbff89f77576",
          name: "Refeição 1",
          order: 1,
          items: [{ foodId: "não permitido nesta Sprint" }],
        },
      ],
    }),
    null,
  );
});

test("aceita plano manual sem inventar uma Estratégia quando a etapa foi ignorada", () => {
  const draft = parseMealPlanRecordDraft({
    status: "DRAFT",
    meals: [
      {
        id: "1b6f3ccb-03d1-4ad2-b7b3-fbff89f77576",
        name: "Refeição 1",
        order: 1,
        items: [],
      },
    ],
  });

  assert.ok(draft);
  assert.equal(draft.strategyEntryId, undefined);

  const plan = assembleMealPlanView({
    scenario: "complete",
    record: {
      id: "68929c68-6c66-4da8-92ed-8eb477140885",
      patientId: strategy.patientId,
      patientName: "Paciente",
      masterRecordId: strategy.masterRecordId,
      attendanceId: strategy.attendanceId,
      status: "DRAFT",
      responsibleUserId: strategy.approvedByUserId,
      responsibleProfessional: "Saulo Xavier Vitorino",
      createdAt: "2026-07-26T10:15:00.000Z",
      updatedAt: "2026-07-26T10:15:00.000Z",
      revision: 1,
      supplements: [],
      history: [],
      meals: draft.meals,
    },
  });

  assert.equal(plan.strategy, undefined);
  assert.equal(plan.adequacy, undefined);
  assert.equal(plan.summary.plannedCalories, "Não definido");
  assert.match(plan.summary.strategy, /não realizada/i);
});

test("preserva a origem e a decisão ao criar versão a partir do plano anterior", () => {
  const draft = parseMealPlanRecordDraft({
    strategyEntryId: strategy.sourceStrategyId,
    status: "DRAFT",
    aiDecision: "IDLE",
    sourcePlanEntryId: "10000000-0000-4000-8000-000000000001",
    sourcePlanAttendanceId: "20000000-0000-4000-8000-000000000001",
    sourcePlanRevision: 4,
    reuseMode: "ADJUSTED_COPY",
    meals: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        name: "Café da manhã",
        order: 1,
        items: [],
      },
    ],
    supplements: [],
  });

  assert.equal(draft?.sourcePlanRevision, 4);
  assert.equal(draft?.reuseMode, "ADJUSTED_COPY");
  assert.notEqual(draft?.sourcePlanEntryId, draft?.strategyEntryId);
});

test("monta o resumo apenas com valores herdados da estratégia", () => {
  const plan = assembleMealPlanView({
    scenario: "complete",
    strategy,
    record: {
      id: "68929c68-6c66-4da8-92ed-8eb477140885",
      patientId: strategy.patientId,
      patientName: "Paciente",
      masterRecordId: strategy.masterRecordId,
      attendanceId: strategy.attendanceId,
      strategyEntryId: strategy.sourceStrategyId,
      status: "DRAFT",
      responsibleUserId: strategy.approvedByUserId,
      responsibleProfessional: "Saulo Xavier Vitorino",
      createdAt: "2026-07-26T10:15:00.000Z",
      updatedAt: "2026-07-26T10:15:00.000Z",
    revision: 1,
    supplements: [],
    history: [],
    meals: [
        {
          id: "1b6f3ccb-03d1-4ad2-b7b3-fbff89f77576",
          name: "Refeição 1",
          order: 1,
          items: [],
        },
        {
          id: "7c3b4991-635a-4527-952c-b98eaf6937dd",
          name: "Refeição 2",
          order: 2,
          items: [],
        },
      ],
    },
  });

  assert.equal(plan.strategyEntryId, strategy.sourceStrategyId);
  assert.equal(plan.summary.primaryObjective, "Emagrecimento");
  assert.equal(plan.summary.plannedCalories, "1.800 kcal");
  assert.equal(plan.summary.protein, "150 g · 33,3%");
  assert.equal(plan.summary.mealCount, 2);
  assert.equal(plan.meals.length, 2);
  assert.deepEqual(plan.meals.map((meal) => meal.foods), [[], []]);
});

test("ignora cópia legada e mantém a Estratégia como fonte única", () => {
  const legacySnapshot: MealPlanStrategyInheritance = {
    ...strategy,
    objective: "HYPERTROPHY",
    caloriesKcal: 3_000,
    proteinGrams: 90,
    proteinPercentage: 12,
    carbohydratesGrams: 500,
    carbohydratesPercentage: 66.7,
    fatsGrams: 71,
    fatsPercentage: 21.3,
    approvedAt: "2026-07-20T10:10:00.000Z",
  };
  const plan = assembleMealPlanView({
    scenario: "complete",
    strategy,
    record: {
      id: "68929c68-6c66-4da8-92ed-8eb477140885",
      patientId: strategy.patientId,
      patientName: "Paciente",
      masterRecordId: strategy.masterRecordId,
      attendanceId: strategy.attendanceId,
      strategyEntryId: strategy.sourceStrategyId,
      status: "DRAFT",
      responsibleUserId: strategy.approvedByUserId,
      responsibleProfessional: "Saulo Xavier Vitorino",
      createdAt: "2026-07-26T10:15:00.000Z",
      updatedAt: "2026-07-26T10:15:00.000Z",
      revision: 1,
      strategyApprovedAt: legacySnapshot.approvedAt,
      strategySnapshot: legacySnapshot,
      supplements: [],
      history: [],
      meals: [
        {
          id: "1b6f3ccb-03d1-4ad2-b7b3-fbff89f77576",
          name: "Refeição 1",
          order: 1,
          items: [],
        },
      ],
    },
  });

  assert.equal(plan.strategy, strategy);
  assert.equal(plan.strategyUpdateAvailable, false);
  assert.equal(plan.summary.primaryObjective, "Emagrecimento");
  assert.equal(plan.summary.plannedCalories, "1.800 kcal");
  assert.equal(plan.summary.protein, "150 g · 33,3%");
  assert.equal(plan.summary.carbohydrates, "195 g · 43,3%");
  assert.equal(plan.summary.fats, "60 g · 30%");
});

function food(
  id: string,
  name: string,
  nutrients: {
    energyKcal: number;
    proteinGrams: number;
    carbohydratesGrams: number;
    fatsGrams: number;
  },
): ProfessionalFood {
  return {
    id,
    officialName: name,
    normalizedName: name.toLowerCase(),
    category: "Base real",
    categoryId: "d9eefb89-4237-4f65-a55f-69b83f20aa00",
    foodGroup: "Alimentos",
    source: {
      id: "90233234-9c82-4b7c-bd60-eb3756b30a66",
      kind: "TACO",
      name: "TACO",
      origin: "OFFICIAL",
      editable: false,
    },
    referenceServingGrams: 100,
    status: "ACTIVE",
    nutrients: {
      ...EMPTY_FOOD_NUTRIENTS,
      ...nutrients,
      fiberGrams: 2,
    },
    householdMeasures: [
      {
        id: `${id.slice(0, -1)}a`,
        name: "porção",
        normalizedName: "porcao",
        quantity: 1,
        grams: 100,
        source: "TACO",
        isDefault: true,
        active: true,
      },
    ],
    synonyms: [],
    createdAt: "2026-07-31T10:00:00.000Z",
    updatedAt: "2026-07-31T10:00:00.000Z",
  };
}

const previewMeals = strategy.mealDistribution.map((meal, index) => ({
  id:
    index === 0
      ? "1b6f3ccb-03d1-4ad2-b7b3-fbff89f77576"
      : "7c3b4991-635a-4527-952c-b98eaf6937dd",
  name: meal.name,
  time: meal.time,
  order: index + 1,
  vetPercentage: meal.vetPercentage,
  plannedEnergyKcal: meal.plannedCaloriesKcal,
  items: [],
}));

const catalogFoods = [
  food("11111111-1111-4111-8111-111111111111", "Frango", {
    energyKcal: 165,
    proteinGrams: 31,
    carbohydratesGrams: 0,
    fatsGrams: 3.6,
  }),
  food("22222222-2222-4222-8222-222222222222", "Arroz", {
    energyKcal: 128,
    proteinGrams: 2.5,
    carbohydratesGrams: 28,
    fatsGrams: 0.2,
  }),
  food("33333333-3333-4333-8333-333333333333", "Azeite", {
    energyKcal: 884,
    proteinGrams: 0,
    carbohydratesGrams: 0,
    fatsGrams: 100,
  }),
  food("44444444-4444-4444-8444-444444444444", "Café, pó, torrado", {
    energyKcal: 100,
    proteinGrams: 100,
    carbohydratesGrams: 0,
    fatsGrams: 0,
  }),
];

test("gera prévia em memória com refeições, horários e alimentos reais", () => {
  let sequence = 0;
  const result = generateAssistedMealPlanPreview({
    strategy,
    meals: previewMeals,
    foods: catalogFoods,
    allergies: [],
    restrictions: [],
    foodPreferences: ["Prefere arroz"],
    createId: () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++sequence).padStart(12, "0")}`,
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(
    result.meals.map((meal) => [meal.name, meal.time]),
    [["Desjejum", "07:00"], ["Jantar", "19:00"]],
  );
  assert.ok(result.meals.every((meal) => meal.items.length > 0));
  assert.ok(
    result.meals.flatMap((meal) => meal.items).every(
      (item) =>
        item.catalogFoodId &&
        item.source === "TACO" &&
        item.grams > 0 &&
        item.quantity === 1 &&
        item.prescribedAmount === item.grams &&
        item.prescribedUnit === "g" &&
        item.householdMeasure === "porção",
    ),
  );
  assert.equal(
    result.meals
      .flatMap((meal) => meal.items)
      .some((item) => item.description === "Café, pó, torrado"),
    false,
  );
  assert.ok(
    Math.abs(calculateMealPlanTotals(result.meals).energyKcal - strategy.caloriesKcal) < 3,
  );
});

test("informa exatamente catálogo vazio, horário ausente e incompatibilidade clínica", () => {
  const base = {
    strategy,
    meals: previewMeals,
    allergies: [] as readonly string[],
    restrictions: [] as readonly string[],
    foodPreferences: [] as readonly string[],
    createId: () => "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
  };
  const emptyCatalog = generateAssistedMealPlanPreview({ ...base, foods: [] });
  const missingTime = generateAssistedMealPlanPreview({
    ...base,
    foods: catalogFoods,
    meals: previewMeals.map((meal, index) =>
      index === 0 ? { ...meal, time: undefined } : meal,
    ),
  });
  const incompatible = generateAssistedMealPlanPreview({
    ...base,
    foods: [food("44444444-4444-4444-8444-444444444444", "Leite", {
      energyKcal: 60,
      proteinGrams: 3,
      carbohydratesGrams: 5,
      fatsGrams: 3,
    })],
    allergies: ["Alergia a leite"],
  });

  assert.deepEqual(emptyCatalog, {
    success: false,
    message:
      "Nenhum alimento ativo está cadastrado nas bases reais. Importe TACO, IBGE, Philips ou outra base homologada antes de gerar a prévia.",
  });
  assert.deepEqual(missingTime, {
    success: false,
    message: "Horário não informado para: Desjejum.",
  });
  assert.deepEqual(incompatible, {
    success: false,
    message:
      "Nenhum alimento real compatível com as alergias, restrições e recusas registradas foi encontrado.",
  });
});
