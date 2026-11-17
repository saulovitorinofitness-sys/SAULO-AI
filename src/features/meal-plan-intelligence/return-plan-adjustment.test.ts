import "dotenv/config";

import assert from "node:assert/strict";
import test from "node:test";

import type { ProfessionalFood } from "@/features/food-database";
import {
  calculateFoodNutrientsForGrams,
  EMPTY_FOOD_NUTRIENTS,
} from "@/features/meal-plan/nutrition-calculations";
import type { MealPlanRecordMeal } from "@/features/meal-plan/record";

import type { EligibleFood } from "./nutritional-decision-engine";
import type { PatientContext } from "./patient-context-service";
import {
  adjustPreviousPlanMeals,
  inheritMissingMealSchedules,
} from "./return-plan-adjustment";

const foodId = "4ff48dc8-9532-44d5-a599-c327be55434a";
const mealId = "0dde6733-90c2-4dc7-acac-a79f5155030f";
const itemId = "3e8ab848-c09c-4d33-b2f7-6fccda22bcdc";
const measureId = "51ebf1a0-859d-4b3f-8a20-8c59a29f82fa";

const nutrients = {
  ...EMPTY_FOOD_NUTRIENTS,
  energyKcal: 130,
  proteinGrams: 2.5,
  carbohydratesGrams: 28,
  fatsGrams: 0.4,
  fiberGrams: 1.6,
};

const food = {
  id: foodId,
  officialName: "Arroz integral cozido",
  normalizedName: "arroz integral cozido",
  description: "Arroz integral cozido",
  category: "Cereais",
  categoryId: "dc2e261d-9604-452c-a45f-bf53bc9b2d7d",
  foodGroup: "Cereais",
  source: {
    id: "d4b1e37b-e51d-4cd3-8864-e0c70d34728d",
    kind: "TACO",
    name: "TACO",
    version: "4ª edição",
    origin: "OFFICIAL",
    editable: false,
  },
  sourceCode: "1",
  referenceServingGrams: 100,
  referenceServingUnit: "g",
  status: "ACTIVE",
  nutrients,
  householdMeasures: [],
  synonyms: [],
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
} satisfies ProfessionalFood;

const previousMeals: readonly MealPlanRecordMeal[] = [
  {
    id: mealId,
    name: "Almoço",
    order: 1,
    time: "12:30",
    vetPercentage: 100,
    plannedEnergyKcal: 260,
    items: [
      {
        id: itemId,
        catalogFoodId: foodId,
        description: food.officialName,
        foodGroup: food.foodGroup,
        source: "TACO",
        sourceName: "TACO",
        sourceVersion: "4ª edição",
        sourceCode: "1",
        primaryHouseholdMeasure: "colher de servir",
        standardWeightGrams: 100,
        grams: 200,
        prescribedAmount: 200,
        prescribedUnit: "g",
        householdMeasure: "colher de servir",
        measureOptions: [],
        selectedIbgeMeasureId: measureId,
        ibgeMeasureOptions: [
          {
            id: measureId,
            label: "Colher de servir",
            measureName: "Colher de servir",
            preparationCode: "",
            preparationName: "",
            amountPerMeasure: 50,
            unit: "g",
          },
        ],
        quantity: 4,
        nutrientsPer100g: nutrients,
        nutrients: calculateFoodNutrientsForGrams(nutrients, 200),
        substitutions: [],
      },
    ],
  },
];

function context(time = ""): PatientContext {
  return {
    patient: {
      patientId: "patient-return",
      masterRecordId: "master-return",
      attendanceId: "attendance-return",
      sex: "FEMALE",
      ageYears: 40,
      weightKg: 65,
      heightCm: 165,
      bmi: 23.9,
      objective: "Redução de gordura",
      secondaryObjectives: [],
      source: "MASTER_RECORD",
    },
    clinical: {
      pathologies: [],
      availableExams: [],
      allergyStatus: "DENIED",
      allergies: [],
      intolerances: [],
      restrictions: [],
      refusedFoods: [],
      preferredFoods: ["arroz"],
      dailyRoutine: [],
      mealSchedules: [{ mealNumber: 1, name: "Almoço", time }],
      exercise: {},
      relevantObservations: [],
      unavailableStructuredFields: [],
      source: "MASTER_RECORD",
    },
    nutritionStrategy: {
      sourceStrategyId: "strategy-return",
      protocol: "MIFFLIN_ST_JEOR",
      totalEnergyExpenditureKcal: 2_000,
      caloriesKcal: 234,
      protein: { grams: 100, percentage: 25 },
      carbohydrates: { grams: 180, percentage: 45 },
      fats: { grams: 53, percentage: 30 },
      dailyDistribution: [
        {
          mealNumber: 1,
          name: "Almoço",
          time,
          vetPercentage: 100,
          plannedCaloriesKcal: 234,
        },
      ],
      supplementation: [],
      observations: "",
      source: "NUTRITION_STRATEGY",
    },
    foodCatalog: {
      source: "MASTER_FOOD_DATABASE",
      activeFoodCount: 1,
      availableSources: ["TACO"],
      foods: [food],
    },
  };
}

const eligibleFoods: readonly EligibleFood[] = [
  {
    foodId,
    name: food.officialName,
    group: food.foodGroup,
    status: "APROVADO",
    reason: "Sem restrição aplicável.",
  },
];

test("retorno herda horário e preserva IDs, alimento e medida do último plano", () => {
  const inherited = inheritMissingMealSchedules(context(), previousMeals);
  const result = adjustPreviousPlanMeals({
    context: inherited,
    previousMeals,
    catalogFoods: [food],
    eligibleFoods,
  });

  assert.equal(inherited.nutritionStrategy.dailyDistribution[0].time, "12:30");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.meals[0].id, mealId);
  assert.equal(result.meals[0].items[0].id, itemId);
  assert.equal(result.meals[0].items[0].catalogFoodId, foodId);
  assert.equal(result.meals[0].items[0].selectedIbgeMeasureId, measureId);
  assert.equal(result.meals[0].items[0].householdMeasure, "colher de servir");
  assert.equal(result.meals[0].time, "12:30");
  assert.equal((result.meals[0].items[0].quantity * 2) % 1, 0);
});

test("retorno não inventa substituição quando alimento anterior está bloqueado", () => {
  const result = adjustPreviousPlanMeals({
    context: context("12:30"),
    previousMeals,
    catalogFoods: [food],
    eligibleFoods: eligibleFoods.map((entry) => ({
      ...entry,
      status: "BLOQUEADO" as const,
    })),
  });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.deepEqual(result.missing, [food.officialName]);
});
