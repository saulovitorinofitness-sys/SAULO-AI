import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCarbohydratesByDifference,
  calculateMacronutrient,
  validateMacroDistribution,
} from "@/lib/nutrition";

import {
  canApproveNutritionStrategy,
  nutritionStrategyApprovalIssues,
  resolveMacronutrientDraftInput,
  shouldCreateNutritionStrategyVersion,
} from "./strategy-record";
import {
  nutritionStrategyDraftValidationIssues,
  parseNutritionStrategyDraft,
} from "./strategy-validation";

function completeStrategy() {
  const finalCaloriesKcal = 2000;
  const weightKg = 68;
  const protein = calculateMacronutrient(
    "protein",
    "GRAMS_PER_KG",
    1.6,
    finalCaloriesKcal,
    weightKg,
  )!;
  const fats = calculateMacronutrient(
    "fats",
    "PERCENTAGE",
    30,
    finalCaloriesKcal,
    weightKg,
  )!;
  const carbohydrates = calculateCarbohydratesByDifference(
    finalCaloriesKcal,
    protein.kcal,
    fats.kcal,
    weightKg,
  )!;

  return {
    objective: "MAINTENANCE" as const,
    method: "STANDARD" as const,
    protocol: "MIFFLIN_ST_JEOR" as const,
    calorieAdjustmentPercentage: 0 as const,
    manualFinalCaloriesKcal: finalCaloriesKcal,
    finalCaloriesKcal,
    basalMetabolicRateKcal: 1340.25,
    totalEnergyExpenditureKcal: 2200,
    protein: { mode: "GRAMS_PER_KG" as const, value: 1.6 },
    carbohydrates: {
      mode: "PERCENTAGE" as const,
      value: carbohydrates.percentage,
    },
    fats: { mode: "PERCENTAGE" as const, value: 30 },
    calculatedMacros: { protein, carbohydrates, fats },
    macroValidation: validateMacroDistribution(finalCaloriesKcal, [
      protein,
      carbohydrates,
      fats,
    ]),
    fiberGrams: 30,
    waterMl: 2500,
    mealCount: 5,
    mealDistribution: Array.from({ length: 5 }, (_, index) => ({
      mealNumber: index + 1,
      name: `Refeição ${index + 1}`,
      time: `${String(7 + index * 3).padStart(2, "0")}:00`,
      vetPercentage: 20,
      plannedCaloriesKcal: 400,
    })),
    supplementation: [],
    clinicalObservations: "",
  };
}

test("creates a historical version only on official finalization", () => {
  assert.equal(shouldCreateNutritionStrategyVersion(false), false);
  assert.equal(shouldCreateNutritionStrategyVersion(true), true);
});

test("valida payload persistível e critérios mínimos de aprovação", () => {
  const strategy = completeStrategy();
  const parsed = parseNutritionStrategyDraft(strategy);

  assert.ok(parsed);
  assert.equal(canApproveNutritionStrategy(parsed), true);
  assert.ok(
    parseNutritionStrategyDraft({
      ...strategy,
      protein: {
        mode: "GRAMS",
        value: strategy.calculatedMacros.protein.grams,
      },
    }),
  );
});

test("Recordatório ausente não bloqueia a aprovação da Estratégia", () => {
  const strategy = completeStrategy();

  assert.equal("habitualIntake" in strategy, false);
  assert.deepEqual(nutritionStrategyApprovalIssues(strategy), []);
  assert.equal(canApproveNutritionStrategy(strategy), true);
});

test("VET manual dispensa percentual sem dispensar as demais validações", () => {
  const strategy = {
    ...completeStrategy(),
    energyGoal: "MANUAL_VET" as const,
    calorieAdjustmentPercentage: undefined,
  };

  assert.equal(canApproveNutritionStrategy(strategy), true);
  assert.deepEqual(nutritionStrategyApprovalIssues(strategy), []);
});

test("GET ausente bloqueia aprovação mesmo com VET manual", () => {
  const strategy = completeStrategy();
  const incomplete = {
    ...strategy,
    totalEnergyExpenditureKcal: undefined,
  };
  assert.equal(
    canApproveNutritionStrategy(incomplete),
    false,
  );
  assert.deepEqual(nutritionStrategyApprovalIssues(incomplete), [
    "GET calculado",
  ]);
});

test("bloqueia aprovação sem refeição ou macronutriente", () => {
  const strategy = completeStrategy();

  assert.equal(
    canApproveNutritionStrategy({ ...strategy, mealCount: undefined }),
    false,
  );
  assert.equal(
    canApproveNutritionStrategy({
      ...strategy,
      calculatedMacros: {
        ...strategy.calculatedMacros,
        carbohydrates: undefined,
      },
    }),
    false,
  );
});

test("mantém somente a quantidade de refeições como requisito da estratégia", () => {
  const strategy = completeStrategy();
  assert.equal(canApproveNutritionStrategy(strategy), true);
  assert.equal(
    canApproveNutritionStrategy({
      ...strategy,
      mealCount: 2.5,
    }),
    false,
  );
  assert.deepEqual(
    nutritionStrategyApprovalIssues({
      ...strategy,
      mealDistribution: strategy.mealDistribution.map((meal) => ({ ...meal, name: "", time: "", vetPercentage: 0, plannedCaloriesKcal: undefined })),
    }),
    [],
  );
});

test("dispensa meta diária de água quando há restrição hídrica", () => {
  const strategy = completeStrategy();
  const restricted = {
    ...strategy,
    modifications: ["FLUID_RESTRICTION"] as const,
    waterMl: undefined,
  };

  assert.equal(canApproveNutritionStrategy(restricted), true);
  assert.equal(
    nutritionStrategyApprovalIssues(restricted).includes("Meta diária de água"),
    false,
  );
});

test("mantém meta diária de água obrigatória sem restrição hídrica", () => {
  const strategy = { ...completeStrategy(), waterMl: undefined };

  assert.equal(canApproveNutritionStrategy(strategy), false);
  assert.equal(
    nutritionStrategyApprovalIssues(strategy).includes("Meta diária de água"),
    true,
  );
});

test("finaliza periodização completa com restrição hídrica e refeições sem nome ou horário", () => {
  const strategy = {
    ...completeStrategy(),
    method: "SPORTS_PERIODIZATION" as const,
    modifications: ["FLUID_RESTRICTION"] as const,
    waterMl: undefined,
    specificConfigurations: {
      sportsPeriodization: {
        phase: "PREPARATION",
        objective: "PERFORMANCE",
        sport: "Corrida",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        trainingDays: ["MON", "WED", "FRI"] as const,
        restDays: ["TUE", "THU", "SAT", "SUN"] as const,
        competitionDays: [] as const,
        days: [
          { weekday: "MON" as const, type: "TRAINING" as const, trainingType: "Intervalado", time: "07:00", durationMinutes: 60, intensity: "HIGH" as const },
          { weekday: "TUE" as const, type: "REST" as const },
          { weekday: "WED" as const, type: "TRAINING" as const, trainingType: "Contínuo", time: "07:00", durationMinutes: 50, intensity: "MODERATE" as const },
          { weekday: "THU" as const, type: "REST" as const },
          { weekday: "FRI" as const, type: "TRAINING" as const, trainingType: "Longo", time: "06:00", durationMinutes: 90, intensity: "MODERATE" as const },
          { weekday: "SAT" as const, type: "REST" as const },
          { weekday: "SUN" as const, type: "REST" as const },
        ],
      },
    },
    mealDistribution: completeStrategy().mealDistribution.map((meal) => ({
      ...meal,
      name: "",
      time: "",
    })),
  };

  assert.deepEqual(nutritionStrategyDraftValidationIssues(strategy), []);
  const parsed = parseNutritionStrategyDraft(strategy);
  assert.ok(parsed);
  assert.deepEqual(nutritionStrategyApprovalIssues(parsed), []);
  assert.equal(canApproveNutritionStrategy(parsed), true);
});

test("bloqueia finalização fora da tolerância energética explícita de 2%", () => {
  const strategy = completeStrategy();
  const incompatible = {
    ...strategy,
    macroValidation: {
      ...strategy.macroValidation!,
      differenceKcal: 60,
      differencePercent: 3,
      percentageTotal: 103,
      calculatedCalories: 2060,
      status: "NEAR_TARGET" as const,
    },
  };

  assert.equal(canApproveNutritionStrategy(incompatible), false);
  assert.ok(
    nutritionStrategyApprovalIssues(incompatible).includes(
      "Distribuição energética dos macronutrientes dentro da tolerância de 2%",
    ),
  );
});

test("mantém decisões não confirmadas ausentes no rascunho", () => {
  const strategy = completeStrategy();
  const parsed = parseNutritionStrategyDraft({
    ...strategy,
    protocol: undefined,
    calorieAdjustmentPercentage: undefined,
  });

  assert.ok(parsed);
  assert.equal(canApproveNutritionStrategy(parsed), false);
  assert.deepEqual(nutritionStrategyApprovalIssues(parsed).slice(0, 2), [
    "Protocolo utilizado",
    "Objetivo energético",
  ]);
});

test("não persiste zero como meta energética de refeição", () => {
  const strategy = completeStrategy();
  assert.equal(
    parseNutritionStrategyDraft({
      ...strategy,
      mealDistribution: strategy.mealDistribution.map((meal, index) => ({
        ...meal,
        plannedCaloriesKcal:
          index === 0 ? 0 : meal.plannedCaloriesKcal,
      })),
    }),
    null,
  );
});

test("restaura o alvo de macronutriente a partir do cálculo persistido", () => {
  const strategy = completeStrategy();

  assert.deepEqual(
    resolveMacronutrientDraftInput(
      { mode: "PERCENTAGE" },
      strategy.calculatedMacros.protein,
      "PERCENTAGE",
    ),
    {
      mode: "PERCENTAGE",
      value: strategy.calculatedMacros.protein.percentage,
    },
  );
  assert.deepEqual(
    resolveMacronutrientDraftInput(
      { mode: "GRAMS" },
      strategy.calculatedMacros.protein,
      "PERCENTAGE",
    ),
    {
      mode: "GRAMS",
      value: strategy.calculatedMacros.protein.grams,
    },
  );
});

test("explica exatamente por que o cálculo de macronutriente está pendente", () => {
  const strategy = completeStrategy();
  const missingPercentage = nutritionStrategyApprovalIssues({
    ...strategy,
    protein: { mode: "PERCENTAGE", value: undefined },
    calculatedMacros: {
      ...strategy.calculatedMacros,
      protein: undefined,
    },
  });
  const missingWeight = nutritionStrategyApprovalIssues({
    ...strategy,
    protein: { mode: "GRAMS_PER_KG", value: 1.6 },
    calculatedMacros: {
      ...strategy.calculatedMacros,
      protein: undefined,
    },
  });

  assert.ok(missingPercentage.includes("Proteínas: percentual não informado"));
  assert.ok(
    missingWeight.includes("Proteínas: peso não informado para o cálculo em g/kg"),
  );
});
