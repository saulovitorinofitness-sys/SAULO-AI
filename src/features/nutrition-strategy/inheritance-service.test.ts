import assert from "node:assert/strict";
import test from "node:test";

import {
  mealPlanStrategyInheritanceIssues,
  toMealPlanStrategyInheritance,
} from "./inheritance";
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
    modifications: ["HIGH_PROTEIN", "HIGH_FIBER"],
    clinicalProtocols: ["OBESITY_WEIGHT_LOSS"],
    clinicalProtocol: "OBESITY_WEIGHT_LOSS",
    specificConfigurations: {},
    energyGoal: "DEFICIT_MODERATE",
    protocol: "MIFFLIN_ST_JEOR",
    calorieAdjustmentPercentage: -20,
    totalEnergyExpenditureKcal: 2_250,
    finalCaloriesKcal: 1_800,
    protein: { mode: "GRAMS", value: 150 },
    carbohydrates: { mode: "GRAMS", value: 165 },
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
        grams: 165,
        kcal: 660,
        percentage: 36.6666666667,
      },
      fats: {
        gramsPerKg: 0.8,
        grams: 60,
        kcal: 540,
        percentage: 30,
      },
    },
    macroValidation: {
      plannedCalories: 1800,
      calculatedCalories: 1800,
      differenceKcal: 0,
      differencePercent: 0,
      percentageTotal: 100,
      status: "ADEQUATE",
    },
    fiberGrams: 30,
    waterMl: 2800,
    mealCount: 5,
    mealDistribution: Array.from({ length: 5 }, (_, index) => ({
      mealNumber: index + 1,
      name: `Refeição ${index + 1}`,
      time: `${String(7 + index * 3).padStart(2, "0")}:00`,
      vetPercentage: 20,
      plannedCaloriesKcal: 360,
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
    modifications: ["HIGH_PROTEIN", "HIGH_FIBER"],
    clinicalProtocols: ["OBESITY_WEIGHT_LOSS"],
    clinicalProtocol: "OBESITY_WEIGHT_LOSS",
    specificConfigurations: {},
    energyGoal: "DEFICIT_MODERATE",
    protocol: "MIFFLIN_ST_JEOR",
    totalEnergyExpenditureKcal: 2_250,
    caloriesKcal: 1_800,
    proteinGrams: 150,
    proteinPercentage: 33.3333333333,
    carbohydratesGrams: 165,
    carbohydratesPercentage: 36.6666666667,
    fatsGrams: 60,
    fatsPercentage: 30,
    fiberGrams: 30,
    waterMl: 2800,
    mealCount: 5,
    mealDistribution: Array.from({ length: 5 }, (_, index) => ({
      mealNumber: index + 1,
      name: `Refeição ${index + 1}`,
      time: `${String(7 + index * 3).padStart(2, "0")}:00`,
      vetPercentage: 20,
      plannedCaloriesKcal: 360,
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

test("estratégia concluída com método atual libera diretamente o Plano do mesmo atendimento", () => {
  const strategy = {
    ...approvedStrategy(),
    method: "BALANCED_BRAZILIAN" as const,
  };
  const inheritance = toMealPlanStrategyInheritance(strategy);

  assert.ok(inheritance);
  assert.equal(inheritance.patientId, strategy.patientId);
  assert.equal(inheritance.masterRecordId, strategy.masterRecordId);
  assert.equal(inheritance.attendanceId, strategy.attendanceId);
  assert.equal(inheritance.sourceStrategyId, strategy.id);
  assert.equal(inheritance.method, "BALANCED_BRAZILIAN");
});

test("informa nominalmente campo realmente ausente sem inventar valor", () => {
  const strategy = { ...approvedStrategy(), method: undefined };

  assert.deepEqual(mealPlanStrategyInheritanceIssues(strategy), [
    "Padrão/método alimentar principal",
  ]);
  assert.equal(toMealPlanStrategyInheritance(strategy), null);
});
