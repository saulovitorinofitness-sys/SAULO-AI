import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { ProfessionalFood } from "@/features/food-database";

import {
  compareHabitualIntakeWithGet,
  quantifyHabitualIntake,
  suggestPatternEnergyStrategy,
  type NutritionEvolutionGoal,
  type QuantifiedRecallItem,
} from "./habitual-intake-engine";

function food(
  id: string,
  name: string,
  nutrients: Partial<NonNullable<ProfessionalFood["nutrients"]>>,
  referenceServingUnit = "g",
): ProfessionalFood {
  return {
    id,
    officialName: name,
    normalizedName: name.toLowerCase(),
    category: "Categoria",
    categoryId: "category",
    foodGroup: "Grupo",
    source: {
      id: "source",
      kind: "TACO",
      name: "TACO",
      origin: "OFFICIAL",
      editable: false,
    },
    referenceServingGrams: 100,
    referenceServingUnit,
    status: "ACTIVE",
    nutrients: {
      energyKcal: null,
      proteinGrams: null,
      carbohydratesGrams: null,
      fatsGrams: null,
      fiberGrams: null,
      sugarsGrams: null,
      cholesterolMg: null,
      saturatedFatsGrams: null,
      monounsaturatedFatsGrams: null,
      polyunsaturatedFatsGrams: null,
      sodiumMg: null,
      calciumMg: null,
      ironMg: null,
      magnesiumMg: null,
      phosphorusMg: null,
      potassiumMg: null,
      zincMg: null,
      copperMg: null,
      manganeseMg: null,
      seleniumMcg: null,
      vitaminAMcg: null,
      vitaminCMg: null,
      vitaminDMcg: null,
      vitaminEMg: null,
      vitaminKMcg: null,
      thiamineMg: null,
      riboflavinMg: null,
      niacinMg: null,
      vitaminB6Mg: null,
      folateMcg: null,
      vitaminB12Mcg: null,
      ...nutrients,
    },
    householdMeasures: [],
    synonyms: [],
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
  };
}

const foods = [
  food("10000000-0000-4000-8000-000000000001", "Arroz", {
    energyKcal: 125,
    proteinGrams: 2.5,
    carbohydratesGrams: 25,
    fatsGrams: 1,
    fiberGrams: 2,
    ironMg: 1,
  }),
  food("10000000-0000-4000-8000-000000000002", "Frango", {
    energyKcal: 200,
    proteinGrams: 30,
    carbohydratesGrams: 0,
    fatsGrams: 8,
    fiberGrams: 0,
    ironMg: 2,
  }),
  food("10000000-0000-4000-8000-000000000003", "Banana", {
    energyKcal: 90,
    proteinGrams: 1,
    carbohydratesGrams: 23,
    fatsGrams: 0.2,
    fiberGrams: 2.5,
    potassiumMg: 350,
  }),
];

function recall(amounts: readonly (number | undefined)[] = [200, 150, 100]): QuantifiedRecallItem[] {
  return foods.map((item, index) => ({
    id: `recall-${index}`,
    foodId: item.id,
    foodName: item.officialName,
    mealName: index === 2 ? "Lanche" : "Almoco",
    amount: amounts[index],
    unit: "g",
  }));
}

function suggestion(input: {
  energy?: number;
  get?: number;
  objective?: "WEIGHT_LOSS" | "HYPERTROPHY" | "MAINTENANCE" | "HEALTH" | "PERFORMANCE";
  goal?: NutritionEvolutionGoal;
}) {
  const estimate = quantifyHabitualIntake(recall(), foods);
  const adjustedEstimate = input.energy === undefined
    ? estimate
    : { ...estimate, totals: { ...estimate.totals, energyKcal: input.energy } };
  return suggestPatternEnergyStrategy({
    estimate: adjustedEstimate,
    totalEnergyExpenditureKcal: input.get ?? 2_900,
    objective: input.objective,
    goal: input.goal,
  });
}

test("recordatorio quantificado calcula energia, macros, fibras e micronutrientes reais", () => {
  const estimate = quantifyHabitualIntake(recall(), foods);
  assert.equal(estimate.confidence, "HIGH");
  assert.equal(estimate.quantifiedItemCount, 3);
  assert.equal(estimate.totals.energyKcal, 640);
  assert.equal(estimate.totals.proteinGrams, 51);
  assert.equal(estimate.totals.carbohydratesGrams, 73);
  assert.equal(estimate.totals.fiberGrams, 6.5);
  assert.equal(estimate.totals.micronutrients.ironMg, 5);
  assert.equal(estimate.totals.micronutrients.potassiumMg, 350);
});

test("quantidade ausente reduz confianca e nunca recebe porcao inventada", () => {
  const estimate = quantifyHabitualIntake(recall([200, undefined, 100]), foods);
  assert.equal(estimate.confidence, "LOW");
  assert.equal(estimate.quantifiedItemCount, 2);
  assert.equal(estimate.totals.energyKcal, 340);
  assert.ok(estimate.warnings.some((warning) => warning.includes("sem quantidade")));
});

test("ml nao e convertido em gramas quando a fonte nao possui referencia por volume", () => {
  const items = [{ ...recall()[0], unit: "ml" as const }];
  const estimate = quantifyHabitualIntake(items, foods);
  assert.equal(estimate.quantifiedItemCount, 0);
  assert.equal(estimate.totals.energyKcal, undefined);
});

test("comparacao calcula ingestao habitual menos GET", () => {
  const result = suggestion({
    energy: 2_700,
    objective: "WEIGHT_LOSS",
    goal: { direction: "LOSS", targetKg: 2, periodDays: 30 },
  });
  assert.equal(result?.differenceFromGetKcal, -200);
});

test("comparacao com GET independe da definicao posterior da meta", () => {
  const estimate = quantifyHabitualIntake(recall(), foods);
  const adjusted = { ...estimate, totals: { ...estimate.totals, energyKcal: 2_700 } };
  const comparison = compareHabitualIntakeWithGet(adjusted, 2_900);
  assert.equal(comparison?.differenceKcal, -200);
  assert.equal(comparison?.incompatible, false);
});

test("emagrecimento gera reducao progressiva a partir do padrao habitual", () => {
  const result = suggestion({
    energy: 2_700,
    objective: "WEIGHT_LOSS",
    goal: { direction: "LOSS", targetKg: 2, periodDays: 30 },
  });
  assert.equal(result?.adjustmentType, "DEFICIT");
  assert.equal(result?.suggestedVetKcal, 2_425);
  assert.equal(result?.suggestedAdjustmentKcal, -475);
});

test("hipertrofia sugere superavit progressivo", () => {
  const result = suggestion({
    energy: 2_800,
    get: 2_900,
    objective: "HYPERTROPHY",
    goal: { direction: "GAIN", targetKg: 1, periodDays: 30 },
  });
  assert.equal(result?.adjustmentType, "SURPLUS");
  assert.ok((result?.suggestedVetKcal ?? 0) > 2_800);
});

test("manutencao aproxima progressivamente a ingestao do GET", () => {
  const result = suggestion({
    energy: 2_700,
    get: 2_900,
    objective: "MAINTENANCE",
    goal: { direction: "MAINTENANCE" },
  });
  assert.equal(result?.adjustmentType, "MAINTENANCE");
  assert.equal(result?.suggestedVetKcal, 2_900);
});

test("meta maior influencia o alvo teorico sem exceder o passo progressivo inicial", () => {
  const smaller = suggestion({ energy: 2_700, objective: "WEIGHT_LOSS", goal: { direction: "LOSS", targetKg: 0.5, periodDays: 30 } });
  const larger = suggestion({ energy: 2_700, objective: "WEIGHT_LOSS", goal: { direction: "LOSS", targetKg: 3, periodDays: 30 } });
  assert.ok((larger?.targetVetFromGoalKcal ?? 0) < (smaller?.targetVetFromGoalKcal ?? 0));
  assert.ok((larger?.suggestedVetKcal ?? 0) >= 2_425);
});

test("ingestao 1500 kcal e GET 2900 gera alerta de incompatibilidade e nao sugere VET", () => {
  const result = suggestion({
    energy: 1_500,
    get: 2_900,
    objective: "MAINTENANCE",
    goal: { direction: "MAINTENANCE" },
  });
  assert.equal(result?.incompatible, true);
  assert.equal(result?.suggestedVetKcal, undefined);
  assert.ok(result?.warnings.some((warning) => warning.includes("incompat\u00edvel")));
});

test("diabetes, idoso e atleta preservam decisao profissional sem regra automatica extra", () => {
  for (const objective of ["HEALTH", "MAINTENANCE", "PERFORMANCE"] as const) {
    const result = suggestion({
      energy: 2_700,
      get: 2_900,
      objective,
      goal: { direction: "MAINTENANCE" },
    });
    assert.equal(result?.suggestedVetKcal, 2_900);
    assert.ok(result?.rationale.includes("Requer aceita\u00e7\u00e3o"));
  }
});

test("motor permanece puro e nao salva nem aplica decisao automaticamente", async () => {
  const source = await readFile("src/features/nutrition-strategy/habitual-intake-engine.ts", "utf8");
  assert.equal(source.includes("prisma"), false);
  assert.equal(source.includes("repository"), false);
  assert.equal(source.includes("fetch("), false);
});

test("quantificacao permanece leve mesmo com cem itens informados", () => {
  const manyItems = Array.from({ length: 100 }, (_, index) => ({
    ...recall()[index % foods.length],
    id: `many-${index}`,
  }));
  const startedAt = performance.now();
  const estimate = quantifyHabitualIntake(manyItems, foods);
  const duration = performance.now() - startedAt;
  assert.equal(estimate.quantifiedItemCount, 100);
  assert.ok(duration < 50, `Tempo observado: ${duration.toFixed(2)} ms`);
});

test("API canoniza alimentos e a Estratégia mantém o Recordatório somente como leitura", async () => {
  const [route, workspace] = await Promise.all([
    readFile("src/app/api/patients/[patientId]/attendances/[attendanceId]/nutrition-strategy/route.ts", "utf8"),
    readFile("src/components/nutrition-strategy/nutrition-strategy-decision-engine.tsx", "utf8"),
  ]);
  assert.ok(route.includes("foodRepository.findManyByIds(foodIds)"));
  assert.ok(route.includes('action === "QUANTIFY_RECALL"'));
  assert.ok(route.includes('vetDecisionState: "APPROVED"'));
  assert.ok(workspace.includes("Resumo somente para leitura"));
  assert.ok(workspace.includes("Revisar na Anamnese"));
  assert.equal(workspace.includes("Aceitar sugest&atilde;o"), false);
  assert.equal(workspace.includes("acceptPatternSuggestion"), false);
});
