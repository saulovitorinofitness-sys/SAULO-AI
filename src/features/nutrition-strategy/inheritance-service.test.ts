import assert from "node:assert/strict";
import test from "node:test";

import { toMealPlanStrategyInheritance } from "./inheritance";
import type { NutritionStrategyRecordView } from "./strategy-record";

function approvedStrategy(): NutritionStrategyRecordView {
  return {
    id: "strategy-1",
    patientId: "patient-1",
    masterRecordId: "master-record-1",
    attendanceId: "attendance-1",
    evaluationEntryId: "evaluation-1",
    status: "APPROVED",
    objective: "WEIGHT_LOSS",
    secondaryObjectives: ["Preservar massa magra"],
    method: "STANDARD",
    protocol: "MIFFLIN_ST_JEOR",
    calorieAdjustmentPercentage: -20,
    totalEnergyExpenditureKcal: 2_250,
    finalCaloriesKcal: 1_800,
    protein: { mode: "GRAMS", value: 150 },
    carbohydrates: { mode: "GRAMS", value: 195 },
    fats: { mode: "GRAMS", value: 60 },
    calculatedMacros: {
      protein: {
        gramsPerKg: 2,
        grams: 150,
        kcal: 600,
        percentage: 33.3333333333,
      },
      carbohydrates: {
        gramsPerKg: 2.6,
        grams: 195,
        kcal: 780,
        percentage: 43.3333333333,
      },
      fats: {
        gramsPerKg: 0.8,
        grams: 60,
        kcal: 540,
        percentage: 30,
      },
    },
    fiberGrams: 30,
    waterMl: 2800,
    mealCount: 5,
    mealDistribution: Array.from({ length: 5 }, (_, index) => ({
      mealNumber: index + 1,
      energyPercentage: 20,
      proteinPercentage: 20,
      carbohydratesPercentage: 20,
      fatsPercentage: 20,
    })),
    supplementation: [
      {
        id: "supplement-1",
        name: "Suplemento registrado",
        objective: "Objetivo profissional",
        schedule: "Conforme rotina",
        observations: "",
      },
    ],
    clinicalObservations: "Acompanhar evolução.",
    createdAt: "2026-07-26T10:00:00.000Z",
    updatedAt: "2026-07-26T10:10:00.000Z",
    responsibleUserId: "user-1",
    responsibleName: "Saulo Xavier Vitorino",
    approvedAt: "2026-07-26T10:10:00.000Z",
    approvedByUserId: "user-1",
    approvedByName: "Saulo Xavier Vitorino",
    version: 2,
  };
}

test("fornece ao Plano Alimentar somente o contrato da estratégia aprovada", () => {
  const inheritance = toMealPlanStrategyInheritance(approvedStrategy());

  assert.deepEqual(inheritance, {
    sourceStrategyId: "strategy-1",
    patientId: "patient-1",
    masterRecordId: "master-record-1",
    attendanceId: "attendance-1",
    evaluationEntryId: "evaluation-1",
    objective: "WEIGHT_LOSS",
    secondaryObjectives: ["Preservar massa magra"],
    method: "STANDARD",
    protocol: "MIFFLIN_ST_JEOR",
    totalEnergyExpenditureKcal: 2_250,
    caloriesKcal: 1_800,
    proteinGrams: 150,
    proteinPercentage: 33.3333333333,
    carbohydratesGrams: 195,
    carbohydratesPercentage: 43.3333333333,
    fatsGrams: 60,
    fatsPercentage: 30,
    fiberGrams: 30,
    waterMl: 2800,
    mealCount: 5,
    mealDistribution: Array.from({ length: 5 }, (_, index) => ({
      mealNumber: index + 1,
      energyPercentage: 20,
      proteinPercentage: 20,
      carbohydratesPercentage: 20,
      fatsPercentage: 20,
    })),
    supplementation: [
      {
        id: "supplement-1",
        name: "Suplemento registrado",
        objective: "Objetivo profissional",
        schedule: "Conforme rotina",
        observations: "",
      },
    ],
    clinicalObservations: "Acompanhar evolução.",
    calorieAdjustmentPercentage: -20,
    status: "APPROVED",
    approvedAt: "2026-07-26T10:10:00.000Z",
    approvedByUserId: "user-1",
  });
});

test("não fornece rascunho nem estratégia incompleta", () => {
  assert.equal(
    toMealPlanStrategyInheritance({
      ...approvedStrategy(),
      status: "DRAFT",
    }),
    null,
  );
  assert.equal(
    toMealPlanStrategyInheritance({
      ...approvedStrategy(),
      calculatedMacros: {
        ...approvedStrategy().calculatedMacros,
        fats: undefined,
      },
    }),
    null,
  );
});
