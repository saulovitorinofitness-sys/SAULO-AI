import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { EligibleFood } from "./nutritional-decision-engine";
import type { PatientContext } from "./patient-context-service";
import type { SmartPlanDraft } from "./smart-plan-draft-generator";
import { assistedClinicalDecisionEngine } from "./assisted-clinical-decision-engine";

interface Scenario {
  readonly objective?: string;
  readonly pathologies?: readonly string[];
  readonly intolerances?: readonly string[];
  readonly restrictions?: readonly string[];
  readonly strategyMissing?: boolean;
}

function context(scenario: Scenario = {}): PatientContext {
  const patientContext: PatientContext = {
    patient: {
      patientId: "patient-clinical-decision",
      masterRecordId: "master-clinical-decision",
      attendanceId: "attendance-clinical-decision",
      sex: "FEMALE",
      ageYears: 40,
      weightKg: 70,
      heightCm: 165,
      bmi: 25.7,
      objective: scenario.objective ?? "Manutenção da saúde",
      secondaryObjectives: [],
      source: "MASTER_RECORD",
    },
    clinical: {
      pathologies: scenario.pathologies ?? [],
      availableExams: ["Hemograma disponível"],
      allergyStatus: "DENIED",
      allergies: [],
      intolerances: scenario.intolerances ?? [],
      restrictions: scenario.restrictions ?? [],
      refusedFoods: [],
      preferredFoods: [],
      dailyRoutine: ["Trabalho diurno"],
      mealSchedules: [
        { mealNumber: 1, name: "Café da manhã", time: "07:00" },
        { mealNumber: 2, name: "Almoço", time: "12:00" },
        { mealNumber: 3, name: "Lanche", time: "16:00" },
        { mealNumber: 4, name: "Jantar", time: "20:00" },
      ],
      exercise: {},
      relevantObservations: [],
      unavailableStructuredFields: [],
      source: "MASTER_RECORD",
    },
    nutritionStrategy: {
      sourceStrategyId: "strategy-clinical-decision",
      protocol: "MIFFLIN_ST_JEOR",
      totalEnergyExpenditureKcal: 2_000,
      caloriesKcal: 1_800,
      protein: { grams: 120, percentage: 26.7 },
      carbohydrates: { grams: 200, percentage: 44.4 },
      fats: { grams: 58, percentage: 29 },
      dailyDistribution: [
        { mealNumber: 1, name: "Café da manhã", time: "07:00", vetPercentage: 25, plannedCaloriesKcal: 450 },
        { mealNumber: 2, name: "Almoço", time: "12:00", vetPercentage: 35, plannedCaloriesKcal: 630 },
        { mealNumber: 3, name: "Lanche", time: "16:00", vetPercentage: 15, plannedCaloriesKcal: 270 },
        { mealNumber: 4, name: "Jantar", time: "20:00", vetPercentage: 25, plannedCaloriesKcal: 450 },
      ],
      supplementation: [],
      observations: "",
      source: "NUTRITION_STRATEGY",
    },
    foodCatalog: {
      source: "MASTER_FOOD_DATABASE",
      activeFoodCount: 0,
      availableSources: [],
      foods: [],
    },
  };
  return scenario.strategyMissing
    ? ({ ...patientContext, nutritionStrategy: undefined } as unknown as PatientContext)
    : patientContext;
}

function evaluate(scenario: Scenario = {}) {
  return assistedClinicalDecisionEngine.evaluate({ patientContext: context(scenario) });
}

function codes(items: readonly { code: string }[]) {
  return items.map((entry) => entry.code);
}

test("emagrecimento gera prioridade e recomendação de saciedade", () => {
  const decision = evaluate({ objective: "Emagrecimento" });
  assert.equal(decision.status, "READY");
  assert.ok(codes(decision.priorities).includes("WEIGHT_REDUCTION"));
  assert.ok(codes(decision.recommendations).includes("SATIETY"));
});

test("hipertrofia gera prioridade sem escolher alimentos", () => {
  const decision = evaluate({ objective: "Hipertrofia" });
  assert.ok(codes(decision.priorities).includes("MUSCLE_GAIN"));
  assert.ok(codes(decision.recommendations).includes("PROTEIN_DISTRIBUTION"));
  assert.equal("foods" in decision, false);
});

test("diabetes gera controle glicêmico e cautela com açúcar adicionado", () => {
  const decision = evaluate({ pathologies: ["Diabetes mellitus tipo 2"] });
  assert.ok(codes(decision.priorities).includes("GLYCEMIC_CONTROL"));
  assert.ok(codes(decision.restrictions).includes("LIMIT_ADDED_SUGAR"));
  assert.ok(codes(decision.recommendations).includes("WHOLE_FOODS"));
});

test("HAS gera controle pressórico e limite de sódio", () => {
  const decision = evaluate({ pathologies: ["HAS"] });
  assert.ok(codes(decision.priorities).includes("BLOOD_PRESSURE_CONTROL"));
  assert.ok(codes(decision.restrictions).includes("LIMIT_SODIUM"));
});

test("intolerância à lactose gera restrição explícita", () => {
  const decision = evaluate({ intolerances: ["Intolerância à lactose"] });
  assert.ok(codes(decision.restrictions).includes("EXCLUDE_LACTOSE"));
  assert.ok(codes(decision.recommendations).includes("LACTOSE_FREE"));
});

test("vegetariano exclui carnes e recomenda proteínas vegetais", () => {
  const decision = evaluate({ restrictions: ["Vegetariano"] });
  assert.ok(codes(decision.restrictions).includes("VEGETARIAN_PATTERN"));
  assert.ok(codes(decision.recommendations).includes("PLANT_PROTEINS"));
});

test("negações e termos parecidos não criam restrições falsas", () => {
  const decision = evaluate({
    pathologies: ["Tireoidite de Hashimoto"],
    intolerances: ["Nega intolerância à lactose"],
    restrictions: ["Não vegetariano"],
  });
  assert.ok(!codes(decision.priorities).includes("BLOOD_PRESSURE_CONTROL"));
  assert.ok(!codes(decision.restrictions).includes("EXCLUDE_LACTOSE"));
  assert.ok(!codes(decision.restrictions).includes("VEGETARIAN_PATTERN"));
});

test("objetivo ausente produz clinicalDecision com pendência", () => {
  const decision = evaluate({ objective: "" });
  assert.equal(decision.status, "PENDING");
  assert.ok(decision.pending.some((entry) => entry.field === "objective" && entry.expectedSource === "Prontuário Mestre"));
});

test("estratégia ausente produz clinicalDecision sem presumir distribuição", () => {
  const decision = evaluate({ strategyMissing: true });
  assert.equal(decision.status, "PENDING");
  assert.equal(decision.meals.length, 0);
  assert.ok(decision.pending.some((entry) => entry.field === "nutritionStrategy"));
});

test("distribuição reutiliza refeições e horários sem criar alimentos", () => {
  const decision = evaluate();
  assert.deepEqual(decision.meals.map((meal) => meal.role), ["BREAKFAST", "LUNCH", "SNACK", "DINNER"]);
  assert.deepEqual(decision.meals.map((meal) => meal.time), ["07:00", "12:00", "16:00", "20:00"]);
  assert.ok(decision.meals.every((meal) => !("items" in meal)));
});

test("reutiliza eligibleFoods e smartPlanDraft somente como sinal interno", () => {
  const patientContext = context();
  const eligibleFoods: readonly EligibleFood[] = [
    { foodId: "food-1", name: "Alimento real", group: "Grupo", status: "BLOQUEADO", reason: "Alergia registrada." },
  ];
  const smartPlanDraft = {
    requiresProfessionalAdjustment: true,
  } as SmartPlanDraft;
  const decision = assistedClinicalDecisionEngine.evaluate({ patientContext, eligibleFoods, smartPlanDraft });
  assert.ok(decision.observations.includes("1 alimento(s) bloqueado(s) e 0 restrito(s) pelo motor nutricional."));
  assert.ok(decision.observations.includes("Prévia existente requer ajuste profissional."));
});

test("cache interno reutiliza a decisão base para o mesmo patientContext", () => {
  const patientContext = context();
  const first = assistedClinicalDecisionEngine.evaluate({ patientContext });
  const second = assistedClinicalDecisionEngine.evaluate({ patientContext });
  assert.equal(first, second);
});

test("serviço não consulta banco, não usa LLM e não gera macros ou dieta", async () => {
  const source = await readFile(new URL("./assisted-clinical-decision-engine.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /prisma|foodRepository|OpenAI|LLM|fetch\(/i);
  const decision = evaluate();
  assert.equal("dailyTotals" in decision, false);
  assert.equal("macros" in decision, false);
});
