import "dotenv/config";

import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  normalizeFoodSearchText,
  type ProfessionalFood,
} from "@/features/food-database";
import { foodRepository } from "@/features/food-database/repository";
import { prisma } from "@/lib/database/prisma";

import type { PatientContext } from "./patient-context-service";
import { nutritionalDecisionEngine } from "./nutritional-decision-engine";

let rice: ProfessionalFood;
let milk: ProfessionalFood;
let egg: ProfessionalFood;
let chicken: ProfessionalFood;
let bread: ProfessionalFood;

async function findRealFood(
  query: string,
  predicate: (food: ProfessionalFood) => boolean,
) {
  const result = await foodRepository.search({
    query,
    source: "TACO",
    status: "ACTIVE",
    page: 1,
    pageSize: 50,
  });
  const food = result.items.find(predicate);
  assert.ok(food, `Alimento TACO real não encontrado para: ${query}`);
  return food;
}

before(async () => {
  rice = await findRealFood(
    "arroz",
    (food) => normalizeFoodSearchText(food.officialName) === "arroz, integral, cozido",
  );
  milk = await findRealFood(
    "leite",
    (food) => {
      const name = normalizeFoodSearchText(food.officialName);
      return name.includes("leite") && name.includes("vaca") && name.includes("integral");
    },
  );
  egg = await findRealFood(
    "ovo",
    (food) => normalizeFoodSearchText(food.officialName).includes("ovo, de galinha, inteiro, cozido"),
  );
  chicken = await findRealFood(
    "frango",
    (food) => {
      const name = normalizeFoodSearchText(food.officialName);
      return name.includes("frango") && name.includes("peito") && name.includes("grelhado");
    },
  );
  bread = await findRealFood(
    "pão",
    (food) => normalizeFoodSearchText(food.officialName) === "pao, trigo, frances",
  );
});

after(async () => {
  await prisma.$disconnect();
});

interface Scenario {
  readonly objective?: string;
  readonly allergies?: readonly string[];
  readonly intolerances?: readonly string[];
  readonly restrictions?: readonly string[];
  readonly refusedFoods?: readonly string[];
  readonly preferredFoods?: readonly string[];
  readonly pathologies?: readonly string[];
  readonly strategyObservations?: string;
}

function patientContext(scenario: Scenario = {}): PatientContext {
  const foods = [rice, milk, egg, chicken, bread];
  return {
    patient: {
      patientId: "patient-decision-engine",
      masterRecordId: "master-record-decision-engine",
      attendanceId: "attendance-decision-engine",
      sex: "FEMALE",
      ageYears: 35,
      weightKg: 65,
      heightCm: 165,
      bmi: 23.9,
      objective: scenario.objective ?? "Manutenção da saúde",
      secondaryObjectives: [],
      source: "MASTER_RECORD",
    },
    clinical: {
      pathologies: scenario.pathologies ?? [],
      availableExams: [],
      allergyStatus: scenario.allergies?.length ? "CONFIRMED" : "DENIED",
      allergies: scenario.allergies ?? [],
      intolerances: scenario.intolerances ?? [],
      restrictions: scenario.restrictions ?? [],
      refusedFoods: scenario.refusedFoods ?? [],
      preferredFoods: scenario.preferredFoods ?? [],
      dailyRoutine: [],
      mealSchedules: [{ mealNumber: 1, name: "Refeição registrada", time: "12:00" }],
      exercise: {},
      relevantObservations: [],
      unavailableStructuredFields: [],
      source: "MASTER_RECORD",
    },
    nutritionStrategy: {
      sourceStrategyId: "strategy-decision-engine",
      protocol: "MIFFLIN_ST_JEOR",
      totalEnergyExpenditureKcal: 2_000,
      caloriesKcal: 2_000,
      protein: { grams: 100, percentage: 20 },
      carbohydrates: { grams: 250, percentage: 50 },
      fats: { grams: 66.7, percentage: 30 },
      dailyDistribution: [
        { mealNumber: 1, name: "Refeição registrada", time: "12:00", vetPercentage: 100, plannedCaloriesKcal: 2_000 },
      ],
      supplementation: [],
      observations: scenario.strategyObservations ?? "",
      source: "NUTRITION_STRATEGY",
    },
    foodCatalog: {
      source: "MASTER_FOOD_DATABASE",
      activeFoodCount: foods.length,
      availableSources: ["TACO"],
      foods,
    },
  };
}

function evaluate(scenario: Scenario = {}) {
  return nutritionalDecisionEngine.evaluate(patientContext(scenario));
}

function classification(result: readonly { foodId: string }[], food: ProfessionalFood) {
  const item = result.find((candidate) => candidate.foodId === food.id);
  assert.ok(item);
  return item as (typeof result)[number] & { status: string; reason: string };
}

test("paciente sem restrições recebe alimentos aprovados", () => {
  const result = evaluate();
  assert.equal(result.length, 5);
  assert.ok(result.every((food) => food.status === "APROVADO"));
  assert.ok(result.every((food) => food.reason === "Sem restrições aplicáveis."));
});

test("intolerância à lactose restringe laticínio sem bloquear arroz", () => {
  const result = evaluate({ intolerances: ["Intolerância à lactose"] });
  assert.deepEqual(classification(result, milk), {
    foodId: milk.id,
    name: milk.officialName,
    group: milk.foodGroup,
    status: "RESTRITO",
    reason: "Intolerância registrada: Intolerância à lactose.",
  });
  assert.equal(classification(result, rice).status, "APROVADO");
});

test("alergia ao ovo bloqueia alimento do grupo de ovos", () => {
  const result = evaluate({ allergies: ["Alergia ao ovo"] });
  assert.equal(classification(result, egg).status, "BLOQUEADO");
  assert.equal(classification(result, egg).reason, "Alergia registrada: Alergia ao ovo.");
  assert.equal(classification(result, milk).status, "APROVADO");
});

test("padrão vegetariano bloqueia carne e preserva alimentos compatíveis", () => {
  const result = evaluate({ restrictions: ["Vegetariana"] });
  assert.equal(classification(result, chicken).status, "BLOQUEADO");
  assert.equal(classification(result, chicken).reason, "Padrão alimentar vegetariano registrado.");
  assert.equal(classification(result, rice).status, "APROVADO");
  assert.equal(classification(result, egg).status, "APROVADO");
});

test("alimento recusado é bloqueado sem atingir outro alimento do grupo", () => {
  const result = evaluate({ refusedFoods: ["Arroz integral cozido"] });
  assert.equal(classification(result, rice).status, "BLOQUEADO");
  assert.equal(classification(result, rice).reason, "Alimento recusado: Arroz integral cozido.");
  assert.equal(classification(result, chicken).status, "APROVADO");
});

test("ausência de objetivo deixa a elegibilidade pendente como restrita", () => {
  const result = evaluate({ objective: "" });
  assert.ok(result.every((food) => food.status === "RESTRITO"));
  assert.ok(result.every((food) => food.reason === "Objetivo clínico não definido."));
});

test("preferência mantém aprovação e registra o motivo", () => {
  const result = evaluate({ preferredFoods: ["Arroz integral cozido"] });
  assert.equal(classification(result, rice).status, "APROVADO");
  assert.equal(classification(result, rice).reason, "Preferência registrada: Arroz integral cozido.");
});

test("protocolo low FODMAP não presume composição ausente no Banco Mestre", () => {
  const result = evaluate({ strategyObservations: "Protocolo low FODMAP" });
  assert.ok(result.every((food) => food.status === "RESTRITO"));
  assert.ok(
    result.every(
      (food) => food.reason === "Protocolo low FODMAP exige validação específica do alimento.",
    ),
  );
});

test("doença celíaca bloqueia fonte explícita de glúten", () => {
  const result = evaluate({ pathologies: ["Doença celíaca"] });
  assert.equal(classification(result, bread).status, "BLOQUEADO");
  assert.equal(classification(result, bread).reason, "Doença celíaca registrada.");
  assert.equal(classification(result, rice).status, "APROVADO");
});
