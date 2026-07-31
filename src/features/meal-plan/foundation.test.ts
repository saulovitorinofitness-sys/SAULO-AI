import assert from "node:assert/strict";
import test from "node:test";

import { assembleMealPlanView } from "./foundation-view";
import { parseMealPlanRecordDraft } from "./record";
import type { MealPlanStrategyInheritance } from "@/features/nutrition-strategy";

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
