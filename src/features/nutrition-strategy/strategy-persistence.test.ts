import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { NUTRITION_METHOD_OPTIONS } from "./prescription";

process.env.DATABASE_URL ??=
  "postgresql://test:test@127.0.0.1:5432/saulo_ai_test";

async function parseStored(value: unknown) {
  const { parseStoredNutritionStrategyPayload } = await import(
    "./strategy-repository"
  );
  return parseStoredNutritionStrategyPayload(value);
}

function storedStrategy(method: (typeof NUTRITION_METHOD_OPTIONS)[number][0]) {
  return {
    schemaVersion: 5,
    objective: "WEIGHT_LOSS",
    secondaryObjectives: ["Preservar massa magra"],
    method,
    modifications: ["HIGH_PROTEIN", "HIGH_FIBER"],
    clinicalProtocols: ["SPORTS_NUTRITION"],
    specificConfigurations: {
      sportsPeriodization: {
        phase: "COMPETITION",
        objective: "PERFORMANCE",
        sport: "Corrida",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        trainingDays: ["MON", "WED"],
        restDays: ["TUE"],
        competitionDays: ["SAT"],
        days: [
          {
            weekday: "MON",
            type: "TRAINING",
            trainingType: "Intervalado",
            time: "07:00",
            durationMinutes: 60,
            intensity: "HIGH",
          },
        ],
        nutritionTargets: {
          TRAINING: {
            energyKcal: 2_100,
            protein: { mode: "GRAMS", value: 150 },
            carbohydrates: { mode: "GRAMS", value: 250 },
            fats: { mode: "GRAMS", value: 55 },
          },
        },
      },
    },
    energyGoal: "DEFICIT_MODERATE",
    protocol: "MIFFLIN_ST_JEOR",
    calorieAdjustmentPercentage: -20,
    finalCaloriesKcal: 1_836,
    basalMetabolicRateKcal: 1_700,
    totalEnergyExpenditureKcal: 2_295,
    protein: { mode: "GRAMS", value: 150 },
    carbohydrates: { mode: "GRAMS", value: 200 },
    fats: { mode: "GRAMS", value: 48.4 },
    calculatedMacros: {
      protein: { grams: 150, kcal: 600, percentage: 32.68 },
      carbohydrates: { grams: 200, kcal: 800, percentage: 43.57 },
      fats: { grams: 48.4, kcal: 435.6, percentage: 23.73 },
    },
    macroValidation: {
      plannedCalories: 1_836,
      calculatedCalories: 1_835.6,
      differenceKcal: -0.4,
      differencePercent: -0.02,
      percentageTotal: 99.98,
      status: "ADEQUATE",
    },
    fiberGrams: 30,
    waterMl: 2_500,
    mealCount: 2,
    mealDistribution: [
      { mealNumber: 1, name: "Café da manhã", time: "08:00", vetPercentage: 40, plannedCaloriesKcal: 734.4 },
      { mealNumber: 2, name: "Jantar", time: "19:00", vetPercentage: 60, plannedCaloriesKcal: 1_101.6 },
    ],
    supplementation: [],
    clinicalObservations: "Conduta registrada.",
    evolutionGoal: { direction: "LOSS", targetKg: 4, periodDays: 60 },
    vetDecisionState: "APPROVED",
    approvedAt: "2026-10-12T12:00:00.000Z",
    approvedByUserId: "professional-1",
    approvedByName: "Saulo Xavier Vitorino",
  } as const;
}

test("recarrega todos os métodos alimentares persistidos sem apagar o campo principal", async () => {
  for (const [method] of NUTRITION_METHOD_OPTIONS) {
    const reloaded = await parseStored(storedStrategy(method));
    assert.equal(reloaded?.method, method);
  }
});

test("recarrega protocolo, macros, refeições, metas e periodização da estratégia concluída", async () => {
  const stored = storedStrategy("SPORTS_PERIODIZATION");
  const reloaded = await parseStored(
    JSON.parse(JSON.stringify(stored)),
  );

  assert.ok(reloaded);
  assert.equal(reloaded.protocol, stored.protocol);
  assert.deepEqual(reloaded.calculatedMacros, stored.calculatedMacros);
  assert.deepEqual(reloaded.mealDistribution, stored.mealDistribution);
  assert.deepEqual(reloaded.evolutionGoal, stored.evolutionGoal);
  assert.deepEqual(
    reloaded.specificConfigurations?.sportsPeriodization,
    stored.specificConfigurations.sportsPeriodization,
  );
  assert.deepEqual(reloaded.modifications, stored.modifications);
  assert.equal(reloaded.finalCaloriesKcal, 1_836);
});

test("Estratégia, barra lateral e Plano consultam o mesmo atendimento sem criar rascunho na leitura", async () => {
  const [repository, strategyPage, planService, flowRepository] =
    await Promise.all([
      readFile(new URL("./strategy-repository.ts", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../../app/(authenticated)/pacientes/[patientId]/estrategia-nutricional/page.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../meal-plan/foundation-service.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../nutrition-clinical-flow/repository.ts", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(
    repository,
    /getForClinicalAttendance[\s\S]*return this\.get\(patientId, attendanceId\)/,
  );
  assert.doesNotMatch(repository, /findLatestApprovedStrategyForAttendanceMasterRecord/);
  assert.match(strategyPage, /view\.attendanceId/);
  assert.match(planService, /getForMealPlan\([\s\S]*input\.attendanceId/);
  assert.match(
    flowRepository,
    /getForClinicalAttendance\([\s\S]*context\.attendanceId/,
  );
  assert.doesNotMatch(
    repository.match(/async getForClinicalAttendance[\s\S]*?\n  },/)?.[0] ?? "",
    /persistStrategy|create\(/,
  );
});
