import "dotenv/config";

import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { foodRepository } from "@/features/food-database/repository";
import { canonicalizeMealPlanDraftFoods } from "@/features/meal-plan/food-snapshot";
import { calculateMealPlanTotals } from "@/features/meal-plan/nutrition-calculations";
import {
  parseMealPlanRecordDraft,
  parseStoredMealPlanPayload,
} from "@/features/meal-plan/record";
import type { MealPlanStrategyInheritance } from "@/features/nutrition-strategy/inheritance";
import { prisma } from "@/lib/database/prisma";

import {
  assemblePatientContext,
  type PatientContext,
  type PatientContextSourceSnapshot,
} from "./patient-context-service";
import { smartPlanDraftToMealPlanMeals } from "./smart-plan-draft-meal-plan-adapter";
import type { SmartPlanDraft } from "./smart-plan-draft-generator";

let patientContext: PatientContext;

const strategy: MealPlanStrategyInheritance = {
  sourceStrategyId: "strategy-adapter",
  patientId: "patient-adapter",
  masterRecordId: "master-adapter",
  attendanceId: "attendance-adapter",
  objective: "HEALTH",
  secondaryObjectives: [],
  method: "STANDARD",
  protocol: "MIFFLIN_ST_JEOR",
  totalEnergyExpenditureKcal: 2_000,
  caloriesKcal: 2_000,
  proteinGrams: 100,
  proteinPercentage: 20,
  carbohydratesGrams: 250,
  carbohydratesPercentage: 50,
  fatsGrams: 66.7,
  fatsPercentage: 30,
  fiberGrams: 25,
  waterMl: 2_500,
  mealCount: 1,
  mealDistribution: [
    {
      mealNumber: 1,
      name: "Almoço",
      time: "",
      vetPercentage: 100,
      plannedCaloriesKcal: 2_000,
    },
  ],
  supplementation: [],
  clinicalObservations: "",
  calorieAdjustmentPercentage: 0,
  status: "APPROVED",
  approvedAt: "2026-08-03T12:00:00.000Z",
  approvedByUserId: "professional-adapter",
};

before(async () => {
  const result = await foodRepository.search({
    query: "arroz",
    source: "TACO",
    status: "ACTIVE",
    page: 1,
    pageSize: 20,
  });
  const rice = result.items.find((food) => food.officialName === "Arroz, integral, cozido");
  assert.ok(rice);
  const source: PatientContextSourceSnapshot = {
    patientId: strategy.patientId,
    masterRecordId: strategy.masterRecordId,
    attendanceId: strategy.attendanceId,
    sex: "FEMALE",
    ageYears: 35,
    weightKg: 65,
    heightCm: 165,
    bmi: 23.9,
    objective: "Saúde",
    secondaryObjectives: [],
    pathologies: [],
    allergyStatus: "DENIED",
    allergies: [],
    restrictions: [],
    preferredFoods: [],
    dailyRoutine: [],
    exercise: {},
    clinicalObservations: [],
    strategy,
  };
  const assembled = assemblePatientContext(source, [rice], {
    allowMissingMealSchedules: true,
  });
  assert.equal(assembled.success, true);
  if (!assembled.success) throw new Error("patientContext de teste inválido.");
  patientContext = assembled.patientContext;
});

after(async () => {
  await prisma.$disconnect();
});

function draft(foodId = patientContext.foodCatalog.foods[0].id): SmartPlanDraft {
  return {
    semanticVersion: 2,
    patientId: patientContext.patient.patientId,
    attendanceId: patientContext.patient.attendanceId,
    nutritionStrategyId: patientContext.nutritionStrategy.sourceStrategyId,
    generationStatus: "PREVIEW_NOT_APPROVED",
    approvalLabel: "Prévia não aprovada.",
    generatedAt: "2026-08-03T12:00:00.000Z",
    requiresProfessionalAdjustment: false,
    warnings: [],
    optionalDataNotProvided: [],
    inputSummary: {
      objective: patientContext.patient.objective,
      routine: "Não informado.",
      preferences: "Não informado.",
      schedules: "Não informado.",
      habitualIntakeBasis: "NOT_INFORMED",
    },
    meals: [
      {
        id: "temporary-smart-meal",
        name: "Almoço",
        time: "Não informado.",
        targetPercentage: 30,
        targetEnergyKcal: 600,
        items: [
          {
            foodId,
            name: "Nome transportado somente para conferência",
            source: "TACO",
            group: "Grupo transportado somente para conferência",
            prescribedAmount: 85,
            unit: "g",
            householdMeasure: "1 unidade média",
            energyKcal: 0,
            proteinGrams: 0,
            carbohydratesGrams: 0,
            fatsGrams: 0,
            selectionReason: "Sem restrições aplicáveis.",
          },
        ],
        totals: {
          energyKcal: 0,
          proteinGrams: 0,
          carbohydratesGrams: 0,
          fatsGrams: 0,
        },
        internalJustification: "Hip\u00f3tese cl\u00ednica para revis\u00e3o profissional.",
      },
    ],
    dailyTotals: {
      energyKcal: 0,
      proteinGrams: 0,
      carbohydratesGrams: 0,
      fatsGrams: 0,
    },
    targetComparison: {
      energyKcal: { target: 2_000, current: 2_000, difference: 0, adequacyPercentage: 100, status: "WITHIN_TARGET", withinTolerance: true, tolerancePercentage: 5 },
      proteinGrams: { target: 100, current: 100, difference: 0, adequacyPercentage: 100, status: "WITHIN_TARGET", withinTolerance: true, tolerancePercentage: 10 },
      carbohydratesGrams: { target: 250, current: 250, difference: 0, adequacyPercentage: 100, status: "WITHIN_TARGET", withinTolerance: true, tolerancePercentage: 10 },
      fatsGrams: { target: 66.7, current: 66.7, difference: 0, adequacyPercentage: 100, status: "WITHIN_TARGET", withinTolerance: true, tolerancePercentage: 10 },
    },
    sourceFoods: [],
  };
}

test("adapta smartPlanDraft para a estrutura de refeições já exibida", () => {
  let sequence = 0;
  const meals = smartPlanDraftToMealPlanMeals(
    draft(),
    patientContext,
    () => `temporary-adapter-${++sequence}`,
  );
  assert.ok(meals);
  assert.equal(meals.length, 1);
  assert.equal(meals[0].time, undefined);
  assert.equal(meals[0].items[0].catalogFoodId, patientContext.foodCatalog.foods[0].id);
  assert.equal(meals[0].items[0].description, "Arroz, integral, cozido");
  assert.equal(meals[0].items[0].prescribedAmount, 85);
  const catalogFood = patientContext.foodCatalog.foods[0];
  const allowedMeasures = catalogFood.householdMeasures.some(
    (measure) => measure.active,
  )
    ? catalogFood.householdMeasures
        .filter((measure) => measure.active)
        .map((measure) => measure.name)
    : [`${catalogFood.referenceServingGrams} ${catalogFood.referenceServingUnit ?? "g"}`];
  assert.ok(allowedMeasures.includes(meals[0].items[0].householdMeasure));
  assert.notEqual(meals[0].items[0].householdMeasure, "1 unidade média");
  assert.equal(meals[0].vetPercentage, 30);
  assert.equal(meals[0].plannedEnergyKcal, 600);
  assert.equal(meals[0].items[0].quantity, 1);
  assert.equal(meals[0].items[0].selectedIbgeMeasureId, undefined);
  assert.ok(meals[0].items[0].nutrients.energyKcal > 0);
  assert.ok(meals[0].items[0].nutrients.fiberGrams > 0);
  assert.ok((meals[0].items[0].nutrients.magnesiumMg ?? 0) > 0);
});

test("gera, valida, canonicaliza e reabre a mesma prévia persistível", () => {
  const meals = smartPlanDraftToMealPlanMeals(draft(), patientContext);
  assert.ok(meals);
  const payload = parseMealPlanRecordDraft({
    strategyEntryId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    status: "DRAFT",
    aiDecision: "SUGGESTION_GENERATED",
    smartGenerationVersion: 2,
    meals,
    supplements: [],
  });
  assert.ok(payload);
  const canonical = canonicalizeMealPlanDraftFoods(
    payload,
    patientContext.foodCatalog.foods,
  );
  assert.ok(canonical);

  const totals = calculateMealPlanTotals(canonical.meals);
  const reopened = parseStoredMealPlanPayload(JSON.parse(JSON.stringify({
    ...canonical,
    schemaVersion: 6,
    strategyApprovedAt: "2026-08-03T12:00:00.000Z",
    totals,
  })));

  assert.ok(reopened);
  assert.equal(reopened.meals[0].vetPercentage, 30);
  assert.equal(reopened.meals[0].plannedEnergyKcal, 600);
  assert.equal(
    reopened.meals[0].items[0].householdMeasure,
    canonical.meals[0].items[0].householdMeasure,
  );
  assert.equal(reopened.meals[0].items[0].grams, 85);
});

test("recusa item que não pertence ao Banco Mestre do patientContext", () => {
  assert.equal(
    smartPlanDraftToMealPlanMeals(
      draft("food-id-inexistente"),
      patientContext,
    ),
    null,
  );
});

test("adapta alimento Evonut ativo do Banco Mestre sem alterar sua origem", () => {
  const food = patientContext.foodCatalog.foods[0];
  const evonutFood = {
    ...food,
    source: { ...food.source, kind: "EVONUT" as const },
  };
  const context: PatientContext = {
    ...patientContext,
    foodCatalog: {
      ...patientContext.foodCatalog,
      foods: [evonutFood],
    },
  };

  const meals = smartPlanDraftToMealPlanMeals(draft(evonutFood.id), context);

  assert.ok(meals);
  assert.equal(meals[0].items[0].source, "EVONUT");
});
